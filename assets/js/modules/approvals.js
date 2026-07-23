import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';

const RANK = { Viewer:1, Author:2, HOD:3, Executive:4, Admin:5 };

export async function renderApprovals(c){
  const user = DB.getCurrentUser() || {};
  const rank = RANK[user.role] || 0;
  const docs = await DB.getAll('documents');
  const inApproval = docs.filter(d=> d.status==='Released');

  const stageOf = (d)=>{ const wf=d.workflow; return (wf && wf.stages && wf.stages[wf.stageIndex]) ? wf.stages[wf.stageIndex] : null; };
  const forMe = (d)=>{ const s=stageOf(d); return s && (rank>=RANK.Admin || user.role===s.role); };

  const mine = inApproval.filter(forMe);
  const others = inApproval.filter(d=>!forMe(d));

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Workflow</div><h1>Approvals</h1>
    <p>Documents currently routed for approval. Open a document to review it and record your decision (approve, request changes, return or reject).</p></div></div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="stat"><div class="v">${inApproval.length}</div><div class="l">In approval</div></div>
    <div class="stat"><div class="v" style="color:var(--green)">${mine.length}</div><div class="l">Awaiting your decision</div></div>
    <div class="stat"><div class="v">${docs.filter(d=>d.approval&&d.approval.hod&&d.approval.hod.status==='Approved'&&d.status==='Released').length}</div><div class="l">Past HOD stage</div></div>
    <div class="stat"><div class="v">${docs.filter(d=>d.status==='Rejected').length}</div><div class="l">Rejected</div></div>
  </div>
  ${inApproval.length===0 ? `<div class="empty"><div class="ic">✅</div><p>Nothing is in the approval queue. Submit a Draft document from the Repository to route it for approval.</p></div>` : ''}
  ${mine.length ? `<div class="section-title">Awaiting your decision (${user.role})</div>${table(mine, stageOf, true)}` : ''}
  ${others.length ? `<div class="section-title">In approval — other stages</div>${table(others, stageOf, false)}` : ''}`;

  c.querySelectorAll('#rows-me tr[data-id], #rows-other tr[data-id]').forEach(tr=> tr.onclick=()=> location.hash='#/repository/'+tr.dataset.id);
  c.querySelectorAll('.review').forEach(b=> b.onclick=(e)=>{ e.stopPropagation(); location.hash='#/repository/'+b.dataset.id; });
}

function table(list, stageOf, mine){
  return `<div class="table-wrap"><table id="${mine?'rows-me':'rows-other'}"><thead><tr>
    <th>ID</th><th>Document</th><th>Domain</th><th>Version</th><th>Current stage</th><th>Awaiting</th><th></th></tr></thead><tbody>
    ${list.map(d=>{ const s=stageOf(d); return `<tr class="clickable" data-id="${d.id}">
      <td class="mono">${d.id}</td><td><b>${H.esc(d.title)}</b></td><td>${H.esc(d.domainName||'')}</td><td class="mono">${d.version||'0.1'}</td>
      <td>${s?H.esc(s.name):'—'}</td><td>${s?`<span class="badge b-amber">${H.esc(s.role)}</span>`:'—'}</td>
      <td><button class="btn ${mine?'primary ':''}sm review" data-id="${d.id}">${ICON('eye',14)} Review</button></td></tr>`;}).join('')}
  </tbody></table></div>`;
}
