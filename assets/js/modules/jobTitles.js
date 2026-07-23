import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

// derive standard responsibilities from title keywords
export function responsibilitiesFor(title, lib){
  lib = lib || {};
  const t=(title||'').toLowerCase();
  for(const key of Object.keys(lib)){
    if(key!=='default' && t.includes(key)) return lib[key];
  }
  return lib.default || [
    'Perform assigned duties per approved procedures and standards',
    'Maintain accurate records and compliance evidence',
    'Collaborate with the team to meet objectives'
  ];
}

export function gradeFor(title, grades){
  const t=(title||'').toLowerCase();
  for(const g of (grades||[])){ if((g.match||[]).some(m=>t.includes(m))) return g; }
  return (grades||[]).slice(-1)[0] || {code:'G',name:'General / Operations'};
}
export function competenciesFor(title, department, lib){
  lib=lib||{}; const t=(title||'').toLowerCase();
  const isLeader=/chief|director|head|manager|supervisor|incharge/.test(t);
  const fk=Object.keys(lib.functional||{}).find(k=> k!=='default' && (department||'').toLowerCase().includes(k.toLowerCase()));
  const func=(lib.functional||{})[fk] || (lib.functional||{}).default || [];
  return { core:lib.core||[], leadership:isLeader?(lib.leadership||[]):[], functional:func };
}
function compCard(comp){
  const block=(label,arr)=> arr.length?`<div style="margin-top:8px"><div class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.05em">${label}</div><div style="margin-top:4px">${arr.map(x=>`<span class="tag">${H.esc(x)}</span>`).join('')}</div></div>`:'';
  return `${block('Core',comp.core)}${block('Leadership',comp.leadership)}${block('Functional',comp.functional)}`;
}
export function reportsTo(emp, emps){
  if(!emp) return 'Chief Executive Officer';
  if(/chief executive/i.test(emp.title||'')) return 'Board of Directors';
  const senior = emps.filter(e=> e.department===emp.department && e!==emp && /director|chief|head|manager/i.test(e.title||''))
    .sort((a,b)=> rank(a.title)-rank(b.title))[0];
  if(senior && rank(senior.title) < rank(emp.title)) return `${senior.name} — ${senior.title}`;
  const ceo = emps.find(e=>/chief executive/i.test(e.title||''));
  return ceo ? `${ceo.name} — ${ceo.title}` : 'Executive Management';
}
function rank(t){ t=(t||'').toLowerCase(); if(t.includes('chief')||t.includes('ceo'))return 0; if(t.includes('director'))return 1; if(t.includes('head'))return 2; if(t.includes('manager'))return 3; if(t.includes('supervisor')||t.includes('incharge'))return 4; return 5; }
const roleRank = ()=> ({Author:2,HOD:3,Executive:4,Admin:5}[(DB.getCurrentUser&&DB.getCurrentUser()?.role)]||1);
const jdBadge = (s)=>{ const m={Draft:'b-slate',Submitted:'b-amber',Approved:'b-green'}; return `<span class="badge ${m[s]||'b-slate'}">JD ${H.esc(s)}</span>`; };

export async function jobProfileFor(title, emps){
  const meta = await DB.getMeta();
  const assigned = emps.filter(e=> (e.title||'').trim()===title);
  return { title, responsibilities: responsibilitiesFor(title, meta.responsibilityLibrary), assigned };
}

// ---------- Job Description viewer ----------
export async function openJD(emp, emps){
  const meta = await DB.getMeta();
  const jd = emp.jd || {};
  const resp = (jd.responsibilities && jd.responsibilities.length) ? jd.responsibilities : responsibilitiesFor(emp.title, meta.responsibilityLibrary);
  const purpose = jd.purpose || `To ${firstVerb(emp.title)} within the ${emp.department||emp.unit} function, delivering the responsibilities of the ${emp.title||'role'} to AAA's standards, policies and KPIs.`;
  const rTo = jd.reportsTo || reportsTo(emp, emps);
  const quals = jd.qualifications || defaultQuals(emp.title);
  const grade = gradeFor(emp.title, meta.grades);
  const comp = competenciesFor(emp.title, emp.department, meta.competencyLibrary);
  const peers = emps.filter(e=> (e.title||'')===emp.title && e!==emp);
  const family = (meta.departmentFamily && meta.departmentFamily[emp.department]) || 'General';
  const arch = (meta.gradeArchitecture && meta.gradeArchitecture[grade.code]) || {};
  const acks = await DB.getAll('acknowledgments');
  const jdKey = 'JD:'+(emp.empId||emp.name);
  const meNow = (DB.getCurrentUser && DB.getCurrentUser()?.name) || '';
  const jdAcks = acks.filter(a=>a.docId===jdKey);
  const acknowledged = jdAcks.some(a=>a.user===meNow);
  const jdStatus = jd.status || 'Draft';
  const versions = jd.versions || [];
  const r = roleRank();
  const canSubmit = r>=2 && jdStatus==='Draft';
  const canApprove = r>=3 && jdStatus==='Submitted' && jd.submittedBy!==meNow;
  H.modal({title:'Job Description', size:'lg',
    body:`
    <div class="profile-hero" style="margin-bottom:14px">
      <div class="avatar">${H.initials(emp.name)}</div>
      <div><h2 class="mt0 mb0">${H.esc(emp.name)}</h2><div class="muted">${H.esc(emp.title||'—')} · ${H.esc(emp.department||emp.unit)}</div>
      <div style="margin-top:5px"><span class="badge b-violet">Grade ${grade.code} · ${H.esc(grade.name)}</span> ${jdBadge(jdStatus)}${jd.approvedBy?` <span class="muted" style="font-size:11px">approved by ${H.esc(jd.approvedBy)}</span>`:''}</div>
      <div class="muted" style="font-size:12px;margin-top:4px">${H.esc(emp.email||'')} ${emp.phone?'· '+H.esc(emp.phone):''}</div></div>
    </div>
    <div class="jd-grid">
      <div>
        <div class="card pad" style="box-shadow:none">
          <h3 class="mt0">Job purpose</h3><p class="mb0">${H.esc(purpose)}</p>
          <h3>Key responsibilities</h3><ul class="jd-list">${resp.map(r=>`<li>${H.esc(r)}</li>`).join('')}</ul>
          <h3>Qualifications & experience</h3><ul class="jd-list">${quals.map(q=>`<li>${H.esc(q)}</li>`).join('')}</ul>
          <h3>Competencies</h3>${compCard(comp)}
          <h3>Job architecture</h3>
          <div class="doc-meta">
            <div class="row"><span class="k">Job family</span><span>${H.esc(family)}</span></div>
            <div class="row"><span class="k">Grade / band</span><span>${grade.code} · ${H.esc(arch.band||grade.name)}</span></div>
            <div class="row"><span class="k">Career path</span><span>${H.esc(arch.career||'—')}</span></div>
          </div>
          <h4 style="margin:10px 0 4px">Decision rights</h4><ul class="jd-list">${(arch.decisionRights||[]).map(d=>`<li>${H.esc(d)}</li>`).join('')||'<li class="muted">—</li>'}</ul>
        </div>
      </div>
      <div>
        <div class="card pad doc-meta" style="box-shadow:none">
          <b>Position details</b>
          <div class="row"><span class="k">Job title</span><span>${H.esc(emp.title||'—')}</span></div>
          <div class="row"><span class="k">Department</span><span>${H.esc(emp.department||'—')}</span></div>
          <div class="row"><span class="k">Unit</span><span>${H.esc(emp.unit||'—')}</span></div>
          <div class="row"><span class="k">Location</span><span>${H.esc(emp.location||'—')}</span></div>
          <div class="row"><span class="k">Reports to</span><span>${H.esc(rTo)}</span></div>
          <div class="row"><span class="k">Grade</span><span>${grade.code} · ${H.esc(grade.name)}</span></div>
          <div class="row"><span class="k">Employee ID</span><span class="mono">${H.esc(emp.empId||'—')}</span></div>
        </div>
        ${peers.length?`<div class="card pad" style="box-shadow:none;margin-top:12px"><b>Others in this role</b><div style="margin-top:6px">${peers.slice(0,8).map(p=>`<div style="font-size:12.5px;padding:3px 0">${H.esc(p.name)}</div>`).join('')}</div></div>`:''}
      </div>
    </div>`,
    footer:`<button class="btn" id="cx">Close</button><button class="btn" id="prof">Profile</button>${versions.length?`<button class="btn" id="hist">History (${versions.length})</button>`:''}${acknowledged?'<span class="badge b-green">✓ acknowledged</span>':'<button class="btn" id="ackjd">Acknowledge</button>'}${canSubmit?'<button class="btn" id="submitjd">Submit for approval</button>':''}${canApprove?'<button class="btn primary" id="approvejd">Approve JD</button>':''}<button class="btn primary" id="edit">Edit JD</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('prof').onclick=()=>{ H.closeModal(); openProfile(emp.title, emps); };
  document.getElementById('edit').onclick=()=> editJD(emp, {purpose,resp,rTo,quals}, emps);
  const ackBtn=document.getElementById('ackjd');
  if(ackBtn) ackBtn.onclick=async()=>{ await DB.add('acknowledgments',{docId:jdKey, user:meNow, date:new Date().toISOString(), kind:'JD', person:emp.name}); await logAudit('Acknowledged job description', emp.name, emp.unit); H.toast('JD acknowledged'); openJD(emp, emps); };
  const subBtn=document.getElementById('submitjd');
  if(subBtn) subBtn.onclick=async()=>{ emp.jd={...jd, purpose, responsibilities:resp, reportsTo:rTo, qualifications:quals, status:'Submitted', submittedBy:meNow, submittedAt:new Date().toISOString()}; await DB.put('employees',emp); await logAudit('Submitted JD for approval', emp.name, emp.unit); H.toast('JD submitted for approval'); openJD(emp, emps); };
  const apBtn=document.getElementById('approvejd');
  if(apBtn) apBtn.onclick=async()=>{ const snap={ purpose, responsibilities:resp, reportsTo:rTo, qualifications:quals, approvedBy:meNow, approvedAt:new Date().toISOString(), version:(versions.length+1) };
    emp.jd={...jd, purpose, responsibilities:resp, reportsTo:rTo, qualifications:quals, status:'Approved', approvedBy:meNow, approvedAt:new Date().toISOString(), versions:[...versions, snap]};
    await DB.put('employees',emp); await logAudit('Approved job description', emp.name, emp.unit); H.toast('JD approved (v'+snap.version+')'); openJD(emp, emps); };
  const hBtn=document.getElementById('hist');
  if(hBtn) hBtn.onclick=()=> jdHistory(emp, versions);
}

function jdHistory(emp, versions){
  H.modal({title:`JD version history — ${emp.name}`, size:'md',
    body: versions.length? `<div>${versions.slice().reverse().map(v=>`<div class="card pad" style="box-shadow:none;margin-bottom:8px"><div class="flex between center"><b>Version ${v.version}</b><span class="badge b-green">Approved</span></div>
      <div class="muted" style="font-size:11.5px;margin-top:2px">Approved by ${H.esc(v.approvedBy||'—')} · ${H.fmtDate(v.approvedAt)}</div>
      <div style="margin-top:6px;font-size:12px"><b>Purpose:</b> ${H.esc((v.purpose||'').slice(0,160))}${(v.purpose||'').length>160?'…':''}</div>
      <div style="font-size:12px;margin-top:2px"><b>${(v.responsibilities||[]).length}</b> responsibilities</div></div>`).join('')}</div>`
     : '<div class="empty"><p>No approved versions yet.</p></div>',
    footer:`<button class="btn primary" id="cx">Close</button>`});
  document.getElementById('cx').onclick=H.closeModal;
}
function firstVerb(t){ t=(t||'').toLowerCase(); if(t.includes('manager')||t.includes('head'))return 'lead and manage activities'; if(t.includes('director')||t.includes('chief'))return 'set direction and govern'; if(t.includes('accountant'))return 'process and control financial transactions'; if(t.includes('representative')||t.includes('sales'))return 'drive sales and serve customers'; return 'perform the assigned activities'; }
function defaultQuals(t){ t=(t||'').toLowerCase(); const base=["Relevant degree or professional qualification","Proven experience in a similar role","Strong knowledge of applicable policies, standards and regulations","Good communication and stakeholder-management skills"]; if(t.includes('chief')||t.includes('director')) base.unshift("10+ years experience with senior leadership track record"); return base; }

function editJD(emp, cur, emps){
  H.modal({title:`Edit JD — ${emp.name}`, size:'lg',
    body:`<div class="field"><label>Job purpose</label><textarea class="input" id="p">${H.esc(cur.purpose)}</textarea></div>
      <div class="field"><label>Reports to</label><input class="input" id="r" value="${H.esc(cur.rTo)}"/></div>
      <div class="field"><label>Key responsibilities (one per line)</label><textarea class="input" id="resp" style="min-height:140px">${H.esc(cur.resp.join('\n'))}</textarea></div>
      <div class="field"><label>Qualifications (one per line)</label><textarea class="input" id="q" style="min-height:100px">${H.esc(cur.quals.join('\n'))}</textarea></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save JD</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    emp.jd={ ...(emp.jd||{}), purpose:document.getElementById('p').value.trim(), reportsTo:document.getElementById('r').value.trim(),
      responsibilities:document.getElementById('resp').value.split('\n').map(s=>s.trim()).filter(Boolean),
      qualifications:document.getElementById('q').value.split('\n').map(s=>s.trim()).filter(Boolean),
      status:'Draft' };
    await DB.put('employees',emp); await logAudit('Updated job description (returned to Draft)', emp.name, emp.unit);
    H.toast('Job description saved'); H.closeModal(); openJD(emp, emps);
  };
}

// ---------- Job Titles page ----------
export async function renderJobTitles(c){
  const emps = await DB.getAll('employees');
  const vacancies = await DB.getAll('vacancies');
  const meta = await DB.getMeta();
  const titles={};
  emps.forEach(e=>{ const t=(e.title||'Unspecified').trim(); (titles[t]=titles[t]||[]).push(e); });
  let profiles = Object.keys(titles).sort().map(t=>({title:t, count:titles[t].length, depts:[...new Set(titles[t].map(e=>e.department))], vacant:false}));
  vacancies.forEach(v=> profiles.push({title:v.title, count:0, depts:[v.department], vacant:true, vacancy:v}));

  let q='';
  const plan=(meta.headcountPlan||[]);
  const totF=plan.reduce((a,p)=>a+p.filled,0), totB=plan.reduce((a,p)=>a+p.budgeted,0);
  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">People & Structure</div><h1>Job Titles &amp; Profiles</h1>
    <p>${Object.keys(titles).length} distinct job titles and ${vacancies.length} open (vacant) roles. Click a title to see responsibilities, grade, competencies and the employee(s) assigned.</p></div></div>
  <div class="toolbar">
    <button class="chip active" data-jt="profiles">Job profiles</button>
    <button class="chip" data-jt="headcount">Headcount plan</button>
  </div>
  <div id="jtbody"></div>`;
  const body=document.getElementById('jtbody');
  c.querySelectorAll('[data-jt]').forEach(b=> b.onclick=()=>{ c.querySelectorAll('[data-jt]').forEach(x=>x.classList.toggle('active',x===b)); if(b.dataset.jt==='headcount') drawHeadcount(); else drawProfiles(); });

  function drawHeadcount(){
    body.innerHTML=`
    <div class="kpis" style="margin-bottom:16px">
      <div class="stat"><div class="v">${totB}</div><div class="l">Budgeted positions</div></div>
      <div class="stat"><div class="v">${totF}</div><div class="l">Filled</div></div>
      <div class="stat"><div class="v" style="color:var(--amber)">${totB-totF}</div><div class="l">Open positions</div></div>
      <div class="stat"><div class="v">${totB?Math.round(totF/totB*100):0}%</div><div class="l">Fill rate</div></div>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Department</th><th>Filled</th><th>Budgeted</th><th>Open</th><th style="width:220px">Fill rate</th></tr></thead><tbody>
      ${plan.map(p=>`<tr><td><b>${H.esc(p.department)}</b></td><td>${p.filled}</td><td>${p.budgeted}</td>
        <td>${p.open?`<span class="badge b-amber">${p.open}</span>`:'<span class="muted">0</span>'}</td>
        <td><div class="flex center gap"><div class="bar" style="flex:1"><span style="width:${p.budgeted?Math.round(p.filled/p.budgeted*100):100}%"></span></div><b style="width:42px;text-align:right">${p.budgeted?Math.round(p.filled/p.budgeted*100):100}%</b></div></td></tr>`).join('')}
    </tbody></table></div>`;
  }
  function drawProfiles(){ body.innerHTML=`<div class="toolbar"><input class="input" id="q" placeholder="Search job title…" style="min-width:260px"/><span class="muted" id="c" style="margin-left:auto"></span></div><div id="grid"></div>`; document.getElementById('q').oninput=e=>{ q=e.target.value.toLowerCase(); draw(); }; draw(); }
  const draw=()=>{
    const list=profiles.filter(p=>!q||p.title.toLowerCase().includes(q));
    document.getElementById('c').textContent=`${list.length} profiles`;
    document.getElementById('grid').innerHTML=`<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">
      ${list.map(p=>`<div class="card pad clickable" data-t="${H.esc(p.title)}" style="cursor:pointer">
        <div class="flex between center">${p.vacant?'<span class="badge b-red">Vacant</span>':`<span class="badge b-green">${p.count} assigned</span>`}<span class="muted" style="font-size:11px">${H.esc(p.depts.slice(0,2).join(', '))}</span></div>
        <b style="display:block;margin-top:8px">${H.esc(p.title)}</b>
      </div>`).join('')}
    </div>`;
    document.querySelectorAll('#grid [data-t]').forEach(el=> el.onclick=()=> openProfile(el.dataset.t, emps, vacancies));
  };
  drawProfiles();
}

async function openProfile(title, emps, vacancies){
  const meta = await DB.getMeta();
  vacancies = vacancies || await DB.getAll('vacancies');
  const assigned = emps.filter(e=> (e.title||'').trim()===title);
  const vacancy = vacancies.find(v=> v.title===title);
  const resp = responsibilitiesFor(title, meta.responsibilityLibrary);
  const depts=[...new Set(assigned.map(e=>e.department).filter(Boolean))];
  const grade = gradeFor(title, meta.grades);
  const comp = competenciesFor(title, depts[0]||(vacancy&&vacancy.department), meta.competencyLibrary);
  const family = (meta.departmentFamily && meta.departmentFamily[depts[0]||(vacancy&&vacancy.department)]) || 'General';
  const arch = (meta.gradeArchitecture && meta.gradeArchitecture[grade.code]) || {};
  H.modal({title:'Job Profile', size:'lg',
    body:`
    <div class="flex between center wrap" style="margin-bottom:10px">
      <div><h2 class="mt0 mb0">${H.esc(title)}</h2><div class="muted">${depts.join(', ')||(vacancy?vacancy.department:'')}</div>
        <div style="margin-top:5px"><span class="badge b-violet">Grade ${grade.code} · ${H.esc(grade.name)}</span></div></div>
      ${vacancy&&!assigned.length?'<span class="badge b-red">Vacant role</span>':`<span class="badge b-green">${assigned.length} employee${assigned.length!==1?'s':''} assigned</span>`}
    </div>
    <div class="jd-grid">
      <div class="card pad" style="box-shadow:none">
        <h3 class="mt0">Role summary</h3>
        <p class="mb0">The ${H.esc(title)} (Grade ${grade.code}) is accountable for the responsibilities below, operating within AAA's governance framework, policies and delegation of authority.</p>
        <h3>Key responsibilities</h3><ul class="jd-list">${resp.map(r=>`<li>${H.esc(r)}</li>`).join('')}</ul>
        <h3>Competencies</h3>${compCard(comp)}
        <h3>Job architecture</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag">Family: ${H.esc(family)}</span><span class="tag">Grade ${grade.code} · ${H.esc(arch.band||grade.name)}</span><span class="tag">Career: ${H.esc(arch.career||'—')}</span></div>
        <h4 style="margin:10px 0 4px">Decision rights</h4><ul class="jd-list">${(arch.decisionRights||[]).map(d=>`<li>${H.esc(d)}</li>`).join('')||'<li class="muted">—</li>'}</ul>
        ${vacancy?`<h3>Recruitment</h3><p class="mb0 muted">${H.esc(vacancy.reason||'Open requisition')} · ${H.esc(vacancy.location||'')}</p>`:''}
      </div>
      <div class="card pad" style="box-shadow:none">
        <b>Assigned employees</b>
        <div style="margin-top:8px">
          ${assigned.length? assigned.map(e=>`<div class="flex center gap clickable" data-id="${e._id}" style="padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer">
            <div class="avatar" style="width:30px;height:30px;font-size:11px">${H.initials(e.name)}</div>
            <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px">${H.esc(e.name)}</div><div class="muted" style="font-size:11.5px">${H.esc(e.location||e.unit)}</div></div>
            <span class="link">JD</span></div>`).join('')
          : `<div class="empty" style="padding:20px"><div class="ic">🪑</div><p>This role is currently <b>vacant</b>.</p></div>`}
        </div>
      </div>
    </div>`,
    footer:`<button class="btn primary" id="cx">Close</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.querySelectorAll('.modal [data-id]').forEach(el=> el.onclick=()=>{ const e=assigned.find(x=>x._id===+el.dataset.id); H.closeModal(); openJD(e, emps); });
}
export { openProfile };
