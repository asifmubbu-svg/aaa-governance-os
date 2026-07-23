import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';
import { openJD, jobProfileFor } from './jobTitles.js';

let tab='people';
export async function renderOrganization(c){
  const emps = await DB.getAll('employees');
  const entities = await DB.getAll('entities');
  const meta = await DB.getMeta();

  c.innerHTML=`
  <div class="page-head">
    <div><div class="eyebrow">People & Structure</div><h1>Organization</h1>
    <p>${emps.length} employees across ${entities.length} entities, ${new Set(emps.map(e=>e.department)).size} departments and ${new Set(emps.map(e=>e.location)).size} locations. Click any person to see their Job Description.</p></div>
    <div class="page-actions"><button class="btn primary" id="new-emp">${ICON('plus')} Add employee</button></div>
  </div>
  <div class="toolbar">
    <button class="chip ${tab==='people'?'active':''}" data-tab="people">Directory</button>
    <button class="chip ${tab==='entity'?'active':''}" data-tab="entity">Entity structure</button>
    <button class="chip ${tab==='dept'?'active':''}" data-tab="dept">Departmental structure</button>
  </div>
  <div id="org-body"></div>`;

  c.querySelectorAll('[data-tab]').forEach(b=> b.onclick=()=>{ tab=b.dataset.tab; renderOrganization(c); });
  const body=document.getElementById('org-body');
  document.getElementById('new-emp').onclick=()=> editEmp(null, meta, ()=>renderOrganization(c));

  if(tab==='people') drawPeople(body, emps, meta, ()=>renderOrganization(c));
  else if(tab==='entity') drawEntity(body, entities, emps);
  else drawDept(body, emps, entities);
}

function drawPeople(body, emps, meta, refresh){
  body.innerHTML=`
  <div class="toolbar">
    <input class="input" id="q" placeholder="Search name, title, email…" style="min-width:260px"/>
    <select class="input" id="f-unit"><option value="">All units</option>${(meta.units||[]).map(u=>`<option>${u}</option>`).join('')}</select>
    <select class="input" id="f-dept"><option value="">All departments</option>${(meta.departments||[]).map(d=>`<option>${d}</option>`).join('')}</select>
    <span class="muted" id="c" style="margin-left:auto"></span>
  </div><div id="ppl"></div>`;
  const draw=()=>{
    const q=document.getElementById('q').value.toLowerCase(), fu=document.getElementById('f-unit').value, fd=document.getElementById('f-dept').value;
    let list=emps.filter(e=> (!q|| (e.name+e.title+e.email).toLowerCase().includes(q)) && (!fu||e.unit===fu) && (!fd||e.department===fd));
    list.sort((a,b)=>a.name.localeCompare(b.name));
    document.getElementById('c').textContent=`${list.length} of ${emps.length}`;
    document.getElementById('ppl').innerHTML=`<div class="table-wrap"><table><thead><tr>
      <th>Name</th><th>Title</th><th>Department</th><th>Unit</th><th>Location</th><th></th></tr></thead><tbody>
      ${list.map(e=>`<tr class="clickable" data-id="${e._id}">
        <td><div class="flex center gap"><div class="avatar" style="width:30px;height:30px;font-size:11px">${H.initials(e.name)}</div><b>${H.esc(e.name)}</b></div></td>
        <td>${H.esc(e.title||'—')}</td><td>${H.esc(e.department||'—')}</td><td>${H.esc(e.unit)}</td><td>${H.esc(e.location||'—')}</td>
        <td><div class="flex gap"><button class="btn ghost sm jd">${ICON('eye',14)} JD</button><button class="btn ghost sm ed">${ICON('edit',14)}</button></div></td></tr>`).join('')}
    </tbody></table></div>`;
    document.querySelectorAll('#ppl tr[data-id]').forEach(tr=>{
      const id=+tr.dataset.id; const emp=list.find(x=>x._id===id);
      tr.querySelector('.jd').onclick=(ev)=>{ ev.stopPropagation(); openJD(emp, emps); };
      tr.querySelector('.ed').onclick=(ev)=>{ ev.stopPropagation(); editEmp(emp, meta, refresh); };
      tr.onclick=()=> openJD(emp, emps);
    });
  };
  ['q','f-unit','f-dept'].forEach(id=> document.getElementById(id).oninput=draw); draw();
}

function editEmp(emp, meta, refresh){
  const isNew=!emp; const e=emp||{name:'',title:'',department:meta.departments[0]||'',unit:meta.units[0]||'',location:'',email:'',phone:'',empId:''};
  H.modal({title:isNew?'Add employee':'Edit employee',
    body:`<div class="field-row">
      <div class="field"><label>Full name</label><input class="input" id="n" value="${H.esc(e.name)}"/></div>
      <div class="field"><label>Employee ID</label><input class="input" id="eid" value="${H.esc(e.empId)}"/></div></div>
      <div class="field"><label>Title</label><input class="input" id="t" value="${H.esc(e.title)}"/></div>
      <div class="field-row">
      <div class="field"><label>Department</label><input class="input" id="d" list="depts" value="${H.esc(e.department)}"/><datalist id="depts">${(meta.departments||[]).map(x=>`<option>${x}</option>`).join('')}</datalist></div>
      <div class="field"><label>Unit</label><select class="input" id="u">${(meta.units||[]).map(x=>`<option ${x===e.unit?'selected':''}>${x}</option>`).join('')}</select></div></div>
      <div class="field"><label>Location</label><input class="input" id="loc" value="${H.esc(e.location)}"/></div>
      <div class="field-row">
      <div class="field"><label>Email</label><input class="input" id="em" value="${H.esc(e.email)}"/></div>
      <div class="field"><label>Phone</label><input class="input" id="ph" value="${H.esc(e.phone)}"/></div></div>`,
    footer:`<button class="btn" id="cx">Cancel</button>${isNew?'':'<button class="btn danger" id="dl">Delete</button>'}<button class="btn primary" id="sv">${isNew?'Add':'Save'}</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  const g=id=>document.getElementById(id).value.trim();
  document.getElementById('sv').onclick=async()=>{
    const o={...e,name:g('n'),empId:g('eid'),title:g('t'),department:g('d'),unit:document.getElementById('u').value,location:g('loc'),email:g('em'),phone:g('ph')};
    if(!o.name){ H.toast('Name required'); return; }
    if(isNew) await DB.add('employees',o); else await DB.put('employees',o);
    await logAudit(isNew?'Added employee':'Updated employee', o.name, o.unit);
    H.toast(isNew?'Employee added':'Employee updated'); H.closeModal(); refresh();
  };
  const dl=document.getElementById('dl');
  if(dl) dl.onclick=()=> H.confirmDialog(`Remove ${e.name} from the directory?`, async()=>{ await DB.del('employees',e._id); H.toast('Employee removed'); H.closeModal(); refresh(); });
}

// ---------- Entity structure chart ----------
function drawEntity(body, entities, emps){
  const holding=entities.find(e=>e.type==='Holding')||entities[0];
  const subs=entities.filter(e=>e!==holding);
  const countFor=(x)=> emps.filter(e=> e.unit && (x.name.toLowerCase().split(' ')[0]===(e.unit||'').toLowerCase().split(' ')[0])).length;
  body.innerHTML=`<div class="card pad">
    <p class="muted mt0">Legal entity structure of the group. ${entities.length} entities under ${H.esc(holding.name)}.</p>
    <div class="orgchart">
      <div class="oc-node root"><div class="ocn">${H.esc(holding.name)}</div><div class="oct">${H.esc(holding.type)} · Est. ${holding.est}</div></div>
      <div class="oc-connector"></div>
      <div class="oc-level">
        ${subs.map(s=>`<div class="oc-node" style="border-top:3px solid ${s.color}"><div class="ocn">${H.esc(s.name)}</div><div class="oct">${H.esc(s.type)}</div><div class="ocb"><span class="badge b-slate">Est. ${s.est}</span></div></div>`).join('')}
      </div>
    </div>
  </div>`;
}

// ---------- Departmental structure chart ----------
function drawDept(body, emps, entities){
  const byDept={}; emps.forEach(e=>{ const d=e.department||'Unassigned'; (byDept[d]=byDept[d]||[]).push(e); });
  const execs=emps.filter(e=>e.department==='Executive');
  const ceo=execs.find(e=>/chief executive/i.test(e.title||''))||execs[0];
  const depts=Object.keys(byDept).filter(d=>d!=='Executive').sort((a,b)=>byDept[b].length-byDept[a].length);
  body.innerHTML=`<div class="card pad">
    <p class="muted mt0">Departmental hierarchy under executive leadership. Click a department to see its people; click a person for their Job Description.</p>
    <div class="orgchart">
      <div class="oc-node root"><div class="ocn">${H.esc(ceo?ceo.name:'CEO')}</div><div class="oct">${H.esc(ceo?ceo.title:'Chief Executive Officer')}</div></div>
      <div class="oc-connector"></div>
      <div class="oc-level">
        ${depts.map(d=>`<div class="oc-node dept" data-d="${H.esc(d)}"><div class="ocn">${H.esc(d)}</div><div class="oct">${byDept[d].length} people</div></div>`).join('')}
      </div>
    </div>
  </div>`;
  body.querySelectorAll('.oc-node.dept').forEach(n=> n.onclick=()=> showDeptPeople(n.dataset.d, byDept[n.dataset.d], emps));
}
function showDeptPeople(dept, people, emps){
  H.modal({title:`${dept} — ${people.length} people`, size:'lg',
    body:`<div class="table-wrap"><table><thead><tr><th>Name</th><th>Title</th><th>Location</th></tr></thead><tbody>
      ${people.sort((a,b)=>a.name.localeCompare(b.name)).map(e=>`<tr class="clickable" data-id="${e._id}"><td><b>${H.esc(e.name)}</b></td><td>${H.esc(e.title||'—')}</td><td>${H.esc(e.location||'—')}</td></tr>`).join('')}
    </tbody></table></div>`,
    footer:`<button class="btn" id="cx">Close</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.querySelectorAll('.modal tr[data-id]').forEach(tr=> tr.onclick=()=>{ const e=people.find(x=>x._id===+tr.dataset.id); H.closeModal(); openJD(e, emps); });
}
