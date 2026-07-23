import * as DB from '../db.js';
import { H } from '../app.js';

export async function renderVersionControl(c){
  const docs = await DB.getAll('documents');
  const today=new Date('2026-07-23');
  const overdue=docs.filter(d=> new Date(d.reviewDate) < today).sort((a,b)=> new Date(a.reviewDate)-new Date(b.reviewDate));
  const upcoming=docs.filter(d=> new Date(d.reviewDate) >= today).sort((a,b)=> new Date(a.reviewDate)-new Date(b.reviewDate));
  const superseded=docs.filter(d=>d.status==='Superseded');

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Lifecycle</div><h1>Version Control</h1>
    <p>Track versions, review cadence and supersession across every artifact. Overdue reviews are surfaced for remediation.</p></div></div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="stat"><div class="v">${docs.length}</div><div class="l">Tracked artifacts</div></div>
    <div class="stat"><div class="v" style="color:var(--red)">${overdue.length}</div><div class="l">Overdue reviews</div></div>
    <div class="stat"><div class="v">${upcoming.length}</div><div class="l">Upcoming reviews</div></div>
    <div class="stat"><div class="v">${superseded.length}</div><div class="l">Superseded</div></div>
  </div>
  <div class="section-title">Overdue reviews</div>
  ${tbl(overdue.slice(0,12), true)}
  <div class="section-title">Upcoming reviews</div>
  ${tbl(upcoming.slice(0,12), false)}`;
  c.querySelectorAll('tr[data-id]').forEach(tr=> tr.onclick=()=> location.hash='#/repository/'+tr.dataset.id);
}
const tbl=(list, overdue)=> list.length? `<div class="table-wrap"><table><thead><tr>
  <th>ID</th><th>Title</th><th>Owner</th><th>Version</th><th>Status</th><th>Review due</th></tr></thead><tbody>
  ${list.map(d=>`<tr class="clickable" data-id="${d.id}"><td class="mono">${d.id}</td><td><b>${H.esc(d.title)}</b></td>
    <td>${H.esc(d.owner)}</td><td class="mono">${d.version}</td><td>${H.statusBadge(d.status)}</td>
    <td><span class="badge ${overdue?'b-red':'b-amber'}">${H.fmtDate(d.reviewDate)}</span></td></tr>`).join('')}
  </tbody></table></div>` : `<div class="empty"><p>Nothing here.</p></div>`;
