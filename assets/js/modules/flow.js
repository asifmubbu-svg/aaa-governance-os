import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

// ---------- render a process flow as a vertical flowchart ----------
export function renderFlow(steps, employees){
  if(!steps || !steps.length) return `<div class="empty" style="padding:26px"><div class="ic">🧭</div><p>No process flow yet. Use “Design flow” to build one.</p></div>`;
  const roleName=(id)=>({ceo:'CEO',exec:'Executive',hod:'HOD',process_owner:'Process Owner',process_expert:'Process Expert',performer:'Performer',risk:'Risk & Compliance',stakeholder:'Stakeholder'}[id]||id||'');
  return `<div class="flow">${steps.map((s,i)=>{
    const shape = s.type==='start'||s.type==='end' ? 'flow-terminal' : s.type==='decision' ? 'flow-decision' : 'flow-task';
    const last = i===steps.length-1;
    return `<div class="flow-step">
      <div class="flow-node ${shape}">
        <div class="fn-title">${H.esc(s.name)}</div>
        <div class="fn-meta">
          ${s.department?`<span class="badge b-blue">${H.esc(s.department)}</span>`:''}
          ${s.role?`<span class="badge b-violet">${H.esc(roleName(s.role))}</span>`:''}
          ${s.employee?`<span class="badge b-slate">${H.esc(s.employee)}</span>`:''}
          ${s.form?`<span class="badge b-green" title="Form">▤ ${H.esc(s.form)}</span>`:''}
          ${s.risk?`<span class="badge b-red" title="Risk">⚠ ${H.esc(s.risk)}</span>`:''}
          ${s.system?`<span class="badge b-slate" title="System">${H.esc(s.system)}</span>`:''}
        </div>
      </div>
      ${!last?`<div class="flow-arrow">${s.type==='decision'&&s.labels?`<span class="flow-label">${H.esc(s.labels[0])}</span>`:''}<span class="fa-line"></span><span class="fa-head">▼</span></div>`:''}
    </div>`;
  }).join('')}</div>`;
}

// ---------- swimlane view (lanes by department) ----------
export function renderSwimlane(steps, employees){
  if(!steps || !steps.length) return `<div class="empty" style="padding:26px"><div class="ic">🏊</div><p>No process flow to lay out in lanes yet.</p></div>`;
  const lanes=[...new Set(steps.map(s=>s.department||'Unassigned'))];
  const shape=(t)=> t==='decision'?'flow-decision':(t==='start'||t==='end')?'flow-terminal':'flow-task';
  return `<div style="overflow-x:auto"><div class="swim">
    ${lanes.map(lane=>`<div class="swim-lane">
      <div class="swim-head">${H.esc(lane)}</div>
      <div class="swim-track">
        ${steps.map((s,i)=> (s.department||'Unassigned')===lane
          ? `<div class="swim-cell"><div class="flow-node ${shape(s.type)}" style="min-width:140px;max-width:180px;padding:9px 11px">
               <div class="fn-title" style="font-size:12.5px">${H.esc(s.name)}</div>
               <div class="fn-meta">${s.employee?`<span class="badge b-slate">${H.esc(s.employee)}</span>`:''}${s.form?`<span class="badge b-green">▤</span>`:''}${s.risk?`<span class="badge b-red">⚠</span>`:''}</div>
             </div></div>`
          : `<div class="swim-cell"></div>`).join('')}
      </div>
    </div>`).join('')}
    <div class="swim-lane swim-axis"><div class="swim-head"></div><div class="swim-track">${steps.map((s,i)=>`<div class="swim-cell" style="text-align:center;color:var(--muted);font-size:11px">${i+1}${i<steps.length-1?' →':''}</div>`).join('')}</div></div>
  </div></div>`;
}

const SYSTEMS=['SAP','CRM','Infor WMS','RMMS','BOS','Governance OS','DMS','Manual / Paper'];
const STD_FORMS=['Customer Registration & Credit Application','Supplier Qualification Questionnaire','Purchase Requisition Form','Non-Conformance Report (NCR)','CAPA Request Form','Leave Application Form','IT Access Request Form','Change Request Form','Expense Reimbursement Form'];

// ---------- flow editor modal ----------
export async function openFlowEditor(doc, onSaved){
  const roles = await DB.getAll('roles');
  const employees = await DB.getAll('employees');
  const meta = await DB.getMeta();
  const risks = await DB.getAll('risks');
  const customForms = (await DB.getAll('forms')).map(f=>f.title);
  const formList = [...STD_FORMS, ...customForms];
  const systemList = meta.systems || SYSTEMS;
  const optList = (arr, sel)=>`<option value=""></option>`+arr.map(o=>`<option ${o===sel?'selected':''}>${H.esc(o)}</option>`).join('');
  const riskOpts = (sel)=>`<option value=""></option>`+risks.map(r=>`<option value="${H.esc(r.title)}" ${r.title===sel?'selected':''}>${H.esc(r.id)} · ${H.esc(r.title)}</option>`).join('');
  let steps = JSON.parse(JSON.stringify(doc.flow || [
    {name:'Start',type:'start',role:'performer',employee:'',department:''},
    {name:'Task',type:'task',role:'performer',employee:'',department:''},
    {name:'Process complete',type:'end',role:'',employee:'',department:''},
  ]));
  const empOpts = (sel)=>`<option value=""></option>`+employees.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(e=>`<option ${e.name===sel?'selected':''}>${H.esc(e.name)}</option>`).join('');
  const roleOpts = (sel)=>`<option value=""></option>`+roles.map(r=>`<option value="${r.id}" ${r.id===sel?'selected':''}>${H.esc(r.name)}</option>`).join('');
  const deptOpts=(meta.departments||[]);

  const rowHTML=(s,i)=>`<tr data-i="${i}">
    <td><input class="input st-name" value="${H.esc(s.name)}" style="min-width:150px"/></td>
    <td><select class="input st-type">${['start','task','decision','end'].map(t=>`<option ${t===s.type?'selected':''}>${t}</option>`).join('')}</select></td>
    <td><select class="input st-role">${roleOpts(s.role)}</select></td>
    <td><select class="input st-emp">${empOpts(s.employee)}</select></td>
    <td><input class="input st-dept" list="deptlist" value="${H.esc(s.department||'')}" style="min-width:110px"/></td>
    <td><select class="input st-form">${optList(formList, s.form)}</select></td>
    <td><select class="input st-risk">${riskOpts(s.risk)}</select></td>
    <td><select class="input st-sys">${optList(systemList, s.system)}</select></td>
    <td style="white-space:nowrap"><button class="btn ghost sm up">▲</button><button class="btn ghost sm dn">▼</button><button class="btn ghost sm rm">${ICON('trash',14)}</button></td>
  </tr>`;

  const draw=()=>{ document.getElementById('steps').innerHTML=steps.map(rowHTML).join(''); bind(); };
  const collect=()=>{ steps = [...document.querySelectorAll('#steps tr')].map(tr=>({
      name:tr.querySelector('.st-name').value, type:tr.querySelector('.st-type').value,
      role:tr.querySelector('.st-role').value, employee:tr.querySelector('.st-emp').value,
      department:tr.querySelector('.st-dept').value, form:tr.querySelector('.st-form').value,
      risk:tr.querySelector('.st-risk').value, system:tr.querySelector('.st-sys').value })); };
  const bind=()=>{
    document.querySelectorAll('#steps tr').forEach(tr=>{ const i=+tr.dataset.i;
      tr.querySelector('.up').onclick=()=>{ collect(); if(i>0){ [steps[i-1],steps[i]]=[steps[i],steps[i-1]]; draw(); } };
      tr.querySelector('.dn').onclick=()=>{ collect(); if(i<steps.length-1){ [steps[i+1],steps[i]]=[steps[i],steps[i+1]]; draw(); } };
      tr.querySelector('.rm').onclick=()=>{ collect(); steps.splice(i,1); draw(); };
    });
  };

  H.modal({title:`Design process flow — ${doc.title}`, size:'lg',
    body:`<datalist id="deptlist">${deptOpts.map(d=>`<option>${H.esc(d)}</option>`).join('')}</datalist>
    <p class="muted" style="margin-top:0">Add the steps in order. Link each step to a <b>role</b>, an <b>employee</b> and a <b>department</b>. The flowchart and role-based RACI are generated from these steps.</p>
    <div class="table-wrap"><table><thead><tr><th>Step</th><th>Type</th><th>Role</th><th>Employee</th><th>Department</th><th>Form</th><th>Risk</th><th>System</th><th></th></tr></thead><tbody id="steps"></tbody></table></div>
    <button class="btn sm" id="addstep" style="margin-top:10px">${ICON('plus',14)} Add step</button>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save flow</button>`});
  draw();
  document.getElementById('addstep').onclick=()=>{ collect(); steps.push({name:'New step',type:'task',role:'performer',employee:'',department:steps[0]?.department||''}); draw(); };
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    collect();
    doc.flow=steps;
    doc.linkedEmployees=[...new Set(steps.map(s=>s.employee).filter(Boolean))];
    doc.linkedDepartments=[...new Set(steps.map(s=>s.department).filter(Boolean))];
    await DB.put('documents',doc);
    await logAudit('Updated process flow', doc.title, doc.entity);
    H.toast('Process flow saved'); H.closeModal(); onSaved&&onSaved();
  };
}

// ---------- generate role-based RACI from a process flow (Nintex methodology) ----------
export async function generateRaciFromFlow(doc){
  if(!doc.flow || !doc.flow.length){ H.toast('Design a flow first'); return false; }
  const rolesInFlow = new Set(doc.flow.map(s=>s.role).filter(Boolean));
  // methodology: performers = Responsible, process owner = Accountable,
  // experts = Consulted, HOD accountable oversight, risk consulted, exec/ceo/stakeholders informed
  const a={};
  a['CEO']='I';
  a['Executive Management']= (doc.domain==='GOV'||doc.domain==='RSK'||doc.domain==='OPS')?'A':'I';
  a['Head of Department (HOD)']='A';
  a['Process Owner']= rolesInFlow.has('process_owner')?'A':'R';
  a['Process Expert']= rolesInFlow.has('process_expert')?'C':'C';
  a['Process Performer']= rolesInFlow.has('performer')||rolesInFlow.has('hod')?'R':'R';
  a['Risk & Compliance']= (doc.riskLevel==='High'||doc.riskLevel==='Medium')?'C':'I';
  a['Stakeholder']='I';
  const rows = await DB.getAll('raci');
  const existing = rows.find(r=>r.docId===doc.id);
  const row = { process:doc.title, docId:doc.id, domain:doc.domain, assignments:a };
  if(existing){ row._id=existing._id; await DB.put('raci',row); } else { await DB.add('raci',row); }
  await logAudit('Generated RACI from process flow', doc.title, doc.entity);
  H.toast('Role-based RACI generated from the flow');
  return true;
}

// ---------- Processes page ----------
export async function renderProcesses(c){
  const docs = await DB.getAll('documents');
  const withFlow = docs.filter(d=>d.flow && d.flow.length);
  const processes = docs.filter(d=>d.type==='Process' || d.type==='SOP');
  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Knowledge Base</div><h1>Process Flows</h1>
    <p>Design and govern business processes as flowcharts. Each step links to a role, an employee and a department — and drives the RACI matrix.</p></div>
    <div class="page-actions"><button class="btn primary" id="new">${ICON('plus')} New process</button></div>
  </div>
  <div class="toolbar"><span class="muted">${withFlow.length} processes have a designed flow · ${processes.length} process/SOP artifacts</span></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
    ${processes.map(d=>`<div class="card pad clickable" data-id="${d.id}" style="cursor:pointer">
      <div class="flex between center"><span class="mono muted">${d.id}</span>${d.flow&&d.flow.length?`<span class="badge b-green">${d.flow.length} steps</span>`:'<span class="badge b-slate">No flow</span>'}</div>
      <b style="display:block;margin:8px 0 4px">${H.esc(d.title)}</b>
      <div class="muted" style="font-size:12.5px">${H.esc(d.domainName)}</div>
    </div>`).join('')}
  </div>`;
  c.querySelectorAll('[data-id]').forEach(el=> el.onclick=()=> location.hash='#/repository/'+el.dataset.id);
  document.getElementById('new').onclick=async()=>{
    const domains=await DB.getAll('domains');
    const doc={ id:'PRC-'+domains[0].code+'-'+(Math.floor(Math.random()*900)+100), title:'New Process', type:'Process',
      domain:domains[0].code, domainName:domains[0].name, entity:'AAA Holding', owner:'', status:'Draft', version:'0.1',
      riskLevel:'Medium', effectiveDate:new Date().toISOString().slice(0,10), reviewDate:'2027-07-01',
      acknowRequired:false, tags:['Process'], sections:[{heading:'1. Purpose',body:''}], approval:{hod:{approver:'',status:'Pending',at:''},exec:{approver:'',status:'Pending',at:''}}, flow:[] };
    await DB.add('documents',doc); await logAudit('Created process', doc.title, doc.entity);
    location.hash='#/repository/'+doc.id;
  };
}
