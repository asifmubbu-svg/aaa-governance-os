const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { users } = require('./store');

const SECRET = process.env.GOV_SECRET || 'aaa-governance-os-dev-secret-change-me';
const COOKIE = 'gov_token';
const RANK = { Viewer: 1, Author: 2, HOD: 3, Executive: 4, Admin: 5 };

function hash(pw){ return bcrypt.hashSync(pw, 10); }
function sign(user){ return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, SECRET, { expiresIn: '12h' }); }

async function login(email, password){
  const u = await users.byEmail(email);
  if(!u || !bcrypt.compareSync(password, u.password_hash)) return null;
  return u;
}

function setCookie(res, token){
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: 12*3600*1000 });
}
function clearCookie(res){ res.clearCookie(COOKIE); }

function currentUser(req){
  const token = req.cookies && req.cookies[COOKIE];
  if(!token) return null;
  try{ return jwt.verify(token, SECRET); }catch(e){ return null; }
}

function requireAuth(req, res, next){
  const u = currentUser(req);
  if(!u) return res.status(401).json({ error: 'Not authenticated' });
  req.user = u; next();
}
function requireRole(minRole){
  const min = RANK[minRole] || 99;
  return (req, res, next)=>{
    if(!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if((RANK[req.user.role] || 0) < min) return res.status(403).json({ error: `Requires ${minRole} role` });
    next();
  };
}
function rank(role){ return RANK[role] || 0; }

module.exports = { hash, sign, login, setCookie, clearCookie, currentUser, requireAuth, requireRole, rank, RANK, COOKIE };
