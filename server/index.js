const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { store, meta, users, ready } = require('./store');
const auth = require('./auth');
const ai = require('./ai');
const auditLog = require('./audit');
const { seedAll, RECORD_COLLECTIONS } = require('./seed');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 4000;

const app = express();
app.set('trust proxy', 1); // behind Render's TLS proxy: needed for secure cookies + real client IP
// Security headers (HSTS, no-sniff, frameguard, etc.). CSP is disabled because the
// SPA loads local ES modules and a CDN; other protections stay on.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// CSRF defence for cookie-auth: reject cross-origin state-changing requests.
// Browsers always send Origin on fetch; same-origin passes, other origins are blocked.
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const src = req.get('origin') || req.get('referer');
    if (src) { try { if (new URL(src).host !== req.get('host')) return res.status(403).json({ error: 'Cross-origin request blocked' }); } catch (e) {} }
  }
  next();
});

// Rate limiting: strict on login (brute-force), generous on the rest of the API.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many login attempts, try again later' } });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 800, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);

// collections that any authenticated user (incl. Viewer) may append to
const APPEND_ANY = new Set(['acknowledgments', 'auditEvents']);
const WRITABLE = new Set([...RECORD_COLLECTIONS, 'acknowledgments', 'forms']);

// health check (used by hosting platform)
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ---------------- auth ----------------
app.post('/api/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const u = await auth.login(email, password);
  if (!u) return res.status(401).json({ error: 'Invalid email or password' });
  auth.setCookie(res, auth.sign(u));
  res.json({ user: { id: u.id, email: u.email, name: u.name, role: u.role } });
});
app.post('/api/logout', (req, res) => { auth.clearCookie(res); res.json({ ok: true }); });
app.get('/api/me', (req, res) => {
  const u = auth.currentUser(req);
  if (!u) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: u });
});
app.get('/api/bootstrap', auth.requireAuth, async (req, res) => {
  res.json({ user: req.user, reference: (await meta.get('reference')) || {}, config: (await meta.get('config')) || {} });
});
app.get('/api/reference', auth.requireAuth, async (req, res) => res.json((await meta.get('reference')) || {}));
app.get('/api/config', auth.requireAuth, async (req, res) => res.json((await meta.get('config')) || {}));
app.put('/api/config', auth.requireAuth, auth.requireRole('Admin'), async (req, res) => { await meta.set('config', req.body || {}); res.json({ ok: true }); });

// ---------------- controlled-document lifecycle ----------------
const docs = require('./documents');
function docAction(handler){
  return async (req, res) => {
    try {
      const d = await store.get('documents', req.params.id);
      if (!d) return res.status(404).json({ error: 'Document not found' });
      if (auth.rank(req.user.role) < auth.RANK.Author) return res.status(403).json({ error: 'Insufficient role' });
      res.json(await handler(d, req.user, req.body || {}));
    } catch (e) { res.status(e.code || 400).json({ error: e.message }); }
  };
}
app.get('/api/documents/:id/versions', auth.requireAuth, async (req, res) => { const d = await store.get('documents', req.params.id); res.json(await docs.versionsOf(d ? d.id : req.params.id)); });
app.post('/api/documents/:id/submit',   auth.requireAuth, docAction((d,u,b)=> docs.submit(d,u,b.justification)));
app.post('/api/documents/:id/decision', auth.requireAuth, docAction((d,u,b)=> docs.decide(d,u,b.action,b.comment)));
app.post('/api/documents/:id/cancel',   auth.requireAuth, docAction((d,u)=> docs.cancel(d,u)));
app.post('/api/documents/:id/withdraw', auth.requireAuth, docAction((d,u,b)=> docs.withdraw(d,u,b.comment)));
app.post('/api/documents/:id/rollback', auth.requireAuth, docAction((d,u,b)=> docs.rollback(d,u,b.version)));

// ---------------- AI assistant (grounded, Groq) ----------------
// NOTE: must be registered before the generic /api/:collection routes below.
app.get('/api/ai/status', auth.requireAuth, (req, res) => res.json({ configured: ai.isConfigured(), model: ai.MODEL }));
app.post('/api/ai/ask', auth.requireAuth, async (req, res) => {
  const q = ((req.body && req.body.question) || '').trim();
  if (!q) return res.status(400).json({ error: 'question required' });
  try { res.json(await ai.ask(q)); }
  catch (e) { res.status(502).json({ error: e.message || 'AI request failed' }); }
});

// ---------------- audit integrity ----------------
app.get('/api/audit/verify', auth.requireAuth, auth.requireRole('Admin'), async (req, res) => res.json(await auditLog.verify()));

// ---------------- generic collection API ----------------
app.get('/api/:collection', auth.requireAuth, async (req, res) => {
  res.json(await store.all(req.params.collection));
});
app.get('/api/:collection/:id', auth.requireAuth, async (req, res) => {
  const rec = await store.get(req.params.collection, req.params.id);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  res.json(rec);
});

function canWrite(req, res, collection){
  if (!WRITABLE.has(collection)) { res.status(400).json({ error: 'Unknown collection' }); return false; }
  const r = auth.rank(req.user.role);
  const minRank = APPEND_ANY.has(collection) ? 1 : 2; // Viewer may append acks/audit; else Author+
  if (r < minRank) { res.status(403).json({ error: 'Insufficient role' }); return false; }
  return true;
}

app.post('/api/:collection', auth.requireAuth, async (req, res) => {
  const c = req.params.collection;
  if (!canWrite(req, res, c)) return;
  const body = { ...req.body };
  if (c === 'acknowledgments') body.user = body.user || req.user.name;
  if (c === 'auditEvents') {                                    // integrity: server sets actor + hash-chains
    body.actor = req.user.name;
    return res.status(201).json(await auditLog.append(body));
  }
  res.status(201).json(await store.add(c, body));
});

app.put('/api/:collection/:id', auth.requireAuth, async (req, res) => {
  const c = req.params.collection;
  if (!canWrite(req, res, c)) return;
  // enforce lifecycle role gates on documents
  if (c === 'documents') {
    const prev = (await store.get('documents', req.params.id)) || {};
    const next = req.body || {};
    const r = auth.rank(req.user.role);
    const hodNow = next.approval && next.approval.hod && next.approval.hod.status === 'Approved';
    const hodWas = prev.approval && prev.approval.hod && prev.approval.hod.status === 'Approved';
    const exNow = next.approval && next.approval.exec && next.approval.exec.status === 'Approved';
    const exWas = prev.approval && prev.approval.exec && prev.approval.exec.status === 'Approved';
    const activatedNow = next.status === 'Active' && prev.status !== 'Active';
    if (hodNow && !hodWas && r < auth.RANK.HOD) return res.status(403).json({ error: 'HOD approval requires HOD role or above' });
    if (((exNow && !exWas) || activatedNow) && r < auth.RANK.Executive) return res.status(403).json({ error: 'Executive approval requires Executive role or above' });
  }
  res.json(await store.put(c, req.params.id, req.body));
});

app.delete('/api/:collection/:id', auth.requireAuth, async (req, res) => {
  const c = req.params.collection;
  if (!canWrite(req, res, c)) return;
  await store.del(c, req.params.id);
  res.json({ ok: true });
});

// ---------------- admin ----------------
app.get('/api/admin/users', auth.requireAuth, auth.requireRole('Admin'), async (req, res) => res.json(await users.all()));
app.post('/api/admin/users', auth.requireAuth, auth.requireRole('Admin'), async (req, res) => {
  const { email, name, role, password } = req.body || {};
  if (!email || !name || !role || !password) return res.status(400).json({ error: 'email, name, role, password required' });
  if (await users.byEmail(email)) return res.status(409).json({ error: 'User already exists' });
  const id = await users.add({ email, name, role, password_hash: auth.hash(password) });
  res.status(201).json({ id, email, name, role });
});
app.post('/api/admin/reset', auth.requireAuth, auth.requireRole('Admin'), async (req, res) => {
  const r = await seedAll(true);
  res.json({ ok: true, ...r });
});

// ---------------- static app (block PII seed data) ----------------
app.use('/assets/js/data', (req, res) => res.status(404).end());
app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get(/^\/(?!api|assets).*/, (req, res) => res.sendFile(path.join(ROOT, 'index.html')));

// ---------------- boot ----------------
(async () => {
  await ready();
  await seedAll();
  app.listen(PORT, async () => console.log(`Governance OS running on :${PORT}  (users: ${await users.count()}, documents: ${await store.count('documents')})`));
})().catch((e) => { console.error('Startup failed:', e); process.exit(1); });

module.exports = app;
