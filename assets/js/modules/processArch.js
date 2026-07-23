import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { renderCanvasSVG, openCanvasEditor } from './canvas.js';
import { logAudit } from './repository.js';

const me = ()=> (DB.getCurrentUser&&DB.getCurrentUser()?.role) || 'Viewer';
const canEdit = ()=> ({Author:2,HOD:3,Executive:4,Admin:5}[me()]||0) >= 2;

export async function renderProcessArch(c){
  const procs = await DB.getAll('processes');
  const domains = await DB.getAll('domains');
  const byParent={}; procs.forEach(p=>{ const k=p.parentId||'__root'; (byParent[k]=byParent[k]||[]).push(p); });
  const roots = byParent['__root']||[];

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Process & Operating Model</div><h1>Process Architecture</h1>
    <p>The enterprise process hierarchy, Level 0 (value chain) down to Level 5 (forms and transactions). Each process links to its owner, roles, systems, risks, controls and a diagram.</p></div>
    <div class="page-actions">${canEdit()?`<button class="btn primary" id="new">${ICON('plus')} New process</button>`:''}</div>
  </div>
  <div class="two-col">
    <div class="card pad"><b>Hierarchy</b><ul class="proc-tree" id="tree" style="margin-top:8px"></ul></div>
    <div id="detail"><div class="empty"><div class="ic">🗺️</div><p>Select a process to view its details and diagram.</p></div></div>
  </div>`;

  const node=(p)=>{ const kids=byParent[p.id]||[]; return `<li>
    <div class="proc-node" data-id="${p._id}"><span class="lvl ${p.level}">${p.level}</span><b style="flex:1;font-size:13px">${H.esc(p.name)}</b>${kids.length?`<span class="muted" style="font-size:11px">${kids.length}</span>`:''}</div>
    ${kids.length?`<ul>${kids.sort((a,b)=>a.level.localeCompare(b.level)).map(node).join('')}</ul>`:''}</li>`; };
  document.getElementById('tree').innerHTML = roots.map(node).join('') || '<div class="muted">No processes defined.</div>';
  c.querySelectorAll('.proc-node').forEach(el=> el.onclick=(e)=>{ e.stopPropagation(); openDetail(procs.find(x=>x._id===+el.dataset.id)); });
  if(document.getElementById('new')) document.getElementById('new').onclick=()=> editProcess(null, procs, domains, ()=>renderProcessArch(c));

  function openDetail(p){
    const det=document.getElementById('detail');
    const chips=(arr)=> (arr&&arr.length)? arr.map(x=>`<span class="tag">${H.esc(x)}</span>`).join('') : '<span class="muted" style="font-size:12px">—</span>';
    det.innerHTML=`
    <div class="card pad">
      <div class="flex between center wrap"><div><span class="lvl ${p.level}">${p.level}</span> <b style="font-size:16px">${H.esc(p.name)}</b></div>
        <div class="flex gap">${canEdit()?`<button class="btn ghost sm" id="p-edit">${ICON('edit',14)} Edit</button><button class="btn ghost sm" id="p-design">${ICON('flow',14)} Designer</button><button class="btn ghost sm" id="p-raci">${ICON('table',14)} RACI</button>`:''}</div></div>
      <p class="muted" style="margin:8px 0 0">${H.esc(p.purpose||'')}</p>
      <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
        <div><div class="muted" style="font-size:11px">Trigger</div>${H.esc(p.trigger||'—')}</div>
        <div><div class="muted" style="font-size:11px">Owner / Expert</div>${H.esc(p.owner||'—')}${p.expert?' · '+H.esc(p.expert):''}</div>
        <div><div class="muted" style="font-size:11px">Inputs</div>${chips(p.inputs)}</div>
        <div><div class="muted" style="font-size:11px">Outputs</div>${chips(p.outputs)}</div>
        <div><div class="muted" style="font-size:11px">Suppliers</div>${chips(p.suppliers)}</div>
        <div><div class="muted" style="font-size:11px">Customers</div>${chips(p.customers)}</div>
        <div><div class="muted" style="font-size:11px">KPIs</div>${chips(p.kpis)}</div>
        <div><div class="muted" style="font-size:11px">Systems</div>${chips(p.systems)}</div>
        <div><div class="muted" style="font-size:11px">Risks</div>${chips(p.risks)}</div>
        <div><div class="muted" style="font-size:11px">Controls</div>${chips(p.controls)}</div>
        <div><div class="muted" style="font-size:11px">Forms</div>${chips(p.forms)}</div>
        <div><div class="muted" style="font-size:11px">Review frequency</div>${H.esc(p.reviewFrequency||'—')}</div>
      </div>
      ${(p.improvements&&p.improvements.length)?`<div style="margin-top:10px"><div class="muted" style="font-size:11px">Improvement opportunities</div>${chips(p.improvements)}</div>`:''}
    </div>
    <div class="card pad" style="margin-top:14px"><div class="flex between center"><b>Process diagram</b>${canEdit()?`<button class="btn ghost sm" id="p-design2">${ICON('edit',14)} Open designer</button>`:''}</div>
      <div style="margin-top:10px">${renderCanvasSVG(p.canvas)}</div></div>`;
    const design=async()=> openCanvasEditor(p.canvas, async(cv)=>{ p.canvas=cv; await DB.put('processes',p); await logAudit('Updated process diagram', p.name, 'AAA Holding'); H.toast('Diagram saved'); openDetail(p); });
    if(document.getElementById('p-design')) document.getElementById('p-design').onclick=design;
    if(document.getElementById('p-design2')) document.getElementById('p-design2').onclick=design;
    if(document.getElementById('p-edit')) document.getElementById('p-edit').onclick=()=> editProcess(p, procs, domains, ()=>renderProcessArch(c));
    if(document.getElementById('p-raci')) document.getElementById('p-raci').onclick=()=> genRaci(p);
  }
}

async function genRaci(p){
  const a={CEO:'I','Executive Management': (p.level==='L0'||p.level==='L1')?'A':'I','Head of Department (HOD)':'A','Process Owner':'R','Process Expert':'C','Process Performer':'R','Risk & Compliance':(p.risks&&p.risks.length)?'C':'I','Stakeholder':'I'};
  const rows=await DB.getAll('raci'); const existing=rows.find(r=>r.docId===p.id);
  const row={process:p.name,docId:p.id,domain:p.domain,assignments:a};
  if(existing){ row._id=existing._id; await DB.put('raci',row); } else await DB.add('raci',row);
  await logAudit('Generated RACI from process', p.name, 'AAA Holding');
  H.toast('Role-based RACI generated — see RACI Matrix');
}

function editProcess(proc, procs, domains, refresh){
  const isNew=!proc;
  const p = proc || { level:'L2', name:'', parentId:'', purpose:'', trigger:'', domain:domains[0].code, owner:'', expert:'', reviewFrequency:'Annual',
    inputs:[],outputs:[],suppliers:[],customers:[],kpis:[],systems:[],risks:[],controls:[],forms:[],records:[],requirements:[],participants:[],improvements:[], canvas:{nodes:[],edges:[]} };
  const lines=(arr)=>(arr||[]).join('\n');
  H.modal({title:isNew?'New process':'Edit process', size:'lg', body:`
    <div class="field-row">
      <div class="field"><label>Name</label><input class="input" id="p-name" value="${H.esc(p.name)}"/></div>
      <div class="field"><label>Level</label><select class="input" id="p-level">${['L0','L1','L2','L3','L4','L5'].map(l=>`<option ${l===p.level?'selected':''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Parent process</label><select class="input" id="p-parent"><option value="">— none (root) —</option>${procs.filter(x=>x.id!==p.id).map(x=>`<option value="${x.id}" ${x.id===p.parentId?'selected':''}>${x.level} · ${H.esc(x.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Domain</label><select class="input" id="p-domain">${domains.map(d=>`<option value="${d.code}" ${d.code===p.domain?'selected':''}>${H.esc(d.name)}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Purpose</label><textarea class="input" id="p-purpose">${H.esc(p.purpose)}</textarea></div>
    <div class="field-row">
      <div class="field"><label>Trigger</label><input class="input" id="p-trigger" value="${H.esc(p.trigger)}"/></div>
      <div class="field"><label>Review frequency</label><input class="input" id="p-rev" value="${H.esc(p.reviewFrequency)}"/></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Owner</label><input class="input" id="p-owner" value="${H.esc(p.owner)}"/></div>
      <div class="field"><label>Process expert</label><input class="input" id="p-expert" value="${H.esc(p.expert)}"/></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Inputs (one per line)</label><textarea class="input" id="p-inputs">${H.esc(lines(p.inputs))}</textarea></div>
      <div class="field"><label>Outputs (one per line)</label><textarea class="input" id="p-outputs">${H.esc(lines(p.outputs))}</textarea></div>
    </div>
    <div class="field-row">
      <div class="field"><label>KPIs (one per line)</label><textarea class="input" id="p-kpis">${H.esc(lines(p.kpis))}</textarea></div>
      <div class="field"><label>Systems (one per line)</label><textarea class="input" id="p-systems">${H.esc(lines(p.systems))}</textarea></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Risks (one per line)</label><textarea class="input" id="p-risks">${H.esc(lines(p.risks))}</textarea></div>
      <div class="field"><label>Controls (one per line)</label><textarea class="input" id="p-controls">${H.esc(lines(p.controls))}</textarea></div>
    </div>`,
    footer:`<button class="btn" id="cx">Cancel</button>${isNew?'':'<button class="btn danger" id="del">Delete</button>'}<button class="btn primary" id="sv">Save</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  const arr=id=>document.getElementById(id).value.split('\n').map(s=>s.trim()).filter(Boolean);
  const v=id=>document.getElementById(id).value.trim();
  document.getElementById('sv').onclick=async()=>{
    const o={...p,name:v('p-name'),level:document.getElementById('p-level').value,parentId:document.getElementById('p-parent').value,
      domain:document.getElementById('p-domain').value,purpose:v('p-purpose'),trigger:v('p-trigger'),reviewFrequency:v('p-rev'),
      owner:v('p-owner'),expert:v('p-expert'),inputs:arr('p-inputs'),outputs:arr('p-outputs'),kpis:arr('p-kpis'),
      systems:arr('p-systems'),risks:arr('p-risks'),controls:arr('p-controls')};
    if(!o.name){ H.toast('Name required'); return; }
    if(isNew){ o.id='PRC-'+o.level+'-'+String(Math.floor(Math.random()*900)+100); o.canvas=o.canvas||{nodes:[],edges:[]}; await DB.add('processes',o); }
    else await DB.put('processes',o);
    await logAudit(isNew?'Created process':'Updated process', o.name, 'AAA Holding');
    H.toast('Process saved'); H.closeModal(); refresh();
  };
  const del=document.getElementById('del');
  if(del) del.onclick=()=> H.confirmDialog(`Delete process "${p.name}"?`, async()=>{ await DB.del('processes',p._id); H.toast('Deleted'); H.closeModal(); refresh(); });
}
