import express from 'express';
import helmet from 'helmet';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const app = express();
const env = process.env;
const V = env.META_GRAPH_VERSION || 'v27.0';
const APP_ORIGIN = env.APP_ORIGIN || 'https://osher-agent-ios.onrender.com';
const API_ORIGIN = env.API_ORIGIN || 'https://osher-agent-api.onrender.com';

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', APP_ORIGIN);
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

app.get('/health', (req, res) => res.json({
  ok: true,
  service: 'osher-agent',
  metaOAuthConfigured: Boolean(env.META_APP_ID && env.META_APP_SECRET)
}));

app.get('/connect/meta', (req, res) => {
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    return res.status(503).send('Meta OAuth is ready in OSHER AGENT, but META_APP_ID / META_APP_SECRET still need to be configured.');
  }
  const state = seal({ type:'meta-oauth', expires_at: Date.now() + 10 * 60 * 1000 });
  const redirectUri = API_ORIGIN + '/oauth/meta/callback';
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
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
    if (req.query.error) throw new Error(String(req.query.error_description || req.query.error));
    const state = unseal(req.query.state);
    if (!state || state.type !== 'meta-oauth' || Date.now() > state.expires_at) throw new Error('Invalid or expired OAuth state');
    const redirectUri = API_ORIGIN + '/oauth/meta/callback';
    const shortParams = new URLSearchParams({
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
      redirect_uri: redirectUri,
      code: String(req.query.code || '')
    });
    const shortResp = await fetch('https://graph.facebook.com/' + V + '/oauth/access_token?' + shortParams.toString());
    const shortJson = await shortResp.json();
    if (!shortResp.ok || !shortJson.access_token) throw new Error(shortJson?.error?.message || 'Meta token exchange failed');

    const longParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: env.META_APP_ID,
      client_secret: env.META_APP_SECRET,
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

    res.redirect(APP_ORIGIN + '/?connected=meta');
  } catch (error) {
    res.redirect(APP_ORIGIN + '/?connect_error=' + encodeURIComponent(error.message));
  }
});

app.get('/api/connections', auth, async (req, res) => {
  const out = {
    metaOAuthConfigured: Boolean(env.META_APP_ID && env.META_APP_SECRET),
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