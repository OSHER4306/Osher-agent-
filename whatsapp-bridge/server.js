import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import QRCode from 'qrcode';
import pg from 'pg';
import pino from 'pino';
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestWaWebVersion,
  useMultiFileAuthState
} from '@whiskeysockets/baileys';

const { Pool } = pg;
const app = express();
const env = process.env;
const PORT = Number(env.PORT || 10000);
const AUTH_DIR = path.join(os.tmpdir(), 'wa-auth');
const SESSION_ID = 'default';
const AGENT_KEY = env.AGENT_KEY || '';
const SETUP_TOKEN = env.SETUP_TOKEN || '';
const DATABASE_URL = env.DATABASE_URL || '';

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!AGENT_KEY) throw new Error('AGENT_KEY is required');
if (!SETUP_TOKEN) throw new Error('SETUP_TOKEN is required');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

const logger = pino({ level: env.LOG_LEVEL || 'warn' });

let sock = null;
let connectionState = 'starting';
let connectedUser = null;
let lastQr = null;
let lastQrDataUrl = null;
let lastError = null;
let pairingInFlight = false;
let persistQueue = Promise.resolve();
let reconnectTimer = null;

app.use(express.json({ limit: '256kb' }));

function safePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) throw new Error('Use country code + phone number, digits only');
  return digits;
}

function setupAuth(req, res, next) {
  const token = req.get('x-setup-token') || req.query.token;
  if (token !== SETUP_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
}

function agentAuth(req, res, next) {
  const key = req.get('x-agent-key') || req.query.key;
  if (key !== AGENT_KEY) return res.status(401).json({ error: 'unauthorized' });
  next();
}

async function initDb() {
  await pool.query(`
    create table if not exists wa_session (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `);
}

async function restoreAuthDir() {
  await fs.rm(AUTH_DIR, { recursive: true, force: true });
  await fs.mkdir(AUTH_DIR, { recursive: true });

  const { rows } = await pool.query('select data from wa_session where id=$1', [SESSION_ID]);
  const data = rows[0]?.data;
  if (!data || typeof data !== 'object') return false;

  for (const [name, base64] of Object.entries(data)) {
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) continue;
    await fs.writeFile(path.join(AUTH_DIR, name), Buffer.from(String(base64), 'base64'));
  }
  return true;
}

async function snapshotAuthDir() {
  persistQueue = persistQueue.then(async () => {
    let names = [];
    try {
      names = await fs.readdir(AUTH_DIR);
    } catch {
      return;
    }
    const data = {};
    for (const name of names) {
      const full = path.join(AUTH_DIR, name);
      const st = await fs.stat(full).catch(() => null);
      if (!st?.isFile()) continue;
      data[name] = (await fs.readFile(full)).toString('base64');
    }
    if (!Object.keys(data).length) return;
    await pool.query(
      `insert into wa_session(id,data,updated_at)
       values($1,$2::jsonb,now())
       on conflict(id) do update set data=excluded.data, updated_at=now()`,
      [SESSION_ID, JSON.stringify(data)]
    );
  }).catch(err => {
    logger.error({ err }, 'persist auth failed');
  });
  return persistQueue;
}

async function clearSession() {
  await pool.query('delete from wa_session where id=$1', [SESSION_ID]);
  await fs.rm(AUTH_DIR, { recursive: true, force: true });
  await fs.mkdir(AUTH_DIR, { recursive: true });
}

function scheduleReconnect(delayMs = 3000) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    startSocket().catch(err => {
      lastError = err.message;
      logger.error({ err }, 'reconnect failed');
      scheduleReconnect(Math.min(delayMs * 2, 30000));
    });
  }, delayMs);
}

async function startSocket({ fresh = false } = {}) {
  if (sock) {
    try { sock.end?.(new Error('restart')); } catch {}
    sock = null;
  }
  if (fresh) await clearSession();
  else await restoreAuthDir();

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const originalKeysSet = state.keys.set.bind(state.keys);
  state.keys.set = async (data) => {
    await originalKeysSet(data);
    await snapshotAuthDir();
  };

  let version;
  try {
    const latest = await fetchLatestWaWebVersion();
    version = latest.version;
  } catch (err) {
    logger.warn({ err }, 'could not fetch latest WA web version; using library default');
  }

  sock = makeWASocket({
    auth: state,
    version,
    browser: Browsers.macOS('Desktop'),
    logger,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false
  });

  connectionState = state.creds.registered ? 'connecting' : 'ready_to_pair';
  lastError = null;
  connectedUser = null;

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    await snapshotAuthDir();
  });

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      lastQr = qr;
      try {
        lastQrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      } catch {
        lastQrDataUrl = null;
      }
      if (connectionState !== 'pairing') connectionState = 'qr_ready';
    }

    if (connection === 'connecting') {
      if (connectionState !== 'pairing') connectionState = 'connecting';
    }

    if (connection === 'open') {
      connectionState = 'connected';
      lastQr = null;
      lastQrDataUrl = null;
      lastError = null;
      connectedUser = sock?.user ? {
        id: sock.user.id || null,
        name: sock.user.name || null
      } : null;
      await snapshotAuthDir();
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
        || lastDisconnect?.error?.statusCode
        || lastDisconnect?.error?.data?.statusCode
        || null;

      lastError = lastDisconnect?.error?.message || (code ? `WhatsApp closed connection (${code})` : 'WhatsApp connection closed');

      if (code === DisconnectReason.loggedOut || code === 401) {
        connectionState = 'needs_pairing';
      } else {
        connectionState = 'reconnecting';
        scheduleReconnect(2500);
      }
    }
  });

  return sock;
}

async function requestPairingCode(phone) {
  const number = safePhone(phone);
  if (!sock) await startSocket();

  if (sock.authState?.creds?.registered) {
    throw new Error('This bridge is already paired. Disconnect/reset first.');
  }

  if (pairingInFlight) throw new Error('A pairing request is already in progress');
  pairingInFlight = true;
  connectionState = 'pairing';

  try {
    let last;
    for (let i = 0; i < 8; i++) {
      try {
        const code = await sock.requestPairingCode(number);
        if (code) {
          return String(code).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        }
      } catch (err) {
        last = err;
        await new Promise(r => setTimeout(r, 900));
      }
    }
    throw last || new Error('Could not generate pairing code');
  } finally {
    pairingInFlight = false;
  }
}

function statusPayload() {
  return {
    ok: true,
    state: connectionState,
    connected: connectionState === 'connected',
    user: connectedUser,
    qr: lastQrDataUrl,
    error: lastError
  };
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'whatsapp-render-bridge',
    state: connectionState,
    connected: connectionState === 'connected'
  });
});

app.get('/api/status', setupAuth, (_req, res) => {
  res.json(statusPayload());
});

app.post('/api/pair', setupAuth, async (req, res) => {
  try {
    const code = await requestPairingCode(req.body?.phone);
    res.json({ ok: true, code });
  } catch (err) {
    lastError = err.message;
    res.status(400).json({ error: err.message, state: connectionState });
  }
});

app.post('/api/reset', setupAuth, async (_req, res) => {
  try {
    if (sock) {
      try { await sock.logout(); } catch {}
    }
    await startSocket({ fresh: true });
    res.json({ ok: true, state: connectionState });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/send', agentAuth, async (req, res) => {
  try {
    if (!sock || connectionState !== 'connected') throw new Error('WhatsApp is not connected');
    const to = safePhone(req.body?.to);
    const message = String(req.body?.message || '').trim();
    if (!message || message.length > 5000) throw new Error('Message must be 1-5000 characters');
    const jid = `${to}@s.whatsapp.net`;
    const result = await sock.sendMessage(jid, { text: message });
    res.json({ ok: true, id: result?.key?.id || null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/setup', (req, res) => {
  if (req.query.token !== SETUP_TOKEN) {
    return res.status(401).send('Unauthorized');
  }
  const token = JSON.stringify(SETUP_TOKEN);
  res.type('html').send(`<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>WhatsApp Remote Bridge</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0b141a;color:#e9edef;margin:0;padding:24px}
.card{max-width:520px;margin:0 auto;background:#202c33;border-radius:20px;padding:22px;box-shadow:0 10px 40px #0005}
h1{font-size:25px;margin:0 0 8px}.muted{color:#8696a0;line-height:1.45}
input,button{width:100%;box-sizing:border-box;font-size:18px;border-radius:12px;padding:14px;margin-top:10px}
input{border:1px solid #3b4a54;background:#111b21;color:white}
button{border:0;background:#00a884;color:#06130f;font-weight:800}button.secondary{background:#3b4a54;color:#fff}
#code{font-size:34px;letter-spacing:4px;text-align:center;font-weight:800;margin:18px 0;color:#25d366}
#qr img{width:100%;max-width:320px;border-radius:12px;background:white;padding:8px}
.ok{color:#25d366}.bad{color:#ff6b6b}.row{margin-top:14px}
</style>
</head>
<body><div class="card">
<h1>WhatsApp Remote Bridge</h1>
<div class="muted">חיבור כמכשיר מקושר. מומלץ להתחיל בקוד לפי מספר; QR זמין כגיבוי.</div>
<div id="state" class="row">בודק סטטוס…</div>
<div id="pairBox">
<input id="phone" inputmode="numeric" autocomplete="tel" placeholder="9725XXXXXXXX">
<button onclick="pair()">צור קוד חיבור בן 8 ספרות</button>
<div id="code"></div>
<div class="muted">באייפון: WhatsApp ← הגדרות ← מכשירים מקושרים ← קישור מכשיר ← קישור באמצעות מספר טלפון.</div>
</div>
<div id="qr" class="row"></div>
<button class="secondary" onclick="resetBridge()">נתק / אפס חיבור</button>
</div>
<script>
const token=${token};
async function api(path, opts={}){
  opts.headers={...(opts.headers||{}),'x-setup-token':token,'content-type':'application/json'};
  const r=await fetch(path,opts); const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error||'Request failed'); return j;
}
async function refresh(){
  try{
    const s=await api('/api/status');
    const el=document.getElementById('state');
    el.innerHTML=s.connected?'<b class="ok">מחובר ✓</b>':'מצב: <b>'+s.state+'</b>'+(s.error?'<div class="bad">'+s.error+'</div>':'');
    document.getElementById('pairBox').style.display=s.connected?'none':'block';
    document.getElementById('qr').innerHTML=s.qr?'<div class="muted">או סרוק QR:</div><img src="'+s.qr+'">':'';
  }catch(e){document.getElementById('state').innerHTML='<span class="bad">'+e.message+'</span>'}
}
async function pair(){
  const phone=document.getElementById('phone').value;
  document.getElementById('code').textContent='מייצר…';
  try{const r=await api('/api/pair',{method:'POST',body:JSON.stringify({phone})});document.getElementById('code').textContent=r.code}
  catch(e){document.getElementById('code').textContent=e.message}
  refresh();
}
async function resetBridge(){
  if(!confirm('לנתק ולאפס את החיבור?'))return;
  try{await api('/api/reset',{method:'POST',body:'{}'});document.getElementById('code').textContent='';refresh()}catch(e){alert(e.message)}
}
refresh(); setInterval(refresh,3000);
</script></body></html>`);
});

app.get('/', (_req, res) => {
  res.type('html').send('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp Bridge</title><body style="font-family:sans-serif;padding:32px"><h2>WhatsApp Bridge is online</h2><p>Use the private setup link to pair a device.</p></body>');
});

async function main() {
  await initDb();
  await startSocket();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WhatsApp bridge listening on ${PORT}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});