import * as DB from './db.js';
import { ICON } from './icons.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderRepository } from './modules/repository.js';
import { renderOrganization } from './modules/organization.js';
import { renderChangeRequests } from './modules/changeRequests.js';
import { renderApprovals } from './modules/approvals.js';
import { renderVersionControl } from './modules/versionControl.js';
import { renderAssistant } from './modules/assistant.js';
import { renderSimple } from './modules/simple.js';
import { renderInsights } from './modules/insights.js';
import { renderAccess } from './modules/access.js';
import { renderSettings } from './modules/settings.js';
import { renderJobTitles } from './modules/jobTitles.js';
import { renderProcesses } from './modules/flow.js';
import { renderCampaigns } from './modules/campaigns.js';
import { renderRisks } from './modules/risks.js';
import { renderBenchmarks } from './modules/benchmarks.js';
import { renderMyWork } from './modules/myWork.js';
import { renderAdmin } from './modules/admin.js';
import { renderProcessArch } from './modules/processArch.js';
import { renderDOA } from './modules/doa.js';
import { renderPositions } from './modules/positions.js';
import { renderRequirements } from './modules/requirements.js';
import { renderAuditCapa } from './modules/auditCapa.js';
import { renderNotifications, computeNotifications } from './modules/notifications.js';
import { renderCreateArtifact } from './modules/createArtifact.js';
import { renderSearch } from './modules/search.js';
import { renderReports } from './modules/reports.js';
import { renderRelationships } from './modules/relationships.js';
import { renderEvidence } from './modules/evidenceCampaigns.js';
import { renderRegChanges } from './modules/regChanges.js';
import { renderTraining } from './modules/training.js';
import { renderOrgScenario } from './modules/orgScenario.js';
import { renderIntegrations } from './modules/integrations.js';

export const state = { settings:{theme:'light',lang:'en'}, meta:{}, cache:{} };

// ---------- helpers exposed globally to modules ----------
export const H = {
  esc:(s)=> String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  fmtDate:(d)=>{ if(!d) return '—'; const x=new Date(d); return isNaN(x)?d:x.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); },
  initials:(n)=> (n||'?').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase(),
  statusBadge:(s)=>{ const m={Draft:'b-slate',Review:'b-amber',Released:'b-amber','HOD Review':'b-amber','Executive Review':'b-blue',Submitted:'b-amber',Approved:'b-green',Active:'b-green',Rejected:'b-red',Superseded:'b-violet',Archived:'b-slate',Pending:'b-amber',Open:'b-blue','In Review':'b-amber',Planned:'b-violet',Vacant:'b-red',Filled:'b-green'}; return `<span class="badge ${m[s]||'b-slate'}">${H.esc(s)}</span>`; },
  riskBadge:(r)=>{ const m={Low:'b-green',Medium:'b-amber',High:'b-red'}; return `<span class="badge ${m[r]||'b-slate'}">${H.esc(r)} risk</span>`; },
  toast, modal, closeModal, confirmDialog, uid, go
};

function uid(pfx){ return pfx+'-'+Math.random().toString(36).slice(2,7).toUpperCase(); }

let toastTimer;
function toast(msg){
  const root=document.getElementById('toast-root');
  const t=document.createElement('div'); t.className='toast';
  t.innerHTML=`${ICON('check')}<span>${H.esc(msg)}</span>`;
  root.appendChild(t);
  setTimeout(()=>t.remove(),2800);
}

function modal({title, body, footer, size=''}){
  const root=document.getElementById('modal-root');
  root.innerHTML=`<div class="modal-overlay" id="mo">
    <div class="modal ${size}">
      <div class="modal-head"><h3>${H.esc(title)}</h3><button class="tbtn" id="mclose">${ICON('x')}</button></div>
      <div class="modal-body">${body}</div>
      ${footer?`<div class="modal-foot">${footer}</div>`:''}
    </div></div>`;
  document.getElementById('mclose').onclick=closeModal;
  document.getElementById('mo').onclick=(e)=>{ if(e.target.id==='mo') closeModal(); };
  return root;
}
function closeModal(){ document.getElementById('modal-root').innerHTML=''; }

function confirmDialog(msg, onYes){
  modal({title:'Please confirm', body:`<p>${H.esc(msg)}</p>`,
    footer:`<button class="btn" id="cno">Cancel</button><button class="btn danger" id="cyes">Confirm</button>`});
  document.getElementById('cno').onclick=closeModal;
  document.getElementById('cyes').onclick=()=>{ closeModal(); onYes(); };
}

function go(hash){ location.hash = hash; }

// ---------- navigation ----------
const WORKSPACES = [
  {id:'ws-gov', name:'Governance Center', icon:'grid', items:[
    {id:'', label:'Command Center', icon:'grid'},
    {id:'insights', label:'AI Insights', icon:'spark'},
  ]},
  {id:'ws-docproc', name:'Document & Process Management', icon:'book', items:[
    {id:'create', label:'Create Artifact', icon:'plus'},
    {id:'repository', label:'Repository', icon:'book'},
    {id:'process-arch', label:'Process Architecture', icon:'layers'},
    {id:'processes', label:'Process Flows', icon:'flow'},
    {id:'raci', label:'RACI Matrix', icon:'table'},
    {id:'version-control', label:'Version Control', icon:'git'},
    {id:'taxonomy', label:'Taxonomy', icon:'tag'},
    {id:'forms', label:'Forms', icon:'form'},
    {id:'capabilities', label:'Capabilities', icon:'layers'},
  ]},
  {id:'ws-mywork', name:'My Governance Work', icon:'clipboard', items:[
    {id:'my-work', label:'My Work', icon:'clipboard'},
    {id:'notifications', label:'Notifications', icon:'bell'},
  ]},
  {id:'ws-compliance', name:'Compliance & Assurance', icon:'shield', items:[
    {id:'requirements', label:'Requirements', icon:'book'},
    {id:'risks', label:'Risk & Controls', icon:'alert'},
    {id:'audit-capa', label:'Audit & CAPA', icon:'check'},
    {id:'change-requests', label:'Change Requests', icon:'edit'},
    {id:'approvals', label:'Approvals', icon:'check'},
    {id:'evidence', label:'Evidence Requests', icon:'clipboard'},
    {id:'reg-changes', label:'Regulatory Change', icon:'book'},
    {id:'training', label:'Training & Awareness', icon:'award'},
    {id:'campaigns', label:'Acknowledgements', icon:'clipboard'},
    {id:'audit', label:'Audit Activity', icon:'shield'},
    {id:'opportunities', label:'Opportunities', icon:'target'},
  ]},
  {id:'ws-org', name:'Organization & Accountability', icon:'org', items:[
    {id:'organization', label:'Organization', icon:'org'},
    {id:'positions', label:'Positions', icon:'org'},
    {id:'org-scenario', label:'Scenario Planning', icon:'flow'},
    {id:'job-titles', label:'Job Titles', icon:'user'},
    {id:'doa', label:'Delegation of Authority', icon:'key'},
    {id:'access', label:'Access & Roles', icon:'key'},
  ]},
  {id:'ws-intel', name:'Intelligence & Reporting', icon:'chat', items:[
    {id:'search', label:'Search', icon:'search'},
    {id:'reports', label:'Dashboards', icon:'grid'},
    {id:'relationships', label:'Relationship Explorer', icon:'graph'},
    {id:'impact-analysis', label:'Impact Analysis', icon:'flow'},
    {id:'assistant', label:'Governance Smart Search', icon:'chat'},
    {id:'benchmarks', label:'Industry Benchmarks', icon:'award'},
    {id:'announcements', label:'Announcements', icon:'bell'},
  ]},
  {id:'ws-admin', name:'Administration', icon:'cog', items:[
    {id:'admin', label:'Administration', icon:'cog'},
    {id:'integrations', label:'Integrations & SSO', icon:'key'},
    {id:'settings', label:'Settings', icon:'cog'},
  ]},
];
function navLookup(routeId){
  for(const ws of WORKSPACES){ for(const it of ws.items){ if(it.id===routeId) return {ws, item:it}; } }
  return null;
}
// recently viewed + favorites (local UI convenience)
const LSR='govos-recents', LSF='govos-favs';
function getRecents(){ try{return JSON.parse(localStorage.getItem(LSR))||[];}catch(e){return[];} }
function pushRecent(hash,label){ if(!label) return; let r=getRecents().filter(x=>x.hash!==hash); r.unshift({hash,label}); r=r.slice(0,8); localStorage.setItem(LSR,JSON.stringify(r)); }
function getFavs(){ try{return JSON.parse(localStorage.getItem(LSF))||[];}catch(e){return[];} }
function toggleFav(hash,label){ let f=getFavs(); if(f.some(x=>x.hash===hash)) f=f.filter(x=>x.hash!==hash); else f.push({hash,label}); localStorage.setItem(LSF,JSON.stringify(f)); return f; }
export { getRecents, getFavs };

const ROUTES = {
  '': renderDashboard,
  'insights': renderInsights,
  'create': renderCreateArtifact,
  'repository': renderRepository,
  'processes': renderProcesses,
  'version-control': renderVersionControl,
  'taxonomy': (c)=>renderSimple(c,'taxonomy'),
  'forms': (c)=>renderSimple(c,'forms'),
  'organization': renderOrganization,
  'job-titles': renderJobTitles,
  'raci': (c)=>renderSimple(c,'raci'),
  'capabilities': (c)=>renderSimple(c,'capabilities'),
  'change-requests': renderChangeRequests,
  'approvals': renderApprovals,
  'campaigns': renderCampaigns,
  'my-work': renderMyWork,
  'notifications': renderNotifications,
  'admin': renderAdmin,
  'process-arch': renderProcessArch,
  'doa': renderDOA,
  'positions': renderPositions,
  'requirements': renderRequirements,
  'audit-capa': renderAuditCapa,
  'evidence': renderEvidence,
  'reg-changes': renderRegChanges,
  'training': renderTraining,
  'org-scenario': renderOrgScenario,
  'integrations': renderIntegrations,
  'opportunities': (c)=>renderSimple(c,'opportunities'),
  'announcements': (c)=>renderSimple(c,'announcements'),
  'risks': renderRisks,
  'benchmarks': renderBenchmarks,
  'assistant': renderAssistant,
  'search': renderSearch,
  'reports': renderReports,
  'relationships': renderRelationships,
  'knowledge-graph': renderRelationships,
  'impact-analysis': (c)=>renderSimple(c,'impact-analysis'),
  'audit': (c)=>renderSimple(c,'audit'),
  'access': renderAccess,
  'settings': renderSettings,
};

function renderCrumb(active, params){
  const el = document.getElementById('crumb'); if(!el) return;
  const cur = navLookup(active);
  const wsName = cur ? cur.ws.name : '';
  const label = cur ? cur.item.label : (active||'Home');
  const hash = location.hash || '#/';
  const fav = getFavs().some(x=>x.hash===hash);
  el.innerHTML = `<div class="crumb-path">${ICON('grid',14)}<span>${H.esc(wsName)}</span>${wsName?'<span class="sep">/</span>':''}<b>${H.esc(label)}</b>${params&&params[0]?`<span class="sep">/</span><span class="mono">${H.esc(params[0])}</span>`:''}</div>
    <button class="crumb-fav ${fav?'on':''}" title="Add to favorites">★</button>`;
  el.querySelector('.crumb-fav').onclick=()=>{ toggleFav(hash,(wsName?wsName+' / ':'')+label); renderCrumb(active,params); };
  pushRecent(hash, (wsName?wsName+' / ':'')+label);
}

function renderSidebar(active){
  const cur = navLookup(active);
  const openWs = cur ? cur.ws.id : 'ws-gov';
  const nav = WORKSPACES.map(ws=>{
    const open = ws.id===openWs;
    return `<div class="nav-ws ${open?'open':''}">
      <button class="nav-ws-head">${ICON(ws.icon)}<span>${ws.name}</span><span class="caret">▾</span></button>
      <div class="nav-ws-items">
        ${ws.items.map(it=>`<a href="#/${it.id}" class="${active===it.id?'active':''}">${ICON(it.icon)}<span>${it.label}</span></a>`).join('')}
      </div>
    </div>`;
  }).join('');
  document.getElementById('sidebar').innerHTML=`
    <div class="brand"><div class="logo">G</div><div><div class="bt">Governance OS</div><div class="bs">Ahmad A. Abed Holding</div></div></div>
    <div class="nav">${nav}</div>`;
  document.querySelectorAll('.nav-ws-head').forEach(b=> b.onclick=()=> b.closest('.nav-ws').classList.toggle('open'));
}

function renderTopbar(){
  const t=document.getElementById('topbar');
  t.innerHTML=`
    <button class="tbtn" id="menu-toggle" style="display:none">${ICON('menu')}</button>
    <div class="search">
      <span class="si">${ICON('search')}</span>
      <input id="global-search" placeholder="Search policies, SOPs, people, change requests…" autocomplete="off"/>
    </div>
    <span class="demo-pill" title="Seeded content is demonstration data and must be validated by the responsible department before operational use.">Demo data</span>
    <div class="spacer"></div>
    <div class="qc-wrap">
      <button class="btn primary sm" id="quick-create">${ICON('plus',15)} Create</button>
      <div class="qc-menu" id="qc-menu">
        <a href="#/create">${ICON('book',15)} New document</a>
        <a href="#/processes">${ICON('flow',15)} New process</a>
        <a href="#/risks">${ICON('alert',15)} New risk</a>
        <a href="#/forms">${ICON('form',15)} New form</a>
        <a href="#/organization">${ICON('org',15)} New employee</a>
        <a href="#/campaigns">${ICON('clipboard',15)} New acknowledgement</a>
      </div>
    </div>
    <button class="tbtn" id="theme-toggle" title="Toggle theme">${ICON(state.settings.theme==='dark'?'sun':'moon')}</button>
    <button class="tbtn" id="lang-toggle" title="Toggle language">${state.settings.lang==='en'?'ع':'EN'}</button>
    <button class="tbtn" id="notif" title="Notifications">${ICON('bell')}<span class="dot" id="notif-count" style="display:none"></span></button>
    <div class="user-chip" title="${H.esc((state.user&&state.user.name)||'')} · ${H.esc((state.user&&state.user.role)||'')}">
      <div class="avatar">${H.initials((state.user&&state.user.name)||'?')}</div>
      <div class="user-meta"><div class="un">${H.esc((state.user&&state.user.name)||'')}</div><div class="ur">${H.esc((state.user&&state.user.role)||'')}</div></div>
    </div>
    <button class="tbtn" id="logout" title="Sign out">${ICON('key')}</button>`;
  document.getElementById('theme-toggle').onclick=toggleTheme;
  document.getElementById('lang-toggle').onclick=toggleLang;
  document.getElementById('notif').onclick=()=>go('#/notifications');
  document.getElementById('logout').onclick=async()=>{ await DB.logout(); location.reload(); };
  const qc=document.getElementById('quick-create'), qcm=document.getElementById('qc-menu');
  qc.onclick=(e)=>{ e.stopPropagation(); qcm.classList.toggle('open'); };
  qcm.querySelectorAll('a').forEach(a=> a.onclick=()=> qcm.classList.remove('open'));
  document.addEventListener('click', ()=> qcm.classList.remove('open'));
  const gs=document.getElementById('global-search');
  gs.onkeydown=(e)=>{ if(e.key==='Enter' && gs.value.trim()){ sessionStorage.setItem('q',gs.value.trim()); go('#/search'); } };
}

async function toggleTheme(){
  state.settings.theme = state.settings.theme==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',state.settings.theme);
  await DB.saveSettings(state.settings); renderTopbar();
}
async function toggleLang(){
  state.settings.lang = state.settings.lang==='en'?'ar':'en';
  document.documentElement.setAttribute('dir', state.settings.lang==='ar'?'rtl':'ltr');
  document.documentElement.setAttribute('lang', state.settings.lang);
  await DB.saveSettings(state.settings); renderTopbar();
}

// ---------- router ----------
async function router(){
  const hash = location.hash.replace(/^#\/?/,'');
  const key = hash.split('/')[0];
  const active = key;
  const params = hash.split('/').slice(1);
  renderSidebar(active);
  renderCrumb(active, params);
  const container = document.getElementById('view');
  const fn = ROUTES[key] || (()=> container.innerHTML=`<div class="empty"><div class="ic">🔍</div><h2>Not found</h2><p>This module doesn't exist yet.</p></div>`);
  closeModal();
  container.innerHTML='';
  window.scrollTo(0,0);
  try{ await fn(container, hash.split('/').slice(1)); }
  catch(err){ console.error(err); container.innerHTML=`<div class="empty"><div class="ic">⚠️</div><h2>Something went wrong</h2><p>${H.esc(err.message)}</p></div>`; }
}

// ---------- login ----------
function renderLogin(msg){
  const el = document.getElementById('app-loading');
  el.classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  el.innerHTML = `
  <div class="login-card">
    <div class="login-brand"><div class="logo">G</div><div><div class="bt">Governance OS</div><div class="bs">Ahmad A. Abed Holding</div></div></div>
    <h2>Sign in</h2>
    <p class="muted" style="margin-top:0">Use your AAA account to continue.</p>
    <form id="login-form">
      <div class="field"><label>Email</label><input class="input" id="li-email" type="email" autocomplete="username" placeholder="name@aaabed.com" required/></div>
      <div class="field"><label>Password</label><input class="input" id="li-pass" type="password" autocomplete="current-password" required/></div>
      <div id="li-err" class="login-err"></div>
      <button class="btn primary" id="li-btn" type="submit" style="width:100%;justify-content:center">Sign in</button>
    </form>
    <div class="login-hint">Demo accounts (password <b>AAA@govos2026</b>): <b>asif@aaabed.com</b> (Admin), <b>m.abed@aaabed.com</b> (Executive), <b>k.alduwayk@aaabed.com</b> (HOD), <b>author@aaabed.com</b> (Author), <b>viewer@aaabed.com</b> (Viewer)</div>
  </div>`;
  if(msg) document.getElementById('li-err').textContent = msg;
  document.getElementById('login-form').onsubmit = async (e)=>{
    e.preventDefault();
    const btn=document.getElementById('li-btn'); btn.disabled=true; btn.textContent='Signing in…';
    try{
      await DB.login(document.getElementById('li-email').value.trim(), document.getElementById('li-pass').value);
      await startApp();
    }catch(err){
      document.getElementById('li-err').textContent = err.message || 'Sign in failed';
      btn.disabled=false; btn.textContent='Sign in';
    }
  };
}

// ---------- boot ----------
async function boot(){
  window.__govNotify = (m)=> toast(m);
  window.__govAuthExpired = ()=> renderLogin('Your session expired — please sign in again.');
  try{ await DB.openDB(); }
  catch(e){
    if(e.code==='AUTH'){ renderLogin(); return; }
    document.getElementById('app-loading').innerHTML=`<div style="text-align:center;max-width:440px;padding:24px"><h2>Can't reach the server</h2><p style="color:#647067">${H.esc(e.message||'')}. Make sure the Governance OS server is running, then reload.</p><button onclick="location.reload()" class="btn primary" style="margin-top:10px">Reload</button></div>`;
    return;
  }
  await startApp();
}

async function startApp(){
  state.user = DB.getCurrentUser();
  window.__govUser = state.user;
  state.settings = await DB.getSettings();
  state.meta = await DB.getMeta();
  document.documentElement.setAttribute('data-theme', state.settings.theme||'light');
  document.documentElement.setAttribute('dir', state.settings.lang==='ar'?'rtl':'ltr');
  document.documentElement.setAttribute('lang', state.settings.lang||'en');
  renderTopbar();
  window.removeEventListener('hashchange', router);
  window.addEventListener('hashchange', router);
  if(!location.hash) location.hash='#/';
  await router();
  const load=document.getElementById('app-loading'); load.classList.add('hidden'); load.innerHTML='';
  document.getElementById('app').classList.remove('hidden');
  updateNotifBadge();
}

async function updateNotifBadge(){
  try{
    const n = await computeNotifications();
    const el = document.getElementById('notif-count'); if(!el) return;
    if(n.length){ el.textContent = n.length>9?'9+':String(n.length); el.style.display='flex'; } else el.style.display='none';
  }catch(e){}
}
boot();
