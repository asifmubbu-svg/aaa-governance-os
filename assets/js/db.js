// Data-access layer — talks to the Governance OS server API.
// Keeps the same interface the modules already use (getAll/get/add/put/del/getMeta/...),
// so switching from browser storage to the shared server required no module changes.

export const STORES = [
  'employees','entities','domains','documents','changeRequests','approvals',
  'announcements','auditEvents','capabilities','opportunities','raci','acknowledgments',
  'roles','vacancies','risks','controls','campaigns','forms','documentVersions','processes','doa','positions','jobProfiles','requirements','findings',
  'evidenceRequests','regChanges','trainings','trainingRecords'
];

let _user = null;
let _reference = {};
let _config = null;

class AuthError extends Error { constructor(){ super('Not authenticated'); this.code='AUTH'; } }

async function req(method, url, body){
  const opt = { method, credentials:'same-origin', headers:{} };
  if(body !== undefined){ opt.headers['Content-Type']='application/json'; opt.body=JSON.stringify(body); }
  const res = await fetch(url, opt);
  if(res.status === 401){ _user=null; if(window.__govAuthExpired) window.__govAuthExpired(); throw new AuthError(); }
  if(res.status === 403){ const e=await res.json().catch(()=>({error:'Forbidden'})); if(window.__govNotify) window.__govNotify(e.error||'You do not have permission for this action'); throw new Error(e.error||'Forbidden'); }
  if(!res.ok){ const e=await res.json().catch(()=>({error:res.statusText})); throw new Error(e.error||('HTTP '+res.status)); }
  if(res.status === 204) return null;
  return res.json();
}

// ---- lifecycle expected by app.js ----
export async function openDB(){
  // establishes session context; throws AuthError if not logged in (app shows login)
  const data = await req('GET','/api/bootstrap');
  _user = data.user; _reference = data.reference || {}; _config = data.config || {};
  return true;
}
export async function seed(){ /* server seeds on boot — no-op */ }
export async function isSeeded(){ return true; }

// ---- auth ----
export async function login(email, password){
  const r = await req('POST','/api/login',{ email, password });
  _user = r.user; return r.user;
}
export async function logout(){ try{ await req('POST','/api/logout'); }catch(e){} _user=null; }
export function getCurrentUser(){ return _user; }

// ---- generic collection API ----
export async function getAll(store){ return req('GET','/api/'+store); }
export async function get(store, id){ return req('GET','/api/'+store+'/'+id); }
export async function add(store, obj){ const r = await req('POST','/api/'+store, obj); if(r && r._id!=null) obj._id=r._id; return r; }
export async function put(store, obj){ return req('PUT','/api/'+store+'/'+obj._id, obj); }
export async function del(store, id){ return req('DELETE','/api/'+store+'/'+id); }
export async function clearStore(){ /* not exposed to clients; use resetAll */ }

// ---- reference data (departments, docTypes, grades, competencies, etc.) ----
export async function getMeta(){ if(!_reference || !Object.keys(_reference).length){ _reference = await req('GET','/api/reference'); } return _reference; }

// ---- UI settings kept locally (theme, language, AI key) ----
const SKEY='govos-settings';
export async function getSettings(){
  try{ const s=JSON.parse(localStorage.getItem(SKEY)); if(s) return s; }catch(e){}
  return { theme:'light', lang:'en', aiKey:'', aiProvider:'anthropic' };
}
export async function saveSettings(s){ localStorage.setItem(SKEY, JSON.stringify(s)); }

// ---- controlled-document lifecycle ----
export async function submitDoc(id, justification){ return req('POST','/api/documents/'+id+'/submit',{ justification }); }
export async function decideDoc(id, action, comment){ return req('POST','/api/documents/'+id+'/decision',{ action, comment }); }
export async function cancelDoc(id){ return req('POST','/api/documents/'+id+'/cancel',{}); }
export async function withdrawDoc(id, comment){ return req('POST','/api/documents/'+id+'/withdraw',{ comment }); }
export async function rollbackDoc(id, version){ return req('POST','/api/documents/'+id+'/rollback',{ version }); }
export async function getVersions(id){ return req('GET','/api/documents/'+id+'/versions'); }

// ---- configuration (document types, statuses, workflows, scales) ----
export async function getConfig(){ if(!_config){ _config = await req('GET','/api/config'); } return _config; }
export async function saveConfig(c){ await req('PUT','/api/config', c); _config = c; }

// ---- admin ----
export async function resetAll(){ return req('POST','/api/admin/reset'); }

// ---- AI assistant ----
export async function aiStatus(){ try{ return await req('GET','/api/ai/status'); }catch(e){ return { configured:false }; } }
export async function aiAsk(question){ return req('POST','/api/ai/ask',{ question }); }
export async function verifyAudit(){ return req('GET','/api/audit/verify'); }
