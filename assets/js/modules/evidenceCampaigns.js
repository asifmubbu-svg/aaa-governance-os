import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

const TODAY = new Date('2026-07-23');
const canEdit = ()=> ({Author:2,HOD:3,Executive:4,Admin:5}[(DB.getCurrentUser&&DB.getCurrentUser()?.role)]||0) >= 2;
const me = ()=> (DB.getCurrentUser&&DB.getCurrentUser()?.name) || '';
const badge = (s)=>{ const m={Open:'b-amber',Submitted:'b-blue',Accepted:'b-green',Rejected:'b-red',Overdue:'b-red'}; return `<span class="badge ${m[s]||'b-slate'}">${H.esc(s)}</span>`; };
let filter='';

function effStatus(r){ if(r.status==='Open' && r.dueDate && new Date(r.dueDate)<TODAY) return 'Overdue'; return r.status; }

export async function renderEvidence(c){
  const [reqs, controls, emps] = await Promise.all([
    DB.getAll('evidenceRequests').catch(()=>[]), DB.getAll('controls').catch(()=>[]), DB.getAll('employees')
  ]);
  const requirements = await DB.getAll('requirements').catch(()=>[]);
  const total=reqs.length;
  const open=reqs.filter(r=>effStatus(r)==='Open').length;
  const overdue=reqs.filter(r=>effStatus(r)==='Overdue').length;
  const done=reqs.filter(r=>r.status==='Accepted').length;
  const pct = total?Math.round(done/total*100):0;

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Compliance & Assurance</div><h1>Evidence Requests</h1>
    <p>Request, track and accept audit evidence tied to requirements and controls. Assignees respond; owners accept or reject.</p></div>
    <div class="page-actions">${canEdit()?`<button class="btn primary" id="new">${ICON('plus')} New request</button>`:''}</div>
  </div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="stat"><div class="v">${total}</div><div class="l">Requests</div></div>
    <div class="stat"><div class="v" style="color:var(--amber)">${open}</div><div class="l">Open</div></div>
    <div class="stat"><div class="v" style="color:var(--red)">${overdue}</div><div class="l">Overdue</div></div>
    <div class="stat"><div class="v" style="color:var(--green)">${pct}%</div><div class="l">Accepted</div></div>
  </div>
  <div class="toolbar">${['','Open','Submitted','Accepted','Overdue','Rejected'].map(s=>`<button class="chip ${s===filter?'active':''}" data-s="${s}">${s||'All'}</button>`).join('')}</div>
  <div id="rows"></div>`;
  if(document.getElementById('new')) document.getElementById('new').onclick=()=> editRequest(null, requirements, controls, emps);
  c.querySelectorAll('[data-s]').forEach(b=> b.onclick=()=>{ filter=b.dataset.s; renderEvidence(c); });

  const list = reqs.filter(r=> !filter || effStatus(r)===filter);
  document.getElementById('rows').innerHTML = list.length? `<div class="table-wrap"><table><thead><tr>
    <th>ID</th><th>Request</th><th>Linked to</th><th>Assignee</th><th>Due</th><th>Status</th></tr></thead><tbody>
    ${list.map(r=>`<tr class="clickable" data-id="${r._id}" style="cursor:pointer">
      <td class="mono">${H.esc(r.id)}</td><td><b>${H.esc(r.title)}</b></td>
      <td><span class="tag">${H.esc(r.linkType)} ${H.esc(r.linkId)}</span></td>
      <td>${H.esc(r.requestedFrom)}</td>
      <td>${H.fmtDate(r.dueDate)}</td><td>${badge(effStatus(r))}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="empty"><p>No evidence requests${filter?' with status '+filter:''}.</p></div>`;
  document.querySelectorAll('#rows [data-id]').forEach(el=> el.onclick=()=>{ const r=reqs.find(x=>x._id===+el.dataset.id); openRequest(r, requirements, controls, emps); });
}

function openRequest(r, requirements, controls, emps){
  const respondable = r.status==='Open' || r.status==='Rejected';
  const decidable = r.status==='Submitted' && canEdit();
  H.modal({title:`Evidence request — ${r.id}`, size:'lg',
    body:`<div class="doc-meta">
      <div class="row"><span class="k">Request</span><b>${H.esc(r.title)}</b></div>
      <div class="row"><span class="k">Linked to</span><span>${H.esc(r.linkType)} · ${H.esc(r.linkId)}</span></div>
      <div class="row"><span class="k">Assignee</span><span>${H.esc(r.requestedFrom)}</span></div>
      <div class="row"><span class="k">Requested by</span><span>${H.esc(r.requestedBy||'—')}</span></div>
      <div class="row"><span class="k">Due</span><span>${H.fmtDate(r.dueDate)}</span></div>
      <div class="row"><span class="k">Status</span><span>${badge(effStatus(r))}</span></div>
    </div>
    <h4 style="margin:12px 0 4px">Description</h4><p class="mb0">${H.esc(r.description||'—')}</p>
    <h4 style="margin:12px 0 4px">Response</h4>
    ${respondable?`<textarea class="input" id="resp" placeholder="Describe or reference the evidence provided…" style="min-height:80px">${H.esc(r.response||'')}</textarea>
      <div class="field" style="margin-top:8px"><label>Evidence reference (doc no. / link / file name)</label><input class="input" id="ref" value="${H.esc(r.evidenceRef||'')}"/></div>`
     :`<p class="mb0">${H.esc(r.response||'—')}</p>${r.evidenceRef?`<div style="margin-top:6px"><span class="tag">${ICON('paperclip',12)} ${H.esc(r.evidenceRef)}</span></div>`:''}`}`,
    footer:`<button class="btn" id="cx">Close</button>
      ${respondable?`<button class="btn primary" id="submit">Submit evidence</button>`:''}
      ${decidable?`<button class="btn" id="reject">Reject</button><button class="btn primary" id="accept">Accept</button>`:''}`});
  document.getElementById('cx').onclick=H.closeModal;
  if(document.getElementById('submit')) document.getElementById('submit').onclick=async()=>{
    r.response=document.getElementById('resp').value.trim(); r.evidenceRef=document.getElementById('ref').value.trim();
    r.status='Submitted'; r.submittedBy=me(); r.submittedDate=new Date().toISOString();
    await DB.put('evidenceRequests',r); await logAudit('Submitted evidence', r.id, r.linkId); H.toast('Evidence submitted'); H.closeModal(); location.hash='#/evidence'; };
  if(document.getElementById('accept')) document.getElementById('accept').onclick=async()=>{
    r.status='Accepted'; r.decidedBy=me(); r.decidedDate=new Date().toISOString();
    await DB.put('evidenceRequests',r); await logAudit('Accepted evidence', r.id, r.linkId); H.toast('Evidence accepted'); H.closeModal(); location.hash='#/evidence'; };
  if(document.getElementById('reject')) document.getElementById('reject').onclick=async()=>{
    r.status='Rejected'; r.decidedBy=me(); r.decidedDate=new Date().toISOString();
    await DB.put('evidenceRequests',r); await logAudit('Rejected evidence', r.id, r.linkId); H.toast('Evidence returned'); H.closeModal(); location.hash='#/evidence'; };
}

function editRequest(existing, requirements, controls, emps){
  const r = existing || {linkType:'Requirement'};
  const optsFor=(t)=> (t==='Control'?controls:requirements).map(x=>`<option value="${H.esc(x.id)}" ${r.linkId===x.id?'selected':''}>${H.esc(x.id)} — ${H.esc(x.title)}</option>`).join('');
  const empOpts= emps.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(e=>`<option ${r.requestedFrom===e.name?'selected':''}>${H.esc(e.name)}</option>`).join('');
  H.modal({title: existing?'Edit request':'New evidence request', size:'lg',
    body:`<div class="field"><label>Title</label><input class="input" id="t" value="${H.esc(r.title||'')}"/></div>
      <div class="two-col">
        <div class="field"><label>Link type</label><select class="input" id="lt"><option ${r.linkType==='Requirement'?'selected':''}>Requirement</option><option ${r.linkType==='Control'?'selected':''}>Control</option></select></div>
        <div class="field"><label>Linked record</label><select class="input" id="lid">${optsFor(r.linkType||'Requirement')}</select></div>
      </div>
      <div class="two-col">
        <div class="field"><label>Assignee</label><select class="input" id="from"><option value="">— select —</option>${empOpts}</select></div>
        <div class="field"><label>Due date</label><input class="input" type="date" id="due" value="${H.esc((r.dueDate||'').slice(0,10))}"/></div>
      </div>
      <div class="field"><label>Description</label><textarea class="input" id="desc" style="min-height:80px">${H.esc(r.description||'')}</textarea></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">${existing?'Save':'Create request'}</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('lt').onchange=(e)=>{ document.getElementById('lid').innerHTML=optsFor(e.target.value); };
  document.getElementById('sv').onclick=async()=>{
    const obj={ ...r, title:document.getElementById('t').value.trim(), linkType:document.getElementById('lt').value,
      linkId:document.getElementById('lid').value, requestedFrom:document.getElementById('from').value,
      dueDate:document.getElementById('due').value, description:document.getElementById('desc').value.trim() };
    if(!obj.title){ H.toast('Title required'); return; }
    if(!existing){ obj.id='ER-'+new Date().getFullYear()+'-'+Math.random().toString().slice(2,5); obj.status='Open'; obj.requestedBy=me(); obj.raisedDate=new Date().toISOString(); }
    if(existing) await DB.put('evidenceRequests',obj); else await DB.add('evidenceRequests',obj);
    await logAudit(existing?'Updated evidence request':'Created evidence request', obj.id, obj.linkId);
    H.toast('Saved'); H.closeModal(); location.hash='#/evidence';
  };
}
