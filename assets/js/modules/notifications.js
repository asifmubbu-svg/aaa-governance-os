import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';

const TODAY = new Date('2026-07-23');
const days = (d)=> Math.round((new Date(d)-TODAY)/86400000);

// Compute action items for the current user (org-wide for Admin/Executive).
export async function computeNotifications(){
  const user = DB.getCurrentUser() || {};
  const wide = ['Admin','Executive'].includes(user.role);
  const rank = { Viewer:1, Author:2, HOD:3, Executive:4, Admin:5 }[user.role] || 0;
  const [docs, camps, emps, finds, controls, doa, reqs] = await Promise.all([
    DB.getAll('documents'), DB.getAll('campaigns'), DB.getAll('employees'),
    DB.getAll('findings').catch(()=>[]), DB.getAll('controls').catch(()=>[]),
    DB.getAll('doa').catch(()=>[]), DB.getAll('requirements').catch(()=>[])
  ]);
  const mine = (owner)=> wide || owner===user.name;
  const N = [];
  const push = (o)=> N.push(o);

  // documents awaiting my approval
  docs.filter(d=>d.status==='Released').forEach(d=>{
    const s = d.workflow && d.workflow.stages && d.workflow.stages[d.workflow.stageIndex];
    if(s && (rank>=5 || user.role===s.role)) push({cat:'Approval', icon:'check', sev:'high', title:`Approve: ${d.title}`, detail:`${d.id} · ${s.name}`, hash:'#/repository/'+d.id});
  });
  // overdue reviews
  docs.filter(d=>d.status==='Active' && new Date(d.reviewDate)<TODAY && mine(d.owner)).forEach(d=>
    push({cat:'Overdue review', icon:'git', sev:'med', title:`Review overdue: ${d.title}`, detail:`${d.id} · due ${H.fmtDate(d.reviewDate)}`, hash:'#/repository/'+d.id}));
  // acknowledgements pending for me
  const meEmp = emps.find(e=>(e.email||'').toLowerCase()===(user.email||'').toLowerCase());
  if(meEmp){
    const aud=(c)=> c.audienceType==='all'?emps: c.audienceType==='unit'?emps.filter(e=>e.unit===c.audienceValue): emps.filter(e=>e.department===c.audienceValue);
    camps.filter(c=> aud(c).some(e=>e.empId===meEmp.empId) && !c.acknowledgedBy.includes(meEmp.empId)).forEach(c=>
      push({cat:'Acknowledgement', icon:'clipboard', sev:'med', title:`Acknowledge: ${c.docTitle}`, detail:`Due ${H.fmtDate(c.due)}`, hash:'#/campaigns'}));
  }
  // overdue / my CAPA & findings
  finds.filter(f=> f.status!=='Closed' && (new Date(f.dueDate)<TODAY || mine(f.owner))).forEach(f=>{
    const od=new Date(f.dueDate)<TODAY;
    if(od || mine(f.owner)) push({cat:'Audit & CAPA', icon:'check', sev:od?'high':'low', title:`${f.type}: ${f.title}`, detail:`${f.id} · ${od?'overdue':'due'} ${H.fmtDate(f.dueDate)}`, hash:'#/audit-capa'});
  });
  // control tests due
  if(wide) controls.filter(c=> c.nextTest && new Date(c.nextTest)<TODAY).forEach(c=>
    push({cat:'Control testing', icon:'alert', sev:'med', title:`Control test due: ${c.title}`, detail:`${c.id} · next ${H.fmtDate(c.nextTest)}`, hash:'#/risks'}));
  // DOA expiring within 60 days
  if(wide) doa.filter(d=> d.expiryDate && days(d.expiryDate)<=60).forEach(d=>
    push({cat:'DOA expiry', icon:'key', sev:days(d.expiryDate)<0?'high':'low', title:`Authority expiring: ${d.transactionType}`, detail:`${d.id} · ${H.fmtDate(d.expiryDate)}`, hash:'#/doa'}));
  // requirement gaps
  if(wide) reqs.filter(r=> r.complianceStatus==='Gap').forEach(r=>
    push({cat:'Compliance gap', icon:'book', sev:'high', title:`Compliance gap: ${r.title}`, detail:`${r.id}`, hash:'#/requirements'}));

  const order={high:0,med:1,low:2};
  N.sort((a,b)=> order[a.sev]-order[b.sev]);
  return N;
}

export async function renderNotifications(c){
  const N = await computeNotifications();
  const cats=[...new Set(N.map(n=>n.cat))];
  const sevDot=(s)=>`<span style="width:8px;height:8px;border-radius:50%;background:${s==='high'?'var(--red)':s==='med'?'var(--amber)':'var(--muted-2)'};display:inline-block"></span>`;
  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">My Governance Work</div><h1>Notifications &amp; Tasks</h1>
    <p>Everything that needs your attention across the portal — approvals, reviews, acknowledgements, actions and expiries. Click an item to go straight to it.</p></div></div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="stat"><div class="v">${N.length}</div><div class="l">Open items</div></div>
    <div class="stat"><div class="v" style="color:var(--red)">${N.filter(n=>n.sev==='high').length}</div><div class="l">High priority</div></div>
    <div class="stat"><div class="v">${N.filter(n=>n.cat==='Approval').length}</div><div class="l">Approvals</div></div>
    <div class="stat"><div class="v">${N.filter(n=>n.cat==='Acknowledgement').length}</div><div class="l">Acknowledgements</div></div>
  </div>
  ${N.length===0?`<div class="empty"><div class="ic">🎉</div><p>You're all clear — no open items.</p></div>`:''}
  ${cats.map(cat=>`<div class="card pad" style="margin-bottom:14px"><b>${H.esc(cat)} <span class="muted" style="font-weight:400">(${N.filter(n=>n.cat===cat).length})</span></b>
    <div style="margin-top:8px">${N.filter(n=>n.cat===cat).map(n=>`<div class="flex center gap clickable" data-h="${n.hash}" style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer">
      ${sevDot(n.sev)}<div style="flex:1"><b style="font-size:13px">${H.esc(n.title)}</b><div class="muted" style="font-size:11.5px">${H.esc(n.detail)}</div></div>${ICON('eye',15)}</div>`).join('')}</div></div>`).join('')}`;
  c.querySelectorAll('[data-h]').forEach(el=> el.onclick=()=> location.hash=el.dataset.h);
}
