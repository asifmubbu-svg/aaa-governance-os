import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

const canEdit = ()=> ({Author:2,HOD:3,Executive:4,Admin:5}[(DB.getCurrentUser&&DB.getCurrentUser()?.role)]||0) >= 2;
const stBadge = (s)=>{ const m={Open:'b-blue','In Progress':'b-amber',Closed:'b-green',Overdue:'b-red'}; return `<span class="badge ${m[s]||'b-slate'}">${H.esc(s)}</span>`; };
const sevBadge = (s)=>{ const m={High:'b-red',Medium:'b-amber',Low:'b-green'}; return `<span class="badge ${m[s]||'b-slate'}">${H.esc(s)}</span>`; };
let ftype='', fstatus='';

export async function renderAuditCapa(c){
  const finds = await DB.getAll('findings');
  const domains = await DB.getAll('domains');
  const today = new Date('2026-07-23');
  const overdue = finds.filter(f=> f.status!=='Closed' && new Date(f.dueDate) < today);

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Compliance & Assurance</div><h1>Audit &amp; CAPA</h1>
    <p>Audit findings and corrective/preventive actions (CAPA), from root cause to verified closure.</p></div>
    <div class="page-actions">${canEdit()?`<button class="btn primary" id="new">${ICON('plus')} New finding / CAPA</button>`:''}</div>
  </div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="stat"><div class="v">${finds.filter(f=>f.type==='Audit Finding').length}</div><div class="l">Audit findings</div></div>
    <div class="stat"><div class="v">${finds.filter(f=>f.type==='CAPA').length}</div><div class="l">CAPA actions</div></div>
    <div class="stat"><div class="v" style="color:var(--red)">${overdue.length}</div><div class="l">Overdue</div></div>
    <div class="stat"><div class="v" style="color:var(--green)">${finds.filter(f=>f.status==='Closed').length}</div><div class="l">Closed</div></div>
  </div>
  <div class="toolbar">
    ${['','Audit Finding','CAPA'].map(t=>`<button class="chip ${t===ftype?'active':''}" data-ty="${t}">${t||'All types'}</button>`).join('')}
    <span style="width:10px"></span>
    ${['','Open','In Progress','Closed','Overdue'].map(s=>`<button class="chip ${s===fstatus?'active':''}" data-st="${s}">${s||'All'}</button>`).join('')}
  </div>
  <div id="rows"></div>`;
  c.querySelectorAll('[data-ty]').forEach(b=> b.onclick=()=>{ ftype=b.dataset.ty; renderAuditCapa(c); });
  c.querySelectorAll('[data-st]').forEach(b=> b.onclick=()=>{ fstatus=b.dataset.st; renderAuditCapa(c); });
  if(document.getElementById('new')) document.getElementById('new').onclick=()=> editFinding(null, domains, ()=>renderAuditCapa(c));
  const draw=()=>{
    let list=finds.filter(f=> (!ftype||f.type===ftype) && (!fstatus||f.status===fstatus));
    document.getElementById('rows').innerHTML=`<div class="table-wrap"><table><thead><tr>
      <th>ID</th><th>Title</th><th>Type</th><th>Domain</th><th>Severity</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead><tbody>
      ${list.map(f=>{ const od=f.status!=='Closed'&&new Date(f.dueDate)<today; return `<tr class="clickable" data-id="${f._id}"><td class="mono">${f.id}</td><td><b>${H.esc(f.title)}</b></td>
        <td>${H.esc(f.type)}</td><td>${H.esc(f.domain)}</td><td>${sevBadge(f.severity)}</td><td>${H.esc(f.owner)}</td>
        <td>${od?`<span class="badge b-red">${H.fmtDate(f.dueDate)}</span>`:H.fmtDate(f.dueDate)}</td><td>${stBadge(od?'Overdue':f.status)}</td></tr>`;}).join('')}
    </tbody></table></div>`;
    document.querySelectorAll('#rows tr[data-id]').forEach(tr=> tr.onclick=()=> openFinding(finds.find(x=>x._id===+tr.dataset.id), domains, ()=>renderAuditCapa(c)));
  };
  draw();
}

function openFinding(f, domains, refresh){
  H.modal({title:`${f.id} — ${f.title}`, size:'lg',
    body:`<div class="flex gap wrap" style="margin-bottom:10px">${stBadge(f.status)} ${sevBadge(f.severity)} <span class="badge b-slate">${H.esc(f.type)}</span></div>
    <div class="doc-meta">
      <div class="row"><span class="k">Source</span><span>${H.esc(f.source)}</span></div>
      <div class="row"><span class="k">Owner</span><span>${H.esc(f.owner)}</span></div>
      <div class="row"><span class="k">Raised</span><span>${H.fmtDate(f.raisedDate)}</span></div>
      <div class="row"><span class="k">Due</span><span>${H.fmtDate(f.dueDate)}</span></div>
      <div class="row"><span class="k">Verification</span><span>${H.esc(f.verification||'—')}</span></div>
    </div>
    <h3>Root cause</h3><p class="muted">${H.esc(f.rootCause||'—')}</p>
    <h3>Corrective action</h3><p class="muted">${H.esc(f.correctiveAction||'—')}</p>
    <h3>Preventive action</h3><p class="muted mb0">${H.esc(f.preventiveAction||'—')}</p>`,
    footer:`<button class="btn" id="cx">Close</button>${canEdit()?'<button class="btn danger" id="dl">Delete</button><button class="btn primary" id="ed">Edit</button>':''}`});
  document.getElementById('cx').onclick=H.closeModal;
  if(document.getElementById('ed')) document.getElementById('ed').onclick=()=> editFinding(f, domains, refresh);
  if(document.getElementById('dl')) document.getElementById('dl').onclick=()=> H.confirmDialog(`Delete ${f.id}?`, async()=>{ await DB.del('findings',f._id); H.toast('Deleted'); H.closeModal(); refresh(); });
}

function editFinding(fd, domains, refresh){
  const isNew=!fd;
  const f=fd||{title:'',type:'Audit Finding',domain:domains[0].code,severity:'Medium',status:'Open',owner:'',source:'Internal Audit',raisedDate:'2026-07-01',dueDate:'2026-09-30',rootCause:'',correctiveAction:'',preventiveAction:'',verification:'Pending'};
  const v=id=>document.getElementById(id).value.trim();
  H.modal({title:isNew?'New finding / CAPA':'Edit', size:'lg', body:`
    <div class="field"><label>Title</label><input class="input" id="f-title" value="${H.esc(f.title)}"/></div>
    <div class="field-row"><div class="field"><label>Type</label><select class="input" id="f-type"><option ${f.type==='Audit Finding'?'selected':''}>Audit Finding</option><option ${f.type==='CAPA'?'selected':''}>CAPA</option></select></div>
      <div class="field"><label>Domain</label><select class="input" id="f-domain">${domains.map(d=>`<option value="${d.code}" ${d.code===f.domain?'selected':''}>${H.esc(d.name)}</option>`).join('')}</select></div></div>
    <div class="field-row"><div class="field"><label>Severity</label><select class="input" id="f-sev">${['High','Medium','Low'].map(s=>`<option ${s===f.severity?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Status</label><select class="input" id="f-status">${['Open','In Progress','Closed','Overdue'].map(s=>`<option ${s===f.status?'selected':''}>${s}</option>`).join('')}</select></div></div>
    <div class="field-row"><div class="field"><label>Owner</label><input class="input" id="f-owner" value="${H.esc(f.owner)}"/></div>
      <div class="field"><label>Source</label><input class="input" id="f-source" value="${H.esc(f.source)}"/></div></div>
    <div class="field-row"><div class="field"><label>Raised</label><input class="input" type="date" id="f-raised" value="${(f.raisedDate||'').slice(0,10)}"/></div>
      <div class="field"><label>Due</label><input class="input" type="date" id="f-due" value="${(f.dueDate||'').slice(0,10)}"/></div></div>
    <div class="field"><label>Root cause</label><textarea class="input" id="f-root">${H.esc(f.rootCause)}</textarea></div>
    <div class="field"><label>Corrective action</label><textarea class="input" id="f-corr">${H.esc(f.correctiveAction)}</textarea></div>
    <div class="field"><label>Preventive action</label><textarea class="input" id="f-prev">${H.esc(f.preventiveAction)}</textarea></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    const o={...f,title:v('f-title'),type:document.getElementById('f-type').value,domain:document.getElementById('f-domain').value,severity:document.getElementById('f-sev').value,
      status:document.getElementById('f-status').value,owner:v('f-owner'),source:v('f-source'),raisedDate:document.getElementById('f-raised').value,dueDate:document.getElementById('f-due').value,
      rootCause:v('f-root'),correctiveAction:v('f-corr'),preventiveAction:v('f-prev')};
    if(!o.title){ H.toast('Title required'); return; }
    if(isNew){ o.id=(o.type==='CAPA'?'CAPA':'AF')+'-2026-'+String(Math.floor(Math.random()*900)+100); await DB.add('findings',o); } else await DB.put('findings',o);
    await logAudit(isNew?'Created finding/CAPA':'Updated finding/CAPA', o.title,'AAA Holding');
    H.toast('Saved'); H.closeModal(); refresh();
  };
}
