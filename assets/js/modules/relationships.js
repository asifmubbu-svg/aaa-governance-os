import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';

let focusType='Document', focusId='';

export async function renderRelationships(c){
  const [docs, reqs, risks, controls, procs, raci, emps] = await Promise.all([
    DB.getAll('documents'), DB.getAll('requirements').catch(()=>[]), DB.getAll('risks').catch(()=>[]),
    DB.getAll('controls').catch(()=>[]), DB.getAll('processes').catch(()=>[]), DB.getAll('raci').catch(()=>[]), DB.getAll('employees')
  ]);
  const store={Document:docs,Requirement:reqs,Risk:risks,Control:controls,Process:procs};
  const idOf=(t,r)=> t==='Process'?r.id:r.id;
  const labelOf=(t,r)=> t==='Process'?r.name:(r.title||r.transactionType||r.name);
  const list = store[focusType]||[];
  if(!focusId && list.length) focusId=idOf(focusType,list[0]);
  const focus = list.find(r=>idOf(focusType,r)===focusId) || list[0];

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Intelligence & Reporting</div><h1>Relationship Explorer</h1>
    <p>See how governance records connect — upstream and downstream — and answer impact questions like "which controls support this policy?" or "which documents are affected by this regulation?"</p></div></div>
  <div class="toolbar">
    <select class="input" id="ft">${['Document','Requirement','Risk','Control','Process'].map(t=>`<option ${t===focusType?'selected':''}>${t}</option>`).join('')}</select>
    <select class="input" id="fr" style="min-width:320px">${list.map(r=>`<option value="${H.esc(idOf(focusType,r))}" ${idOf(focusType,r)===focusId?'selected':''}>${H.esc((r.id?r.id+' · ':'')+labelOf(focusType,r))}</option>`).join('')}</select>
  </div>
  <div id="rel"></div>`;
  document.getElementById('ft').onchange=(e)=>{ focusType=e.target.value; focusId=''; renderRelationships(c); };
  document.getElementById('fr').onchange=(e)=>{ focusId=e.target.value; renderRelationships(c); };
  if(!focus){ document.getElementById('rel').innerHTML=`<div class="empty"><p>No records of this type.</p></div>`; return; }

  const groups = connections(focusType, focus, {docs,reqs,risks,controls,procs,raci});
  const impacts = impactQuestions(focusType, focus, groups);
  const total = groups.reduce((a,g)=>a+g.items.length,0);

  document.getElementById('rel').innerHTML=`
  <div class="card pad" style="margin-bottom:14px">
    <div class="flex center gap"><div class="tile-ic" style="background:color-mix(in srgb,var(--green) 14%,transparent);color:var(--green)">${ICON('graph',20)}</div>
      <div><b style="font-size:15px">${H.esc(focus.title||focus.name||focus.transactionType)}</b><div class="muted" style="font-size:12px">${H.esc(focus.id||'')} · ${focusType} · ${total} connections</div></div></div>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
    ${groups.filter(g=>g.items.length).map(g=>`<div class="card pad"><div class="flex center gap" style="margin-bottom:6px">${ICON(g.icon,15)}<b>${H.esc(g.name)}</b><span class="muted" style="font-size:12px">(${g.items.length})</span></div>
      ${g.items.map(it=>`<div class="${it.hash?'link':''}" ${it.hash?`data-h="${it.hash}"`:''} style="font-size:12.5px;padding:4px 0;cursor:${it.hash?'pointer':'default'}">${H.esc(it.label)}</div>`).join('')}</div>`).join('') || '<div class="empty"><p>No linked records. Link risks, controls and requirements to build the map.</p></div>'}
  </div>
  <div class="card pad" style="margin-top:14px"><b>Impact analysis</b>
    <div style="margin-top:8px">${impacts.map(q=>`<div style="padding:8px 0;border-bottom:1px solid var(--border)"><b style="font-size:13px">${H.esc(q.q)}</b><div class="muted" style="font-size:12.5px;margin-top:2px">${q.a}</div></div>`).join('')}</div>
  </div>`;
  document.querySelectorAll('#rel [data-h]').forEach(el=> el.onclick=()=> location.hash=el.dataset.h);
}

function connections(type, f, D){
  const g=(name,icon,items)=>({name,icon,items});
  const docLink=id=>({label:id,hash:'#/repository/'+id});
  if(type==='Document'){
    return [
      g('Requirements citing this','book', D.reqs.filter(r=>(r.linkedDocs||[]).includes(f.id)).map(r=>({label:`${r.id} ${r.title}`,hash:'#/requirements'}))),
      g('Linked risks','alert', D.risks.filter(r=>(r.linkedDocs||[]).includes(f.id)).map(r=>({label:`${r.id} ${r.title}`,hash:'#/risks'}))),
      g('Departments','org', (f.linkedDepartments||[]).map(x=>({label:x}))),
      g('People','user', (f.linkedEmployees||[]).map(x=>({label:x}))),
      g('RACI roles','table', ((D.raci.find(x=>x.docId===f.id)||{}).assignments? Object.entries(D.raci.find(x=>x.docId===f.id).assignments).filter(([k,v])=>v!=='-').map(([k,v])=>({label:`${k}: ${v}`,hash:'#/raci'})):[])),
    ];
  }
  if(type==='Requirement'){
    return [
      g('Policies satisfying this','book', (f.linkedDocs||[]).map(docLink)),
      g('Risks','alert', (f.linkedRisks||[]).map(id=>({label:id,hash:'#/risks'}))),
      g('Controls','shield', (f.linkedControls||[]).map(id=>({label:id,hash:'#/risks'}))),
    ];
  }
  if(type==='Risk'){
    return [
      g('Mitigating controls','shield', D.controls.filter(c=>(c.riskIds||[]).includes(f.id)).map(c=>({label:`${c.id} ${c.title}`,hash:'#/risks'}))),
      g('Linked policies','book', (f.linkedDocs||[]).map(docLink)),
      g('Requirements','table', D.reqs.filter(r=>(r.linkedRisks||[]).includes(f.id)).map(r=>({label:`${r.id} ${r.title}`,hash:'#/requirements'}))),
    ];
  }
  if(type==='Control'){
    return [
      g('Risks mitigated','alert', D.risks.filter(r=>(r.controlIds||[]).includes(f.id)).map(r=>({label:`${r.id} ${r.title}`,hash:'#/risks'}))),
      g('Requirements','book', D.reqs.filter(r=>(r.linkedControls||[]).includes(f.id)).map(r=>({label:`${r.id} ${r.title}`,hash:'#/requirements'}))),
    ];
  }
  // Process
  return [
    g('Risks','alert', (f.risks||[]).map(x=>({label:x}))),
    g('Controls','shield', (f.controls||[]).map(x=>({label:x}))),
    g('Systems','grid', (f.systems||[]).map(x=>({label:x}))),
    g('Forms','form', (f.forms||[]).map(x=>({label:x}))),
    g('Owner','user', f.owner?[{label:f.owner}]:[]),
  ];
}

function impactQuestions(type, f, groups){
  const cnt=n=> (groups.find(g=>g.name===n)||{items:[]}).items.length;
  if(type==='Document') return [
    {q:'Which requirements depend on this document?', a:`${cnt('Requirements citing this')} requirement(s) reference it — changing it may affect compliance evidence.`},
    {q:'What risks relate to this document?', a:`${cnt('Linked risks')} linked risk(s).`},
    {q:'Who is affected if this changes?', a:`${cnt('People')} named people, ${cnt('Departments')} department(s), and the roles in its RACI.`},
  ];
  if(type==='Requirement') return [
    {q:'Which policies satisfy this regulation?', a:`${cnt('Policies satisfying this')} policy/policies mapped.`},
    {q:'Which controls support it?', a:`${cnt('Controls')} control(s).`},
    {q:'What is the exposure if it is not met?', a:`${cnt('Risks')} associated risk(s); status: ${f.complianceStatus}.`},
  ];
  if(type==='Risk') return [
    {q:'Which controls mitigate this risk?', a:`${cnt('Mitigating controls')} control(s).`},
    {q:'Which policies address it?', a:`${cnt('Linked policies')} policy/policies.`},
  ];
  if(type==='Control') return [
    {q:'Which risks does this control mitigate?', a:`${cnt('Risks mitigated')} risk(s).`},
    {q:'Which requirements rely on it?', a:`${cnt('Requirements')} requirement(s).`},
  ];
  return [{q:'What does this process touch?', a:`${cnt('Risks')} risks, ${cnt('Controls')} controls, ${cnt('Systems')} systems, ${cnt('Forms')} forms.`}];
}
