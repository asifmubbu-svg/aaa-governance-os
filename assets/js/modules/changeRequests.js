import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

export async function renderChangeRequests(c){
  const crs = await DB.getAll('changeRequests');
  const docs = await DB.getAll('documents');
  let filter='';
  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Workflow</div><h1>Change Requests</h1>
    <p>Every create, edit or retire flows through a controlled, multi-stage approval — nothing changes without an evidenced trail.</p></div></div>
  <div class="toolbar">
    ${['','Draft','Submitted','Approved','Rejected'].map(s=>`<button class="chip ${s===''?'active':''}" data-s="${s}">${s||'All'}</button>`).join('')}
    <span class="muted" id="c" style="margin-left:auto"></span>
  </div><div id="rows"></div>`;
  const draw=()=>{
    let list=crs.filter(x=>!filter||x.status===filter).sort((a,b)=> new Date(b.date)-new Date(a.date));
    document.getElementById('c').textContent=`${list.length} requests`;
    document.getElementById('rows').innerHTML=`<div class="table-wrap"><table><thead><tr>
      <th>ID</th><th>Change</th><th>Requester</th><th>Domain</th><th>Status</th><th>Raised</th><th></th></tr></thead><tbody>
      ${list.map(x=>`<tr data-id="${x._id}" class="clickable"><td class="mono">${x.id}</td><td><b>${H.esc(x.title)}</b></td>
        <td>${H.esc(x.requester)}</td><td>${H.esc(x.domain)}</td><td>${H.statusBadge(x.status)}</td><td>${H.fmtDate(x.date)}</td>
        <td>${ICON('eye',15)}</td></tr>`).join('')}
    </tbody></table></div>`;
    document.querySelectorAll('#rows tr[data-id]').forEach(tr=> tr.onclick=()=>{ const cr=crs.find(x=>x._id===+tr.dataset.id); openCR(cr, docs, ()=>renderChangeRequests(c)); });
  };
  c.querySelectorAll('[data-s]').forEach(b=> b.onclick=()=>{ filter=b.dataset.s; c.querySelectorAll('[data-s]').forEach(x=>x.classList.toggle('active',x===b)); draw(); });
  draw();
}

function openCR(cr, docs, refresh){
  const doc=docs.find(d=>d.id===cr.docId);
  H.modal({title:cr.id, size:'lg',
    body:`<div class="flex between center wrap" style="margin-bottom:10px">
      <div><h3 class="mt0 mb0">${H.esc(cr.title)}</h3><div class="muted">${H.esc(cr.type)} · raised by ${H.esc(cr.requester)} · ${H.fmtDate(cr.date)}</div></div>${H.statusBadge(cr.status)}</div>
    <div class="card pad" style="box-shadow:none;margin-bottom:14px"><b>Summary</b><p class="mb0">${H.esc(cr.notes||'—')}</p></div>
    ${doc?`<div class="muted" style="font-size:12.5px;margin-bottom:12px">Target artifact: <span class="link" onclick="location.hash='#/repository/${doc.id}'">${doc.id} — ${H.esc(doc.title)}</span></div>`:''}
    <b>Approval chain</b>
    <div style="margin-top:8px">${(cr.stages||[]).map((s,i)=>`<div class="flex center gap" style="padding:9px 0;border-bottom:1px solid var(--border)">
      <div class="avatar" style="width:30px;height:30px;font-size:11px">${H.initials(s.approver)}</div>
      <div style="flex:1"><b>${H.esc(s.role)}</b><div class="muted" style="font-size:12px">${H.esc(s.approver)}</div></div>
      ${H.statusBadge(s.status)}</div>`).join('')}</div>`,
    footer: cr.status==='Submitted'
      ? `<button class="btn danger" id="rej">Reject</button><button class="btn primary" id="app">Approve next stage</button>`
      : `<button class="btn" id="cx">Close</button>`});
  const cx=document.getElementById('cx'); if(cx) cx.onclick=H.closeModal;
  const app=document.getElementById('app');
  if(app){
    app.onclick=async()=>{
      const stage=(cr.stages||[]).find(s=>s.status==='Pending');
      if(stage) stage.status='Approved';
      if(!(cr.stages||[]).some(s=>s.status==='Pending')) cr.status='Approved';
      await DB.put('changeRequests',cr);
      await logAudit('Approved change request', cr.title, 'AAA Holding');
      H.toast(cr.status==='Approved'?'Change request fully approved':'Stage approved'); H.closeModal(); refresh();
    };
    document.getElementById('rej').onclick=async()=>{ cr.status='Rejected'; await DB.put('changeRequests',cr); await logAudit('Rejected change request', cr.title,'AAA Holding'); H.toast('Change request rejected'); H.closeModal(); refresh(); };
  }
}
