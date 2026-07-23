import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

const TODAY = new Date('2026-07-23');
const canEdit = ()=> ({Author:2,HOD:3,Executive:4,Admin:5}[(DB.getCurrentUser&&DB.getCurrentUser()?.role)]||0) >= 2;
const me = ()=> (DB.getCurrentUser&&DB.getCurrentUser()?.name) || '';
const rBadge = (s)=>{ const m={Completed:'b-green','In Progress':'b-blue',Assigned:'b-amber',Overdue:'b-red'}; return `<span class="badge ${m[s]||'b-slate'}">${H.esc(s)}</span>`; };
let tab='courses';

function eff(r){ if(r.status!=='Completed' && r.dueDate && new Date(r.dueDate)<TODAY) return 'Overdue'; return r.status; }

export async function renderTraining(c){
  const [courses, records, emps] = await Promise.all([
    DB.getAll('trainings').catch(()=>[]), DB.getAll('trainingRecords').catch(()=>[]), DB.getAll('employees')
  ]);
  const totalAssign=records.length;
  const completed=records.filter(r=>r.status==='Completed').length;
  const overdue=records.filter(r=>eff(r)==='Overdue').length;
  const rate= totalAssign?Math.round(completed/totalAssign*100):0;

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Compliance & Assurance</div><h1>Training & Awareness</h1>
    <p>Compliance training library linked to policies, with per-employee assignment and completion tracking.</p></div>
    <div class="page-actions">${canEdit()?`<button class="btn primary" id="new">${ICON('plus')} New course</button>`:''}</div>
  </div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="stat"><div class="v">${courses.length}</div><div class="l">Courses</div></div>
    <div class="stat"><div class="v">${totalAssign}</div><div class="l">Assignments</div></div>
    <div class="stat"><div class="v" style="color:var(--green)">${rate}%</div><div class="l">Completion rate</div></div>
    <div class="stat"><div class="v" style="color:var(--red)">${overdue}</div><div class="l">Overdue</div></div>
  </div>
  <div class="toolbar">
    <button class="chip ${tab==='courses'?'active':''}" data-t="courses">Course library</button>
    <button class="chip ${tab==='records'?'active':''}" data-t="records">Assignments &amp; completion</button>
  </div>
  <div id="tbody"></div>`;
  if(document.getElementById('new')) document.getElementById('new').onclick=()=> editCourse(null);
  c.querySelectorAll('[data-t]').forEach(b=> b.onclick=()=>{ tab=b.dataset.t; renderTraining(c); });
  const body=document.getElementById('tbody');

  if(tab==='courses'){
    body.innerHTML=`<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
      ${courses.map(t=>{ const recs=records.filter(r=>r.trainingId===t.id); const done=recs.filter(r=>r.status==='Completed').length;
        return `<div class="card pad clickable" data-id="${t._id}" style="cursor:pointer">
        <div class="flex between center">${t.mandatory?'<span class="badge b-red">Mandatory</span>':'<span class="badge b-slate">Optional</span>'}<span class="muted" style="font-size:11px">${H.esc(t.category)}</span></div>
        <b style="display:block;margin-top:8px">${H.esc(t.title)}</b>
        <p class="mb0 muted" style="font-size:12px;margin-top:4px">${H.esc(t.summary||'')}</p>
        <div class="flex center gap" style="margin-top:10px"><div class="bar" style="flex:1"><span style="width:${recs.length?Math.round(done/recs.length*100):0}%"></span></div><b style="font-size:12px">${done}/${recs.length}</b></div>
      </div>`; }).join('')||'<div class="empty"><p>No courses.</p></div>'}
    </div>`;
    body.querySelectorAll('[data-id]').forEach(el=> el.onclick=()=>{ const t=courses.find(x=>x._id===+el.dataset.id); openCourse(t, records, emps); });
  } else {
    const rows=records.slice().sort((a,b)=> new Date(a.dueDate)-new Date(b.dueDate));
    body.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Course</th><th>Employee</th><th>Assigned</th><th>Due</th><th>Status</th><th>Score</th></tr></thead><tbody>
      ${rows.map(r=>{ const t=courses.find(x=>x.id===r.trainingId)||{}; return `<tr class="clickable" data-id="${r._id}" style="cursor:pointer">
        <td>${H.esc(t.title||r.trainingId)}</td><td>${H.esc(r.employee)}</td><td>${H.fmtDate(r.assignedDate)}</td>
        <td>${H.fmtDate(r.dueDate)}</td><td>${rBadge(eff(r))}</td><td>${r.score!=null?r.score+'%':'—'}</td></tr>`; }).join('')}
    </tbody></table></div>`;
    body.querySelectorAll('[data-id]').forEach(el=> el.onclick=()=>{ const r=records.find(x=>x._id===+el.dataset.id); markRecord(r, courses); });
  }
}

function openCourse(t, records, emps){
  const recs=records.filter(r=>r.trainingId===t.id);
  H.modal({title:t.title, size:'lg',
    body:`<div class="doc-meta">
      <div class="row"><span class="k">Category</span><span>${H.esc(t.category)}</span></div>
      <div class="row"><span class="k">Mandatory</span><span>${t.mandatory?'Yes':'No'}</span></div>
      <div class="row"><span class="k">Frequency</span><span>${H.esc(t.frequency||'—')}</span></div>
      <div class="row"><span class="k">Owner</span><span>${H.esc(t.owner||'—')}</span></div>
      <div class="row"><span class="k">Duration</span><span>${t.durationMins?t.durationMins+' min':'—'}</span></div>
      <div class="row"><span class="k">Linked policies</span><span>${(t.linkedDocs||[]).map(x=>`<span class="tag">${H.esc(x)}</span>`).join('')||'—'}</span></div>
    </div>
    <h4 style="margin:12px 0 4px">Summary</h4><p class="mb0">${H.esc(t.summary||'—')}</p>
    <h4 style="margin:12px 0 4px">Assignments (${recs.length})</h4>
    <div class="table-wrap"><table><thead><tr><th>Employee</th><th>Due</th><th>Status</th></tr></thead><tbody>
      ${recs.map(r=>`<tr><td>${H.esc(r.employee)}</td><td>${H.fmtDate(r.dueDate)}</td><td>${r.status}</td></tr>`).join('')||'<tr><td colspan="3" class="muted">No assignments.</td></tr>'}
    </tbody></table></div>`,
    footer:`<button class="btn" id="cx">Close</button>${canEdit()?`<button class="btn" id="assign">Assign employee</button><button class="btn primary" id="edit">Edit course</button>`:''}`});
  document.getElementById('cx').onclick=H.closeModal;
  if(document.getElementById('edit')) document.getElementById('edit').onclick=()=> editCourse(t);
  if(document.getElementById('assign')) document.getElementById('assign').onclick=()=> assignCourse(t, emps);
}

function assignCourse(t, emps){
  const empOpts= emps.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(e=>`<option>${H.esc(e.name)}</option>`).join('');
  H.modal({title:`Assign — ${t.title}`, size:'md',
    body:`<div class="field"><label>Employee</label><select class="input" id="emp"><option value="">— select —</option>${empOpts}</select></div>
      <div class="field"><label>Due date</label><input class="input" type="date" id="due"/></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Assign</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    const emp=document.getElementById('emp').value; if(!emp){ H.toast('Select an employee'); return; }
    await DB.add('trainingRecords',{ id:'TR-'+Math.random().toString().slice(2,6), trainingId:t.id, employee:emp,
      assignedDate:new Date().toISOString(), dueDate:document.getElementById('due').value, completedDate:'', status:'Assigned', score:null });
    await logAudit('Assigned training', t.id, emp); H.toast('Assigned'); H.closeModal(); location.hash='#/training';
  };
}

function markRecord(r, courses){
  const t=courses.find(x=>x.id===r.trainingId)||{};
  H.modal({title:`${t.title||r.trainingId} — ${r.employee}`, size:'md',
    body:`<div class="doc-meta">
      <div class="row"><span class="k">Assigned</span><span>${H.fmtDate(r.assignedDate)}</span></div>
      <div class="row"><span class="k">Due</span><span>${H.fmtDate(r.dueDate)}</span></div>
      <div class="row"><span class="k">Status</span><span>${rBadge(eff(r))}</span></div>
    </div>
    <div class="field" style="margin-top:10px"><label>Status</label><select class="input" id="st">${['Assigned','In Progress','Completed'].map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
    <div class="field"><label>Score (%)</label><input class="input" type="number" id="sc" value="${r.score!=null?r.score:''}"/></div>`,
    footer:`<button class="btn" id="cx">Close</button><button class="btn primary" id="sv">Save</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    r.status=document.getElementById('st').value; const sc=document.getElementById('sc').value; r.score=sc===''?null:+sc;
    if(r.status==='Completed' && !r.completedDate) r.completedDate=new Date().toISOString();
    await DB.put('trainingRecords',r); await logAudit('Updated training record', r.trainingId, r.employee); H.toast('Saved'); H.closeModal(); location.hash='#/training';
  };
}

function editCourse(existing){
  const t=existing||{mandatory:true,category:'Governance',frequency:'Annual'};
  H.modal({title: existing?'Edit course':'New course', size:'lg',
    body:`<div class="field"><label>Title</label><input class="input" id="t" value="${H.esc(t.title||'')}"/></div>
      <div class="two-col">
        <div class="field"><label>Category</label><input class="input" id="cat" value="${H.esc(t.category||'')}"/></div>
        <div class="field"><label>Frequency</label><input class="input" id="freq" value="${H.esc(t.frequency||'')}"/></div>
      </div>
      <div class="two-col">
        <div class="field"><label>Owner</label><input class="input" id="own" value="${H.esc(t.owner||'')}"/></div>
        <div class="field"><label>Duration (min)</label><input class="input" type="number" id="dur" value="${t.durationMins||''}"/></div>
      </div>
      <div class="field"><label><input type="checkbox" id="mand" ${t.mandatory?'checked':''}/> Mandatory</label></div>
      <div class="field"><label>Linked policies (comma-separated doc IDs)</label><input class="input" id="docs" value="${H.esc((t.linkedDocs||[]).join(', '))}"/></div>
      <div class="field"><label>Summary</label><textarea class="input" id="sum" style="min-height:64px">${H.esc(t.summary||'')}</textarea></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">${existing?'Save':'Create'}</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    const obj={ ...t, title:document.getElementById('t').value.trim(), category:document.getElementById('cat').value.trim(),
      frequency:document.getElementById('freq').value.trim(), owner:document.getElementById('own').value.trim(),
      durationMins:+document.getElementById('dur').value||null, mandatory:document.getElementById('mand').checked,
      linkedDocs:document.getElementById('docs').value.split(',').map(s=>s.trim()).filter(Boolean), summary:document.getElementById('sum').value.trim() };
    if(!obj.title){ H.toast('Title required'); return; }
    if(!existing){ obj.id='TRN-'+Math.random().toString().slice(2,5); }
    if(existing) await DB.put('trainings',obj); else await DB.add('trainings',obj);
    await logAudit(existing?'Updated training course':'Created training course', obj.id, obj.title); H.toast('Saved'); H.closeModal(); location.hash='#/training';
  };
}
