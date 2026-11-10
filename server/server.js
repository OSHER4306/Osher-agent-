import express from 'express';
import helmet from 'helmet';

const app = express();
const env = process.env;
const V = env.META_GRAPH_VERSION || 'v27.0';
const APP_ORIGIN = env.APP_ORIGIN || 'https://osher-agent-ios.onrender.com';

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', APP_ORIGIN);
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

async function graph(path, token, opts = {}) {
  const url = `https://graph.facebook.com/${V}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token || '')}`;
  const response = await fetch(url, opts);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json?.error?.message || `Meta HTTP ${response.status}`);
  return json;
}

app.get('/health', (req, res) => res.json({ ok: true, service: 'osher-agent' }));

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
        throw new Error('WhatsApp Business API is not configured');
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

    if (action.type === 'facebook_post') {
      if (!env.FACEBOOK_PAGE_ACCESS_TOKEN || !env.FACEBOOK_PAGE_ID) {
        throw new Error('Facebook Page API is not configured');
      }
      const body = new URLSearchParams({ message: action.message });
      const json = await graph(`${env.FACEBOOK_PAGE_ID}/feed`, env.FACEBOOK_PAGE_ACCESS_TOKEN, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body
      });
      return res.json({ ok: true, result: json });
    }

    if (action.type === 'instagram_photo') {
      if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_USER_ID) {
        throw new Error('Instagram API is not configured');
      }
      const createBody = new URLSearchParams({
        image_url: action.imageUrl,
        caption: action.caption || ''
      });
      const container = await graph(`${env.INSTAGRAM_USER_ID}/media`, env.INSTAGRAM_ACCESS_TOKEN, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: createBody
      });
      const publishBody = new URLSearchParams({ creation_id: container.id });
      const published = await graph(`${env.INSTAGRAM_USER_ID}/media_publish`, env.INSTAGRAM_ACCESS_TOKEN, {
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