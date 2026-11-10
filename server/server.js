import express from 'express';
import helmet from 'helmet';
import puppeteer from 'puppeteer';
import { createHash, createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'crypto';

const app = express();
const env = process.env;
const V = env.META_GRAPH_VERSION || 'v27.0';
const PRIMARY_APP_ORIGIN = env.APP_ORIGIN || 'https://osher-agent-pro.onrender.com';
const APP_ORIGINS = new Set([PRIMARY_APP_ORIGIN,'https://osher-agent-mobile.onrender.com','https://osher-agent-pro.onrender.com','https://osher-agent-ios.onrender.com']);
const API_ORIGIN = env.API_ORIGIN || 'https://osher-agent-api.onrender.com';

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use((req, res, next) => {
  const origin=req.headers.origin;
  if(origin && APP_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Agent-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '1mb' }));

function auth(req, res, next) {
  if (!env.AGENT_KEY || req.get('x-agent-key') !== env.AGENT_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

function cookieMap(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('=');
    return [decodeURIComponent(x.slice(0, i)), decodeURIComponent(x.slice(i + 1))];
  }));
}
function cryptoKey() {
  if (!env.AGENT_KEY) throw new Error('AGENT_KEY missing');
  return createHash('sha256').update(env.AGENT_KEY).digest();
}
function seal(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cryptoKey(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map(x => x.toString('base64url')).join('.');
}
function unseal(value) {
  try {
    const [a,b,c] = String(value || '').split('.');
    if (!a || !b || !c) return null;
    const iv = Buffer.from(a,'base64url'), tag = Buffer.from(b,'base64url'), enc = Buffer.from(c,'base64url');
    const decipher = createDecipheriv('aes-256-gcm', cryptoKey(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8'));
  } catch { return null; }
}
function setEncryptedCookie(res, name, value, maxAgeSeconds = 5184000) {
  res.append('Set-Cookie', `${name}=${encodeURIComponent(seal(value))}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAgeSeconds}`);
}
function clearCookie(res, name) {
  res.append('Set-Cookie', `${name}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`);
}
function metaSession(req) {
  const data = unseal(cookieMap(req).oa_meta);
  if (!data?.access_token) return null;
  if (data.expires_at && Date.now() > data.expires_at) return null;
  return data;
}
function metaConfig(req) {
  if (env.META_APP_ID && env.META_APP_SECRET) return { appId: env.META_APP_ID, appSecret: env.META_APP_SECRET };
  const cfg = unseal(cookieMap(req).oa_meta_cfg);
  return cfg?.appId && cfg?.appSecret ? cfg : null;
}

async function graph(path, token, opts = {}) {
  const url = `https://graph.facebook.com/${V}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token || '')}`;
  const response = await fetch(url, opts);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message || `Meta HTTP ${response.status}`);
  return json;
}

async function getPages(token) {
  const result = await graph('me/accounts?fields=id,name,access_token,instagram_business_account{id,username}', token);
  return result.data || [];
}

const waRemoteSessions = new Map();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function normalizeRemotePhone(raw) {
  const original = String(raw || '').trim();
  const digits = original.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) throw new Error('Enter a valid international WhatsApp number, for example +9725XXXXXXXX');
  const known = [
    { code:'972', country:'Israel' },
    { code:'1', country:'United States' },
    { code:'44', country:'United Kingdom' },
    { code:'33', country:'France' },
    { code:'49', country:'Germany' },
    { code:'39', country:'Italy' },
    { code:'34', country:'Spain' }
  ].find(x => digits.startsWith(x.code));
  return {
    e164:'+' + digits,
    country:known?.country || null,
    local:known ? digits.slice(known.code.length).replace(/^0+/, '') : digits
  };
}

async function clickText(page, patterns, timeoutMs = 25000) {
  const canonical = pattern => {
    const p=String(pattern||'').toLowerCase();
    if(p.includes('link with phone number')) return ['Link with phone number instead.','Link with phone number instead'];
    if(p.includes('log in with phone number')) return ['Log in with phone number'];
    if(p==='next') return ['Next'];
    return [String(pattern||'')];
  };
  const deadline=Date.now()+timeoutMs;

  while(Date.now()<deadline){
    for(const pattern of patterns){
      const lower=String(pattern||'').toLowerCase();

      if(lower.includes('log in with phone number')){
        const dispatched=await Promise.race([
          page.evaluate(()=>{
            const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase().replace(/[.!]+$/,'');
            const nodes=[...document.querySelectorAll('div,button,a,[role="button"],[role="link"]')];
            const exact=nodes.filter(n=>norm(n.innerText||n.textContent||'')==='log in with phone number')
              .sort((a,b)=>{
                const ar=a.getBoundingClientRect(), br=b.getBoundingClientRect();
                return (ar.width*ar.height)-(br.width*br.height);
              })[0];
            if(!exact) return false;
            let target=exact;
            for(let i=0;i<6&&target;i++,target=target.parentElement){
              const role=target.getAttribute?.('role')||'';
              if(target.tagName==='BUTTON'||target.tagName==='A'||role==='button'||role==='link'||target.tabIndex>=0) break;
            }
            target=target||exact;
            target.scrollIntoView?.({block:'center',inline:'center'});
            target.focus?.();
            const opts={bubbles:true,cancelable:true,composed:true,view:window,button:0,buttons:1,pointerId:1,pointerType:'mouse',isPrimary:true};
            try{target.dispatchEvent(new PointerEvent('pointerdown',opts));}catch{}
            try{target.dispatchEvent(new MouseEvent('mousedown',opts));}catch{}
            try{target.dispatchEvent(new PointerEvent('pointerup',{...opts,buttons:0}));}catch{}
            try{target.dispatchEvent(new MouseEvent('mouseup',{...opts,buttons:0}));}catch{}
            try{target.dispatchEvent(new MouseEvent('click',{...opts,buttons:0}));}catch{}
            try{target.click?.();}catch{}
            return true;
          }),
          new Promise(resolve=>setTimeout(()=>resolve(false),2500))
        ]).catch(()=>false);
        if(dispatched){
          await sleep(1600);
          return true;
        }

        const focused=await Promise.race([
          page.evaluate(()=>{
            const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase().replace(/[.!]+$/,'');
            const nodes=[...document.querySelectorAll('button,a,[role="button"],[role="link"],div,span')];
            const match=nodes.find(n=>norm(n.innerText||n.textContent||'')==='log in with phone number');
            if(!match) return false;
            let target=match;
            for(let i=0;i<7&&target;i++,target=target.parentElement){
              const role=target.getAttribute?.('role')||'';
              if(target.tagName==='BUTTON'||target.tagName==='A'||role==='button'||role==='link'||target.tabIndex>=0){
                target.focus?.();
                target.setAttribute?.('data-osher-pair-target','1');
                return true;
              }
            }
            match.focus?.();
            match.setAttribute?.('data-osher-pair-target','1');
            return true;
          }),
          new Promise(resolve=>setTimeout(()=>resolve(false),2500))
        ]).catch(()=>false);
        if(focused){
          await page.keyboard.press('Enter').catch(()=>{});
          await sleep(1400);
          return true;
        }
      }
      if(lower.includes('log in with phone number')){
        const ariaSelectors=[
          '::-p-aria([name="Log in with phone number"][role="button"])',
          '::-p-aria(Log in with phone number)'
        ];
        for(const selector of ariaSelectors){
          try{
            await page.locator(selector)
              .setTimeout(Math.min(3500, Math.max(500, deadline-Date.now())))
              .setWaitForStableBoundingBox(false)
              .click();
            await sleep(1200);
            return true;
          }catch{}
        }
      }
      for(const text of canonical(pattern)){
        const escaped=text.replace(/\\/g,'\\\\').replace(/"/g,'\\"');
        const selector='::-p-text("'+escaped+'")';
        try{
          await page.locator(selector)
            .setTimeout(Math.min(3500, Math.max(500, deadline-Date.now())))
            .setWaitForStableBoundingBox(false)
            .click();
          await sleep(1000);
          return true;
        }catch{}
      }
    }

    // Deterministic DOM fallback with a hard timeout.
    const fallback=await Promise.race([
      page.evaluate((patterns)=>{
        const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase().replace(/[.!]+$/,'');
        const pats=patterns.map(norm);
        const nodes=[...document.querySelectorAll('button,a,[role="button"],[role="link"],div,span')];
        let best=null;
        for(const node of nodes){
          const r=node.getBoundingClientRect?.();
          if(!r||r.width<2||r.height<2) continue;
          const txt=norm([
            node.innerText||node.textContent||'',
            node.getAttribute?.('aria-label')||'',
            node.getAttribute?.('title')||''
          ].join(' '));
          if(!txt) continue;
          for(const p of pats){
            const exact=txt===p;
            const starts=txt.startsWith(p)&&txt.length<=p.length+12;
            if(!exact&&!starts) continue;
            const score=(exact?0:100)+(r.width*r.height)/100000;
            if(!best||score<best.score) best={score,x:r.left+r.width/2,y:r.top+r.height/2};
          }
        }
        return best;
      },patterns),
      new Promise(resolve=>setTimeout(()=>resolve(null),3000))
    ]).catch(()=>null);

    if(fallback){
      await page.mouse.click(fallback.x,fallback.y,{delay:100}).catch(()=>{});
      await sleep(1000);
      return true;
    }
    await sleep(400);
  }
  return false;
}
async function selectCountryIfPossible(page, country) {
  if (!country) return;
  const opened = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('button,[role="button"],div')];
    const node = nodes.find(el => {
      const text = (el.innerText || '').trim();
      const aria = el.getAttribute('aria-label') || '';
      return /country|united states|\+1/i.test(text + ' ' + aria);
    });
    if (!node) return false;
    const target = node.closest('button,[role="button"]') || node;
    try { target.click(); return true; } catch { return false; }
  }).catch(() => false);
  if (!opened) return;
  await sleep(800);
  await clickText(page, [country], 6000);
  await sleep(500);
}

async function findPhoneInput(page) {
  const handles = await page.$$('input, [contenteditable="true"]');
  for (const h of handles) {
    const meta = await h.evaluate(el => ({
      tag:el.tagName,
      type:(el.type || '').toLowerCase(),
      placeholder:el.placeholder || '',
      aria:el.getAttribute('aria-label') || '',
      inputmode:el.getAttribute('inputmode') || '',
      contenteditable:el.getAttribute('contenteditable') || '',
      visible:!!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    })).catch(() => null);
    if (!meta?.visible) continue;
    if (['checkbox','radio','hidden','button','submit','reset','file'].includes(meta.type)) continue;
    const hay = (meta.type+' '+meta.placeholder+' '+meta.aria+' '+meta.inputmode).toLowerCase();
    const preferred = /tel|phone|number|mobile|numeric/.test(hay);
    if (preferred) return h;
  }
  for (const h of handles) {
    const meta = await h.evaluate(el => ({
      type:(el.type || '').toLowerCase(),
      visible:!!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      ce:el.getAttribute('contenteditable')==='true'
    })).catch(()=>null);
    if(!meta?.visible) continue;
    if(['checkbox','radio','hidden','button','submit','reset','file'].includes(meta.type)) continue;
    if(meta.ce || ['','text','tel','number'].includes(meta.type)) return h;
  }
  return null;
}

async function fillPhoneInput(page, localNumber, e164) {
  const chosen = await findPhoneInput(page);
  if (!chosen) throw new Error('WhatsApp phone-number input was not found');
  await chosen.click({clickCount:3}).catch(()=>{});
  await page.keyboard.press('Backspace').catch(()=>{});
  await chosen.type(localNumber || e164.replace(/^\+/, ''), {delay:35});
}
function extractPairingCode(text) {
  const lines = String(text || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
  for (const line of lines) {
    const compact = line.replace(/[\s-]/g, '');
    if (/^[A-Z0-9]{8}$/i.test(compact) && !/^\d{8}$/.test(compact)) return compact.toUpperCase();
  }
  const mixed = String(text || '').match(/\b[A-Z0-9]{4}[\s-]?[A-Z0-9]{4}\b/i);
  if (mixed) return mixed[0].replace(/[\s-]/g,'').toUpperCase();
  const digits = String(text || '').match(/\b\d{4}[\s-]?\d{4}\b/);
  if (digits) return digits[0].replace(/[\s-]/g,'');
  return null;
}

async function sessionScreenshot(session) {
  if (!session?.page || session.page.isClosed()) return null;
  const buf = await session.page.screenshot({type:'png', fullPage:false}).catch(()=>null);
  return buf ? 'data:image/png;base64,' + buf.toString('base64') : null;
}

async function prepareRemoteWhatsapp(session, phone) {
  try {
    session.status='launching';
    const browser = await puppeteer.launch({
      headless:true,
      args:[
        '--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
        '--disable-gpu','--no-first-run','--no-default-browser-check','--lang=en-US'
      ]
    });
    session.browser=browser;
    const page=await browser.newPage();
    session.page=page;
    await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({'Accept-Language':'en-US,en;q=0.9'});
    session.status='opening_whatsapp_web';
    await page.goto('https://web.whatsapp.com/', {waitUntil:'domcontentloaded', timeout:70000});
    await sleep(3500);

    session.status='opening_phone_link';
    const linkClicked = await clickText(page, ['log in with phone number'], 30000);
    if (!linkClicked) {
      session.screenshot = await sessionScreenshot(session);
      throw new Error('WhatsApp Web did not expose the phone-number linking option in the remote desktop session');
    }
    await sleep(1800);

    await selectCountryIfPossible(page, phone.country);
    session.status='entering_phone';
    await fillPhoneInput(page, phone.local, phone.e164);
    await sleep(400);

    const nextClicked = await clickText(page, ['next'], 8000);
    if (!nextClicked) {
      session.screenshot = await sessionScreenshot(session);
      throw new Error('WhatsApp Next button was not found after entering the phone number');
    }

    session.status='waiting_for_code';
    const started=Date.now();
    while(Date.now()-started < 45000){
      const bodyText=await page.evaluate(()=>document.body.innerText).catch(()=> '');
      const code=extractPairingCode(bodyText);
      if(code){
        session.code=code;
        session.status='code_ready';
        session.screenshot=await sessionScreenshot(session);
        break;
      }
      await sleep(1000);
    }
    if(!session.code){
      session.screenshot=await sessionScreenshot(session);
      throw new Error('WhatsApp did not return an 8-character pairing code');
    }

    // Keep the browser alive and watch for successful linking.
    while(session.browser && session.status==='code_ready'){
      const linked=await page.evaluate(()=>{
        return !!document.querySelector('#pane-side,[data-testid="chat-list"],[aria-label="Chat list"]') ||
          /\bchats\b/i.test((document.body.innerText||'').slice(0,1200));
      }).catch(()=>false);
      if(linked){
        session.status='linked';
        session.linkedAt=Date.now();
        session.screenshot=await sessionScreenshot(session);
        break;
      }
      await sleep(1800);
    }
  } catch (error) {
    session.error=error.message;
    session.status='error';
    if(!session.screenshot) session.screenshot=await sessionScreenshot(session);
  }
}

app.post('/api/whatsapp/remote/start', auth, async (req,res)=>{
  try{
    const phone=normalizeRemotePhone(req.body?.phone);
    const id=randomUUID();
    const session={id,phone:phone.e164,status:'starting',createdAt:Date.now(),code:null,error:null,screenshot:null,browser:null,page:null};
    waRemoteSessions.set(id,session);
    prepareRemoteWhatsapp(session,phone);
    res.json({ok:true,id,status:session.status,phone:phone.e164});
  }catch(error){
    res.status(400).json({error:error.message});
  }
});

app.get('/api/whatsapp/remote/:id', auth, async (req,res)=>{
  const session=waRemoteSessions.get(req.params.id);
  if(!session) return res.status(404).json({error:'Remote WhatsApp session not found'});
  const withScreenshot=req.query.screenshot==='1';
  if(withScreenshot && !session.screenshot) session.screenshot=await sessionScreenshot(session);
  res.json({
    ok:true,id:session.id,phone:session.phone,status:session.status,
    code:session.code,error:session.error,
    screenshot:withScreenshot ? session.screenshot : undefined,
    linkedAt:session.linkedAt || null
  });
});

app.post('/api/whatsapp/remote/:id/close', auth, async (req,res)=>{
  const session=waRemoteSessions.get(req.params.id);
  if(!session) return res.json({ok:true});
  try{await session.browser?.close();}catch{}
  waRemoteSessions.delete(req.params.id);
  res.json({ok:true});
});

app.get('/health', (req, res) => res.json({
  ok: true,
  service: 'osher-agent',
  metaOAuthConfigured: Boolean(metaConfig(req)),
  remoteBrowserPairing: true
}));

app.post('/api/meta/config', auth, (req, res) => {
  const appId = String(req.body?.appId || '').trim();
  const appSecret = String(req.body?.appSecret || '').trim();
  if (!/^\d{5,30}$/.test(appId)) return res.status(400).json({ error:'Invalid Meta App ID' });
  if (appSecret.length < 16 || appSecret.length > 200) return res.status(400).json({ error:'Invalid Meta App Secret' });
  setEncryptedCookie(res, 'oa_meta_cfg', { appId, appSecret }, 31536000);
  res.json({ ok:true });
});

app.post('/api/meta/config/clear', auth, (req, res) => {
  clearCookie(res, 'oa_meta_cfg');
  clearCookie(res, 'oa_meta');
  res.json({ ok:true });
});

app.get('/connect/meta', (req, res) => {
  const cfg = metaConfig(req);
  if (!cfg) {
    return res.redirect(PRIMARY_APP_ORIGIN + '/?connect_error=' + encodeURIComponent('Meta App ID / Secret are not configured yet'));
  }
  const state = seal({ type:'meta-oauth', expires_at: Date.now() + 10 * 60 * 1000 });
  const redirectUri = API_ORIGIN + '/oauth/meta/callback';
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    scope: [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments'
    ].join(',')
  });
  res.redirect('https://www.facebook.com/' + V + '/dialog/oauth?' + params.toString());
});

app.get('/oauth/meta/callback', async (req, res) => {
  try {
    const cfg = metaConfig(req);
    if (!cfg) throw new Error('Meta app configuration was not found');
    if (req.query.error) throw new Error(String(req.query.error_description || req.query.error));
    const state = unseal(req.query.state);
    if (!state || state.type !== 'meta-oauth' || Date.now() > state.expires_at) throw new Error('Invalid or expired OAuth state');
    const redirectUri = API_ORIGIN + '/oauth/meta/callback';
    const shortParams = new URLSearchParams({
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      redirect_uri: redirectUri,
      code: String(req.query.code || '')
    });
    const shortResp = await fetch('https://graph.facebook.com/' + V + '/oauth/access_token?' + shortParams.toString());
    const shortJson = await shortResp.json();
    if (!shortResp.ok || !shortJson.access_token) throw new Error(shortJson?.error?.message || 'Meta token exchange failed');

    const longParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      fb_exchange_token: shortJson.access_token
    });
    const longResp = await fetch('https://graph.facebook.com/' + V + '/oauth/access_token?' + longParams.toString());
    const longJson = await longResp.json().catch(() => ({}));
    const accessToken = longJson.access_token || shortJson.access_token;
    const expiresIn = Number(longJson.expires_in || shortJson.expires_in || 5184000);

    setEncryptedCookie(res, 'oa_meta', {
      access_token: accessToken,
      expires_at: Date.now() + expiresIn * 1000
    }, Math.min(expiresIn, 5184000));

    res.redirect(PRIMARY_APP_ORIGIN + '/?connected=meta');
  } catch (error) {
    res.redirect(PRIMARY_APP_ORIGIN + '/?connect_error=' + encodeURIComponent(error.message));
  }
});

app.get('/api/connections', auth, async (req, res) => {
  const out = {
    metaOAuthConfigured: Boolean(metaConfig(req)),
    facebook: { connected: false },
    instagram: { connected: false },
    whatsapp: { connected: Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID), mode: env.WHATSAPP_TOKEN ? 'cloud-api' : 'web-link' }
  };
  try {
    const session = metaSession(req);
    if (session) {
      const profile = await graph('me?fields=id,name', session.access_token);
      const pages = await getPages(session.access_token);
      out.facebook = {
        connected: pages.length > 0,
        accountName: profile.name,
        pages: pages.map(p => ({ id:p.id, name:p.name }))
      };
      const ig = pages.flatMap(p => p.instagram_business_account ? [{
        pageId:p.id,
        pageName:p.name,
        id:p.instagram_business_account.id,
        username:p.instagram_business_account.username || null
      }] : []);
      out.instagram = { connected: ig.length > 0, accounts: ig };
    }
  } catch (error) {
    out.metaError = error.message;
  }
  res.json(out);
});

app.post('/api/disconnect/meta', auth, (req, res) => {
  clearCookie(res, 'oa_meta');
  res.json({ ok:true });
});

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === env.META_VERIFY_TOKEN) {
    return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  console.log(JSON.stringify({ type: 'meta-webhook', body: req.body }));
  res.sendStatus(200);
});

app.post('/api/action', auth, async (req, res) => {
  try {
    const action = req.body || {};

    if (action.type === 'whatsapp_send') {
      if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
        throw new Error('WhatsApp Business API is not configured. Use WhatsApp Web linking for manual handoff, or connect Cloud API.');
      }
      const response = await fetch(`https://graph.facebook.com/${V}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: action.phone,
          type: 'text',
          text: { body: action.message }
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || 'WhatsApp send failed');
      return res.json({ ok: true, result: json });
    }

    const session = metaSession(req);
    const userToken = session?.access_token || null;

    if (action.type === 'facebook_post') {
      if (env.FACEBOOK_PAGE_ACCESS_TOKEN && env.FACEBOOK_PAGE_ID) {
        const body = new URLSearchParams({ message: action.message });
        const json = await graph(`${env.FACEBOOK_PAGE_ID}/feed`, env.FACEBOOK_PAGE_ACCESS_TOKEN, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body
        });
        return res.json({ ok: true, result: json });
      }
      if (!userToken) throw new Error('Connect Facebook in OSHER AGENT first');
      const pages = await getPages(userToken);
      const page = pages.find(p => p.id === action.pageId) || pages[0];
      if (!page) throw new Error('No Facebook Page is available to this account');
      const body = new URLSearchParams({ message: action.message });
      const json = await graph(`${page.id}/feed`, page.access_token, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body
      });
      return res.json({ ok: true, result: json, page:{ id:page.id, name:page.name } });
    }

    if (action.type === 'instagram_photo') {
      let instagramId = env.INSTAGRAM_USER_ID || null;
      let token = env.INSTAGRAM_ACCESS_TOKEN || null;
      if (!instagramId || !token) {
        if (!userToken) throw new Error('Connect Instagram/Meta in OSHER AGENT first');
        const pages = await getPages(userToken);
        const page = pages.find(p => p.instagram_business_account && (!action.instagramId || p.instagram_business_account.id === action.instagramId));
        if (!page?.instagram_business_account) throw new Error('No linked Instagram Professional account was found');
        instagramId = page.instagram_business_account.id;
        token = page.access_token;
      }
      const createBody = new URLSearchParams({
        image_url: action.imageUrl,
        caption: action.caption || ''
      });
      const container = await graph(`${instagramId}/media`, token, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: createBody
      });
      const publishBody = new URLSearchParams({ creation_id: container.id });
      const published = await graph(`${instagramId}/media_publish`, token, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: publishBody
      });
      return res.json({ ok: true, result: published });
    }

    return res.status(400).json({ error: 'unsupported action' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(env.PORT || 8787, () => console.log('Osher Agent listening'));
