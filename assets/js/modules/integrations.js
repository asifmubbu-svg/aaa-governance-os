import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

// Integration config & sync log are held locally (UI/config layer). Live external
// connections (SAP, HRIS, Entra) require credentials configured by IT — this module
// provides the framework, config and a working file/paste-based employee sync.
const LSC='govos-integrations', LSL='govos-synclog';
const isAdmin = ()=> (DB.getCurrentUser&&DB.getCurrentUser()?.role)==='Admin';
const getCfg = ()=>{ try{return JSON.parse(localStorage.getItem(LSC))||{};}catch(e){return{};} };
const setCfg = (c)=> localStorage.setItem(LSC, JSON.stringify(c));
const getLog = ()=>{ try{return JSON.parse(localStorage.getItem(LSL))||[];}catch(e){return[];} };
const pushLog = (e)=>{ const l=getLog(); l.unshift({...e,at:new Date().toISOString()}); localStorage.setItem(LSL, JSON.stringify(l.slice(0,30))); };

const CONNECTORS = [
  {key:'sap', name:'SAP S/4HANA', kind:'ERP', icon:'grid', desc:'Master data, cost centres and finance postings.', fields:[['baseUrl','Base URL'],['client','Client / Mandant'],['user','Service user']]},
  {key:'hris', name:'HRIS (Workday / SuccessFactors)', kind:'HR', icon:'user', desc:'Employees, positions and org structure.', fields:[['baseUrl','Tenant URL'],['user','Integration user']]},
  {key:'entra', name:'Microsoft Entra ID (SSO)', kind:'Identity', icon:'key', desc:'Single sign-on and user provisioning (SAML / OIDC).', fields:[['tenantId','Directory (tenant) ID'],['clientId','Application (client) ID'],['redirect','Redirect URI']]},
  {key:'reg', name:'Regulatory feed', kind:'Content', icon:'book', desc:'Automated regulatory-change updates (ZATCA, SFDA, SDAIA).', fields:[['source','Feed source / URL']]},
];

export async function renderIntegrations(c){
  const cfg=getCfg();
  if(!isAdmin()){ c.innerHTML=`<div class="page-head"><div><h1>Integrations</h1></div></div><div class="empty"><p>Integration settings are restricted to Administrators.</p></div>`; return; }
  const emps=await DB.getAll('employees');
  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Administration</div><h1>Integrations &amp; SSO</h1>
    <p>Connect enterprise systems and identity. Connector settings and sync run from here; live connections require credentials provisioned by IT. Employee sync below is fully functional from a file or pasted data.</p></div></div>
  <div class="note-banner" style="margin-bottom:14px">${ICON('info',14)} Connection details are stored in this browser for configuration. Enabling a live connection is a controlled IT action and is not performed automatically.</div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
    ${CONNECTORS.map(k=>{ const s=cfg[k.key]||{}; const on=!!s.enabled;
      return `<div class="card pad">
        <div class="flex between center"><div class="flex center gap"><div class="tile-ic" style="background:color-mix(in srgb,var(--green) 12%,transparent);color:var(--green)">${ICON(k.icon,18)}</div><div><b>${H.esc(k.name)}</b><div class="muted" style="font-size:11px">${H.esc(k.kind)}</div></div></div>
          <span class="badge ${on?'b-green':'b-slate'}">${on?'Connected':'Not connected'}</span></div>
        <p class="mb0 muted" style="font-size:12px;margin-top:8px">${H.esc(k.desc)}</p>
        <div style="margin-top:10px"><button class="btn sm" data-cfg="${k.key}">${on?'Manage':'Configure'}</button></div>
      </div>`; }).join('')}
  </div>

  <div class="card pad" style="margin-top:18px">
    <div class="flex between center"><b>Employee / org sync</b><span class="muted" style="font-size:12px">${emps.length} employees in system</span></div>
    <p class="muted" style="font-size:12.5px;margin-top:6px">Upsert employees from HRIS export (JSON array or CSV). Records are matched by <b>empId</b> or <b>email</b>. Nothing is deleted.</p>
    <div class="field"><label>Paste JSON array or CSV (headers incl. name; empId/email recommended)</label><textarea class="input" id="syncdata" style="min-height:120px" placeholder='[{"empId":"E123","name":"...","title":"...","department":"..."}]'></textarea></div>
    <div class="flex gap"><button class="btn" id="preview">Preview</button><button class="btn primary" id="apply" disabled>Apply sync</button></div>
    <div id="syncres" style="margin-top:10px"></div>
  </div>

  <div class="card pad" style="margin-top:16px"><b>Sync log</b>
    <div id="log" style="margin-top:8px"></div>
  </div>`;

  c.querySelectorAll('[data-cfg]').forEach(b=> b.onclick=()=> configure(b.dataset.cfg));
  drawLog();
  let parsed=null;
  document.getElementById('preview').onclick=()=>{
    try{ parsed=parseData(document.getElementById('syncdata').value); }catch(e){ document.getElementById('syncres').innerHTML=`<span class="badge b-red">Parse error: ${H.esc(e.message)}</span>`; parsed=null; document.getElementById('apply').disabled=true; return; }
    const withKey=parsed.filter(r=>r.empId||r.email).length;
    document.getElementById('syncres').innerHTML=`<div class="doc-meta"><div class="row"><span class="k">Rows parsed</span><b>${parsed.length}</b></div><div class="row"><span class="k">With empId/email key</span><b>${withKey}</b></div><div class="row"><span class="k">Sample</span><span>${H.esc((parsed[0]&&(parsed[0].name||parsed[0].empId))||'—')}</span></div></div>`;
    document.getElementById('apply').disabled=parsed.length===0;
  };
  document.getElementById('apply').onclick=async()=>{
    if(!parsed) return;
    let added=0, updated=0;
    for(const row of parsed){
      const match=emps.find(e=> (row.empId&&e.empId===row.empId) || (row.email&&e.email===row.email));
      if(match){ await DB.put('employees', {...match, ...row}); updated++; }
      else { await DB.add('employees', row); added++; }
    }
    pushLog({source:'Manual sync', added, updated, by:(DB.getCurrentUser&&DB.getCurrentUser()?.name)});
    await logAudit('Ran employee sync', `+${added} / ~${updated}`, 'Integrations');
    H.toast(`Sync complete: ${added} added, ${updated} updated`); renderIntegrations(c);
  };

  function drawLog(){
    const l=getLog();
    document.getElementById('log').innerHTML = l.length? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Source</th><th>Added</th><th>Updated</th><th>By</th></tr></thead><tbody>
      ${l.map(e=>`<tr><td>${H.fmtDate(e.at)} ${new Date(e.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</td><td>${H.esc(e.source)}</td><td>${e.added||0}</td><td>${e.updated||0}</td><td>${H.esc(e.by||'—')}</td></tr>`).join('')}
    </tbody></table></div>` : '<span class="muted">No syncs run yet.</span>';
  }
}

function parseData(txt){
  txt=(txt||'').trim(); if(!txt) return [];
  if(txt[0]==='['||txt[0]==='{'){ const j=JSON.parse(txt); return Array.isArray(j)?j:[j]; }
  // CSV
  const lines=txt.split(/\r?\n/).filter(Boolean); const heads=lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).map(ln=>{ const cells=ln.split(','); const o={}; heads.forEach((h,i)=> o[h]=(cells[i]||'').trim()); return o; });
}

function configure(key){
  const k=CONNECTORS.find(x=>x.key===key); const cfg=getCfg(); const s=cfg[key]||{};
  H.modal({title:`${k.name} — configuration`, size:'md',
    body:`<div class="note-banner" style="margin-bottom:10px">${ICON('info',13)} Stored for configuration only. Turning on "Enabled" marks the connector active in the UI; live data exchange is performed by IT using these settings.</div>
      ${k.fields.map(([f,label])=>`<div class="field"><label>${H.esc(label)}</label><input class="input" data-f="${f}" value="${H.esc(s[f]||'')}"/></div>`).join('')}
      <div class="field"><label><input type="checkbox" id="en" ${s.enabled?'checked':''}/> Enabled (mark as connected)</label></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    const obj={enabled:document.getElementById('en').checked};
    document.querySelectorAll('.modal [data-f]').forEach(el=> obj[el.dataset.f]=el.value.trim());
    const c=getCfg(); c[key]=obj; setCfg(c);
    await logAudit('Updated integration config', k.name, obj.enabled?'Enabled':'Disabled');
    H.toast('Saved'); H.closeModal(); location.hash='#/integrations';
  };
}
