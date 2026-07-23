// Persistent shared storage for Governance OS.
// Dual backend behind one async interface:
//   - Local dev / no DATABASE_URL  -> Node's built-in SQLite (node:sqlite), file on disk.
//   - Production (DATABASE_URL set) -> PostgreSQL (Neon) via `pg`.
// The generic document-style store keeps the API 1:1 with the client model.
const path = require('path');
const fs = require('fs');

let B = null;          // resolved backend
let readyP = null;     // init promise
let injectedPool = null; // for tests (pg-mem)

function _useInjectedPg(pool){ injectedPool = pool; }

async function build(){
  if (injectedPool) return await buildPg(null);
  if (process.env.DATABASE_URL) return await buildPg(process.env.DATABASE_URL);
  return buildSqlite();
}
async function ensure(){ if (B) return B; if (!readyP) readyP = build(); B = await readyP; return B; }
async function ready(){ return ensure(); }

// ---------------------------------------------------------------- SQLite backend
function buildSqlite(){
  const { DatabaseSync } = require('node:sqlite');
  const DB_PATH = process.env.GOV_DB || path.join(__dirname, '..', 'data', 'governance.db');
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  try { db.exec('PRAGMA journal_mode = WAL;'); } catch (e) { /* rollback journal */ }
  db.exec(`CREATE TABLE IF NOT EXISTS records(
    id INTEGER PRIMARY KEY AUTOINCREMENT, collection TEXT NOT NULL, data TEXT NOT NULL);`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection);');
  db.exec(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    role TEXT NOT NULL, password_hash TEXT NOT NULL, employee_id TEXT, created_at TEXT);`);
  db.exec('CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);');
  const hy = (row)=>{ const o = JSON.parse(row.data); o._id = row.id; return o; };
  return {
    kind: 'sqlite', DB_PATH,
    store: {
      async all(c){ return db.prepare('SELECT id,data FROM records WHERE collection=? ORDER BY id').all(c).map(hy); },
      async get(c, id){ const r = db.prepare('SELECT id,data FROM records WHERE collection=? AND id=?').get(c, Number(id)); return r ? hy(r) : null; },
      async add(c, obj){ const clean = { ...obj }; delete clean._id; const r = db.prepare('INSERT INTO records(collection,data) VALUES(?,?)').run(c, JSON.stringify(clean)); return { ...clean, _id: Number(r.lastInsertRowid) }; },
      async addMany(c, arr){ const st = db.prepare('INSERT INTO records(collection,data) VALUES(?,?)'); for (const o of arr){ const clean = { ...o }; delete clean._id; st.run(c, JSON.stringify(clean)); } },
      async put(c, id, obj){ const clean = { ...obj }; delete clean._id; const ex = db.prepare('SELECT id FROM records WHERE collection=? AND id=?').get(c, Number(id)); if (ex){ db.prepare('UPDATE records SET data=? WHERE collection=? AND id=?').run(JSON.stringify(clean), c, Number(id)); return { ...clean, _id: Number(id) }; } return this.add(c, obj); },
      async del(c, id){ db.prepare('DELETE FROM records WHERE collection=? AND id=?').run(c, Number(id)); return true; },
      async clear(c){ db.prepare('DELETE FROM records WHERE collection=?').run(c); },
      async count(c){ return db.prepare('SELECT COUNT(*) c FROM records WHERE collection=?').get(c).c; },
    },
    meta: {
      async get(k){ const r = db.prepare('SELECT value FROM meta WHERE key=?').get(k); return r ? JSON.parse(r.value) : null; },
      async set(k, v){ db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, JSON.stringify(v)); },
    },
    users: {
      async byEmail(email){ return db.prepare('SELECT * FROM users WHERE email=?').get(String(email).toLowerCase()) || null; },
      async byId(id){ return db.prepare('SELECT * FROM users WHERE id=?').get(Number(id)) || null; },
      async all(){ return db.prepare('SELECT id,email,name,role,employee_id,created_at FROM users ORDER BY id').all(); },
      async add({ email, name, role, password_hash, employee_id }){ const r = db.prepare('INSERT INTO users(email,name,role,password_hash,employee_id,created_at) VALUES(?,?,?,?,?,?)').run(String(email).toLowerCase(), name, role, password_hash, employee_id || null, new Date().toISOString()); return Number(r.lastInsertRowid); },
      async count(){ return db.prepare('SELECT COUNT(*) c FROM users').get().c; },
      async setPassword(id, h){ db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(h, Number(id)); },
    },
  };
}

// ---------------------------------------------------------------- Postgres backend
async function buildPg(url){
  const pool = injectedPool || new (require('pg').Pool)({
    connectionString: url,
    ssl: (url && !/localhost|127\.0\.0\.1|sslmode=disable/.test(url)) ? { rejectUnauthorized: false } : false,
    max: 5,
  });
  await pool.query(`CREATE TABLE IF NOT EXISTS records(id BIGSERIAL PRIMARY KEY, collection TEXT NOT NULL, data JSONB NOT NULL)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS users(id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, employee_id TEXT, created_at TEXT)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value JSONB)`);
  const asObj = (v)=> (v && typeof v === 'string') ? JSON.parse(v) : v;
  const hy = (r)=>({ ...asObj(r.data), _id: Number(r.id) });
  return {
    kind: 'postgres', pool,
    store: {
      async all(c){ const { rows } = await pool.query('SELECT id,data FROM records WHERE collection=$1 ORDER BY id', [c]); return rows.map(hy); },
      async get(c, id){ const { rows } = await pool.query('SELECT id,data FROM records WHERE collection=$1 AND id=$2', [c, Number(id)]); return rows[0] ? hy(rows[0]) : null; },
      async add(c, obj){ const clean = { ...obj }; delete clean._id; const { rows } = await pool.query('INSERT INTO records(collection,data) VALUES($1,$2) RETURNING id', [c, JSON.stringify(clean)]); return { ...clean, _id: Number(rows[0].id) }; },
      async addMany(c, arr){ if (!arr.length) return; const CH = 500; for (let i = 0; i < arr.length; i += CH){ const chunk = arr.slice(i, i + CH); const vals = []; const params = []; chunk.forEach((o, j)=>{ const clean = { ...o }; delete clean._id; params.push(c, JSON.stringify(clean)); vals.push(`($${j*2+1},$${j*2+2})`); }); await pool.query(`INSERT INTO records(collection,data) VALUES ${vals.join(',')}`, params); } },
      async put(c, id, obj){ const clean = { ...obj }; delete clean._id; const { rowCount } = await pool.query('UPDATE records SET data=$1 WHERE collection=$2 AND id=$3', [JSON.stringify(clean), c, Number(id)]); if (rowCount) return { ...clean, _id: Number(id) }; return this.add(c, obj); },
      async del(c, id){ await pool.query('DELETE FROM records WHERE collection=$1 AND id=$2', [c, Number(id)]); return true; },
      async clear(c){ await pool.query('DELETE FROM records WHERE collection=$1', [c]); },
      async count(c){ const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM records WHERE collection=$1', [c]); return rows[0].c; },
    },
    meta: {
      async get(k){ const { rows } = await pool.query('SELECT value FROM meta WHERE key=$1', [k]); return rows[0] ? asObj(rows[0].value) : null; },
      async set(k, v){ await pool.query('INSERT INTO meta(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [k, JSON.stringify(v)]); },
    },
    users: {
      async byEmail(email){ const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [String(email).toLowerCase()]); return rows[0] || null; },
      async byId(id){ const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [Number(id)]); return rows[0] || null; },
      async all(){ const { rows } = await pool.query('SELECT id,email,name,role,employee_id,created_at FROM users ORDER BY id'); return rows; },
      async add({ email, name, role, password_hash, employee_id }){ const { rows } = await pool.query('INSERT INTO users(email,name,role,password_hash,employee_id,created_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [String(email).toLowerCase(), name, role, password_hash, employee_id || null, new Date().toISOString()]); return Number(rows[0].id); },
      async count(){ const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users'); return rows[0].c; },
      async setPassword(id, h){ await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [h, Number(id)]); },
    },
  };
}

// ---------------------------------------------------------------- async facade
const store = {
  all:   async (c)      => (await ensure()).store.all(c),
  get:   async (c, id)  => (await ensure()).store.get(c, id),
  add:   async (c, o)   => (await ensure()).store.add(c, o),
  addMany: async (c, a) => (await ensure()).store.addMany(c, a),
  put:   async (c, id, o) => (await ensure()).store.put(c, id, o),
  del:   async (c, id)  => (await ensure()).store.del(c, id),
  clear: async (c)      => (await ensure()).store.clear(c),
  count: async (c)      => (await ensure()).store.count(c),
};
const meta = {
  get: async (k)    => (await ensure()).meta.get(k),
  set: async (k, v) => (await ensure()).meta.set(k, v),
};
const users = {
  byEmail: async (e)  => (await ensure()).users.byEmail(e),
  byId:    async (id) => (await ensure()).users.byId(id),
  all:     async ()   => (await ensure()).users.all(),
  add:     async (u)  => (await ensure()).users.add(u),
  count:   async ()   => (await ensure()).users.count(),
  setPassword: async (id, h) => (await ensure()).users.setPassword(id, h),
};

module.exports = { store, meta, users, ready, _useInjectedPg };
