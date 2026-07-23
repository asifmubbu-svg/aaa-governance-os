import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

const canEdit = ()=> ({Author:2,HOD:3,Executive:4,Admin:5}[(DB.getCurrentUser&&DB.getCurrentUser()?.role)]||0) >= 2;
const money = (n)=> n ? 'SAR '+Number(n).toLocaleString() : '—';
const range = (d)=> (d.min||d.max) ? `${money(d.min)} – ${d.max?money(d.max):'no limit'}` : 'Non-financial';
let tab='register';

export async function renderDOA(c){
  const doa = await DB.getAll('doa');
  const domains = await DB.getAll('domains');
  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Organization & Accountability</div><h1>Delegation of Authority</h1>
    <p>Structured authority matrix — who can approve what, up to which limit, individually or jointly. ${doa.length} authorities across ${new Set(doa.map(d=>d.category)).size} categories.</p></div>
    <div class="page-actions">${canEdit()?`<button class="btn primary" id="new">${ICON('plus')} New authority</button>`:''}</div>
  </div>
  <div class="toolbar">
    <button class="chip ${tab==='register'?'active':''}" data-t="register">Register</button>
    <button class="chip ${tab==='matrix'?'active':''}" data-t="matrix">Authority matrix</button>
    <button class="chip ${tab==='lookup'?'active':''}" data-t="lookup">Lookup tool</button>
  </div>
  <div id="doa-body"></div>`;
  c.querySelectorAll('[data-t]').forEach(b=> b.onclick=()=>{ tab=b.dataset.t; renderDOA(c); });
  if(document.getElementById('new')) document.getElementById('new').onclick=()=> editDOA(null, domains, ()=>renderDOA(c));
  const body=document.getElementById('doa-body');
  if(tab==='register') drawRegister(body, doa, domains, ()=>renderDOA(c));
  else if(tab==='matrix') drawMatrix(body, doa);
  else drawLookup(body, doa);
}

function drawRegister(body, doa, domains, refresh){
  body.innerHTML=`<div class="table-wrap"><table><thead><tr>
    <th>ID</th><th>Category</th><th>Transaction</th><th>Role</th><th>Authority (SAR)</th><th>Type</th><th>Approver</th><th>Status</th></tr></thead><tbody>
    ${doa.map(d=>`<tr class="clickable" data-id="${d._id}"><td class="mono">${d.id}</td><td>${H.esc(d.category)}</td><td>${H.esc(d.transactionType)}</td>
      <td>${H.esc(d.role)}</td><td>${range(d)}</td><td><span class="badge ${d.authorityType==='Joint'?'b-violet':'b-slate'}">${H.esc(d.authorityType)}</span></td>
      <td>${H.esc(d.approver)}</td><td>${H.statusBadge(d.status)}</td></tr>`).join('')}
  </tbody></table></div>`;
  body.querySelectorAll('tr[data-id]').forEach(tr=> tr.onclick=()=> openDOA(doa.find(x=>x._id===+tr.dataset.id), domains, refresh));
}

function openDOA(d, domains, refresh){
  H.modal({title:`${d.id} — ${d.transactionType}`, size:'lg',
    body:`<div class="flex gap wrap" style="margin-bottom:10px">${H.statusBadge(d.status)}<span class="badge b-slate">${H.esc(d.category)}</span><span class="badge ${d.authorityType==='Joint'?'b-violet':'b-slate'}">${H.esc(d.authorityType)} authority</span></div>
    <div class="jd-grid">
      <div class="card pad doc-meta" style="box-shadow:none">
        <b>Authority</b>
        <div class="row"><span class="k">Transaction</span><span>${H.esc(d.transactionType)}</span></div>
        <div class="row"><span class="k">Role</span><span>${H.esc(d.role)}</span></div>
        <div class="row"><span class="k">Entity / Dept</span><span>${H.esc(d.entity)} · ${H.esc(d.department)}</span></div>
        <div class="row"><span class="k">Limit</span><span>${range(d)}</span></div>
        <div class="row"><span class="k">Valid</span><span>${H.fmtDate(d.startDate)} → ${H.fmtDate(d.expiryDate)}</span></div>
      </div>
      <div class="card pad doc-meta" style="box-shadow:none">
        <b>Approval chain</b>
        <div class="row"><span class="k">Initiator</span><span>${H.esc(d.initiator||'—')}</span></div>
        <div class="row"><span class="k">Recommender</span><span>${H.esc(d.recommender||'—')}</span></div>
        <div class="row"><span class="k">Reviewer</span><span>${H.esc(d.reviewer||'—')}</span></div>
        <div class="row"><span class="k">Approver</span><span><b>${H.esc(d.approver||'—')}</b></span></div>
      </div>
    </div>
    ${d.reservedMatters?`<div class="card pad" style="box-shadow:none;margin-top:12px"><b>Reserved matters</b><p class="mb0 muted">${H.esc(d.reservedMatters)}</p></div>`:''}
    ${d.conditions?`<div class="card pad" style="box-shadow:none;margin-top:12px"><b>Conditions</b><p class="mb0 muted">${H.esc(d.conditions)}</p>${d.escalation?`<div class="muted" style="font-size:12px;margin-top:6px">Escalation: ${H.esc(d.escalation)}</div>`:''}</div>`:''}`,
    footer:`<button class="btn" id="cx">Close</button>${canEdit()?'<button class="btn danger" id="dl">Delete</button><button class="btn primary" id="ed">Edit</button>':''}`});
  document.getElementById('cx').onclick=H.closeModal;
  if(document.getElementById('ed')) document.getElementById('ed').onclick=()=> editDOA(d, domains, refresh);
  if(document.getElementById('dl')) document.getElementById('dl').onclick=()=> H.confirmDialog(`Delete ${d.id}?`, async()=>{ await DB.del('doa',d._id); H.toast('Deleted'); H.closeModal(); refresh(); });
}

function drawMatrix(body, doa){
  const cats=[...new Set(doa.map(d=>d.category))];
  body.innerHTML=`<div class="page-actions" style="justify-content:flex-end;margin-bottom:10px"><button class="btn sm" onclick="window.print()">${ICON('download',14)} Print matrix</button></div>
  ${cats.map(cat=>`<div class="section-title">${H.esc(cat)}</div>
    <div class="table-wrap"><table><thead><tr><th>Transaction</th><th>Role</th><th>Limit (SAR)</th><th>Authority</th><th>Approver</th></tr></thead><tbody>
    ${doa.filter(d=>d.category===cat).sort((a,b)=>(a.min||0)-(b.min||0)).map(d=>`<tr><td>${H.esc(d.transactionType)}</td><td>${H.esc(d.role)}</td><td>${range(d)}</td><td>${H.esc(d.authorityType)}</td><td><b>${H.esc(d.approver)}</b></td></tr>`).join('')}
    </tbody></table></div>`).join('')}`;
}

function drawLookup(body, doa){
  const txns=[...new Set(doa.map(d=>d.transactionType))];
  body.innerHTML=`<div class="card pad">
    <p class="mt0 muted">Find who is authorized to approve a transaction at a given value.</p>
    <div class="field-row">
      <div class="field"><label>Transaction type</label><select class="input" id="lk-txn">${txns.map(t=>`<option>${H.esc(t)}</option>`).join('')}</select></div>
      <div class="field"><label>Amount (SAR)</label><input class="input" id="lk-amt" type="number" value="0"/></div>
    </div>
    <button class="btn primary" id="lk-go">Find authority</button>
    <div id="lk-out" style="margin-top:14px"></div>
  </div>`;
  document.getElementById('lk-go').onclick=()=>{
    const t=document.getElementById('lk-txn').value; const amt=+document.getElementById('lk-amt').value||0;
    const matches=doa.filter(d=>d.transactionType===t && d.status==='Active' && ((d.min||0)<=amt) && (!d.max || amt<=d.max)).sort((a,b)=>(a.max||1e18)-(b.max||1e18));
    const out=document.getElementById('lk-out');
    out.innerHTML = matches.length ? matches.map(d=>`<div class="card pad" style="box-shadow:none;border-color:var(--green);margin-bottom:8px">
      <div class="flex between center"><b>${H.esc(d.approver)}</b><span class="badge ${d.authorityType==='Joint'?'b-violet':'b-green'}">${H.esc(d.authorityType)}</span></div>
      <div class="muted" style="font-size:12.5px;margin-top:4px">${H.esc(d.role)} · limit ${range(d)} · ${d.id}${d.conditions?' · '+H.esc(d.conditions):''}</div></div>`).join('')
      : `<div class="empty" style="padding:20px"><div class="ic">⚠️</div><p>No single authority covers SAR ${amt.toLocaleString()} for “${H.esc(t)}”. This likely escalates to a higher authority or Board reserved matter.</p></div>`;
  };
}

function editDOA(doc, domains, refresh){
  const isNew=!doc;
  const d = doc || { category:'', transactionType:'', domain:domains[0].code, entity:'AAA Holding', department:'', role:'', currency:'SAR', min:0, max:0, authorityType:'Individual', initiator:'', recommender:'', reviewer:'', approver:'', reservedMatters:'', conditions:'', escalation:'', tempDelegation:'', startDate:'2026-01-01', expiryDate:'2026-12-31', status:'Active', version:'1.0' };
  const v=id=>document.getElementById(id).value.trim();
  H.modal({title:isNew?'New authority':'Edit authority', size:'lg', body:`
    <div class="field-row"><div class="field"><label>Category</label><input class="input" id="d-cat" value="${H.esc(d.category)}"/></div>
      <div class="field"><label>Transaction type</label><input class="input" id="d-txn" value="${H.esc(d.transactionType)}"/></div></div>
    <div class="field-row"><div class="field"><label>Department</label><input class="input" id="d-dept" value="${H.esc(d.department)}"/></div>
      <div class="field"><label>Role</label><input class="input" id="d-role" value="${H.esc(d.role)}"/></div></div>
    <div class="field-row"><div class="field"><label>Min (SAR)</label><input class="input" id="d-min" type="number" value="${d.min||0}"/></div>
      <div class="field"><label>Max (SAR, 0 = no limit)</label><input class="input" id="d-max" type="number" value="${d.max||0}"/></div></div>
    <div class="field"><label>Authority type</label><select class="input" id="d-type"><option ${d.authorityType==='Individual'?'selected':''}>Individual</option><option ${d.authorityType==='Joint'?'selected':''}>Joint</option></select></div>
    <div class="field-row"><div class="field"><label>Initiator</label><input class="input" id="d-init" value="${H.esc(d.initiator)}"/></div>
      <div class="field"><label>Recommender</label><input class="input" id="d-rec" value="${H.esc(d.recommender)}"/></div></div>
    <div class="field-row"><div class="field"><label>Reviewer</label><input class="input" id="d-rev" value="${H.esc(d.reviewer)}"/></div>
      <div class="field"><label>Approver</label><input class="input" id="d-app" value="${H.esc(d.approver)}"/></div></div>
    <div class="field"><label>Conditions</label><input class="input" id="d-cond" value="${H.esc(d.conditions)}"/></div>
    <div class="field"><label>Reserved matters</label><input class="input" id="d-res" value="${H.esc(d.reservedMatters)}"/></div>
    <div class="field-row"><div class="field"><label>Valid from</label><input class="input" type="date" id="d-start" value="${(d.startDate||'').slice(0,10)}"/></div>
      <div class="field"><label>Expiry</label><input class="input" type="date" id="d-exp" value="${(d.expiryDate||'').slice(0,10)}"/></div></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    const o={...d,category:v('d-cat'),transactionType:v('d-txn'),department:v('d-dept'),role:v('d-role'),
      min:+document.getElementById('d-min').value||0,max:+document.getElementById('d-max').value||0,
      authorityType:document.getElementById('d-type').value,initiator:v('d-init'),recommender:v('d-rec'),reviewer:v('d-rev'),approver:v('d-app'),
      conditions:v('d-cond'),reservedMatters:v('d-res'),startDate:document.getElementById('d-start').value,expiryDate:document.getElementById('d-exp').value};
    if(!o.transactionType||!o.approver){ H.toast('Transaction and approver are required'); return; }
    if(isNew){ o.id='DOA-'+String(Math.floor(Math.random()*900)+100); await DB.add('doa',o); } else await DB.put('doa',o);
    await logAudit(isNew?'Created delegation of authority':'Updated delegation of authority', o.transactionType, 'AAA Holding');
    H.toast('Authority saved'); H.closeModal(); refresh();
  };
}
