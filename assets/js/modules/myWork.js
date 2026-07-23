import * as DB from '../db.js';
import { H, getRecents, getFavs } from '../app.js';
import { ICON } from '../icons.js';

const RANK = { Viewer:1, Author:2, HOD:3, Executive:4, Admin:5 };

export async function renderMyWork(c){
  const user = DB.getCurrentUser() || {};
  const rank = RANK[user.role] || 0;
  const [docs, camps, crs, emps] = await Promise.all([
    DB.getAll('documents'), DB.getAll('campaigns'), DB.getAll('changeRequests'), DB.getAll('employees')
  ]);

  const myApprovals = [];
  docs.forEach(d=>{
    if(d.status!=='Released') return;
    const a = d.approval || { hod:{}, exec:{} };
    if(rank>=RANK.HOD && (a.hod?.status)!=='Approved') myApprovals.push({ d, stage:'HOD review' });
    else if(rank>=RANK.Executive && (a.hod?.status)==='Approved' && (a.exec?.status)!=='Approved') myApprovals.push({ d, stage:'Executive approval' });
  });
  const today = new Date('2026-07-23');
  const myDocs = docs.filter(d=> d.owner===user.name);
  const myOverdue = myDocs.filter(d=> new Date(d.reviewDate) < today);
  const myCRs = crs.filter(x=> x.requester===user.name && x.status!=='Approved' && x.status!=='Rejected');
  const meEmp = emps.find(e=> (e.email||'').toLowerCase() === (user.email||'').toLowerCase());
  const audienceOf = (camp)=> camp.audienceType==='all' ? emps : camp.audienceType==='unit' ? emps.filter(e=>e.unit===camp.audienceValue) : emps.filter(e=>e.department===camp.audienceValue);
  const myAcks = meEmp ? camps.filter(camp=> audienceOf(camp).some(e=>e.empId===meEmp.empId) && !camp.acknowledgedBy.includes(meEmp.empId)) : [];
  const recents = getRecents(); const favs = getFavs();

  c.innerHTML = `
  <div class="page-head"><div><div class="eyebrow">My Governance Work</div><h1>Welcome, ${H.esc((user.name||'').split(' ')[0])}</h1>
    <p>Your personal inbox — items awaiting your action, the records you own, and your shortcuts. Role: <b>${H.esc(user.role||'')}</b>.</p></div></div>

  <div class="kpis" style="margin-bottom:18px">
    <div class="stat"><div class="v">${myApprovals.length}</div><div class="l">Awaiting my approval</div></div>
    <div class="stat"><div class="v">${myAcks.length}</div><div class="l">To acknowledge</div></div>
    <div class="stat"><div class="v" style="color:var(--amber)">${myOverdue.length}</div><div class="l">My overdue reviews</div></div>
    <div class="stat"><div class="v">${myCRs.length}</div><div class="l">My open requests</div></div>
  </div>

  <div class="two-col">
    <div class="card pad">
      <b>My Approvals</b>
      <div style="margin-top:8px">${myApprovals.length? myApprovals.map(x=>`<div class="flex between center clickable" style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="location.hash='#/repository/${x.d.id}'">
        <div><b>${H.esc(x.d.title)}</b><div class="muted mono" style="font-size:11.5px">${x.d.id} · ${H.esc(x.stage)}</div></div>${H.statusBadge(x.d.status)}</div>`).join('')
        : `<div class="muted" style="font-size:13px;padding:8px 0">Nothing is awaiting your approval${rank<RANK.HOD?" — approvals are routed to HOD and Executive roles.":"."}</div>`}</div>
    </div>
    <div class="card pad">
      <b>My Acknowledgements</b>
      <div style="margin-top:8px">${myAcks.length? myAcks.map(camp=>`<div class="flex between center clickable" style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="location.hash='#/campaigns'">
        <div><b>${H.esc(camp.docTitle)}</b><div class="muted" style="font-size:11.5px">Due ${H.fmtDate(camp.due)}</div></div><span class="badge b-amber">Pending</span></div>`).join('')
        : '<div class="muted" style="font-size:13px;padding:8px 0">No outstanding acknowledgements.</div>'}</div>
    </div>
  </div>

  <div class="two-col" style="margin-top:16px">
    <div class="card pad">
      <b>Documents I own</b>
      <div style="margin-top:8px">${myDocs.length? myDocs.slice(0,10).map(d=>`<div class="flex between center clickable" style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="location.hash='#/repository/${d.id}'">
        <div><b>${H.esc(d.title)}</b><div class="muted mono" style="font-size:11.5px">${d.id}</div></div><div class="flex gap center">${new Date(d.reviewDate)<today?'<span class="badge b-red">review overdue</span>':''}${H.statusBadge(d.status)}</div></div>`).join('')
        : '<div class="muted" style="font-size:13px;padding:8px 0">You are not the owner of any documents yet.</div>'}</div>
    </div>
    <div>
      <div class="card pad"><b>Favorites</b>
        <div style="margin-top:8px">${favs.length? favs.map(f=>`<a class="link" style="display:block;padding:5px 0" href="${f.hash}">${H.esc(f.label)}</a>`).join('') : '<div class="muted" style="font-size:12.5px">Star a page (top bar) to pin it here.</div>'}</div></div>
      <div class="card pad" style="margin-top:14px"><b>Recently viewed</b>
        <div style="margin-top:8px">${recents.length? recents.map(r=>`<a class="link" style="display:block;padding:5px 0" href="${r.hash}">${H.esc(r.label)}</a>`).join('') : '<div class="muted" style="font-size:12.5px">Your recent pages will appear here.</div>'}</div></div>
    </div>
  </div>`;
}
