import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';

// What-if org planning. Scenarios are stored locally (planning layer) so they never
// touch the live position register until an admin chooses to apply them.
const LSS='govos-org-scenarios';
const getScen = ()=>{ try{return JSON.parse(localStorage.getItem(LSS))||[];}catch(e){return[];} };
const setScen = (s)=> localStorage.setItem(LSS, JSON.stringify(s));
const canEdit = ()=> ({Author:2,HOD:3,Executive:4,Admin:5}[(DB.getCurrentUser&&DB.getCurrentUser()?.role)]||0) >= 3;

let current=null; // active scenario working copy

export async function renderOrgScenario(c){
  const positions = await DB.getAll('positions').catch(()=>[]);
  const scenarios = getScen();
  if(!current) current = { name:'', changes:[] };

  const base = baseline(positions);
  const proj = project(base, current.changes);

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Organization & Accountability</div><h1>Scenario Planning</h1>
    <p>Model what-if changes to the position structure — add, remove or move seats — and see the headcount and cost impact before committing. Scenarios are drafts and do not change the live register.</p></div>
    <div class="page-actions"><button class="btn" id="load">Saved scenarios (${scenarios.length})</button>${canEdit()?`<button class="btn primary" id="save">Save scenario</button>`:''}</div>
  </div>

  <div class="kpis" style="margin-bottom:16px">
    <div class="stat"><div class="v">${base.count}</div><div class="l">Baseline seats</div></div>
    <div class="stat"><div class="v" style="color:${proj.count>=base.count?'var(--green)':'var(--red)'}">${proj.count}</div><div class="l">Projected seats (${delta(proj.count-base.count)})</div></div>
    <div class="stat"><div class="v">${fmtMoney(base.cost)}</div><div class="l">Baseline annual cost</div></div>
    <div class="stat"><div class="v" style="color:${proj.cost<=base.cost?'var(--green)':'var(--amber)'}">${fmtMoney(proj.cost)}</div><div class="l">Projected cost (${delta(proj.cost-base.cost, true)})</div></div>
  </div>

  <div class="two-col">
    <div class="card pad">
      <div class="flex between center"><b>Planned changes</b>${canEdit()?`<button class="btn sm" id="add">${ICON('plus',13)} Add change</button>`:''}</div>
      <div id="changes" style="margin-top:8px"></div>
    </div>
    <div class="card pad">
      <b>Projected structure by department</b>
      <div style="margin-top:8px">${Object.entries(proj.byDept).sort((a,b)=>b[1]-a[1]).map(([d,n])=>{ const b0=base.byDept[d]||0; const dd=n-b0;
        return `<div class="flex center gap" style="padding:4px 0"><span style="flex:1;font-size:12.5px">${H.esc(d)}</span><div class="bar" style="width:120px"><span style="width:${Math.round(n/Math.max(proj.count,1)*100)}%"></span></div><b style="width:30px;text-align:right">${n}</b><span style="width:44px;text-align:right;font-size:11px;color:${dd>0?'var(--green)':dd<0?'var(--red)':'var(--muted)'}">${dd?delta(dd):''}</span></div>`; }).join('')}</div>
    </div>
  </div>`;

  drawChanges();
  if(document.getElementById('add')) document.getElementById('add').onclick=()=> addChange(positions, base);
  if(document.getElementById('save')) document.getElementById('save').onclick=()=> saveScenario();
  document.getElementById('load').onclick=()=> loadScenario();

  function drawChanges(){
    const el=document.getElementById('changes'); if(!el) return;
    if(!current.changes.length){ el.innerHTML='<div class="empty" style="padding:16px"><p>No changes yet. Add one to model a re-organisation.</p></div>'; return; }
    el.innerHTML = current.changes.map((ch,i)=>`<div class="flex between center" style="padding:7px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:12.5px">${ICON(ch.type==='add'?'plus':ch.type==='remove'?'x':'flow',12)} <b>${label(ch)}</b></div>
      ${canEdit()?`<span class="link" data-del="${i}">remove</span>`:''}</div>`).join('');
    el.querySelectorAll('[data-del]').forEach(x=> x.onclick=()=>{ current.changes.splice(+x.dataset.del,1); renderOrgScenario(c); });
  }
  function label(ch){
    if(ch.type==='add') return `Add ${ch.count} × ${ch.title} in ${ch.dept} (${fmtMoney(ch.cost)} ea)`;
    if(ch.type==='remove') return `Remove ${ch.count} seat(s) from ${ch.dept}`;
    return `Move ${ch.count} seat(s): ${ch.dept} → ${ch.toDept}`;
  }
}

function baseline(positions){
  const byDept={}; let cost=0;
  positions.forEach(p=>{ const d=p.department||p.unit||'Unassigned'; byDept[d]=(byDept[d]||0)+1; cost+= seatCost(p); });
  return { count:positions.length, byDept, cost };
}
function project(base, changes){
  const byDept={...base.byDept}; let count=base.count, cost=base.cost;
  for(const ch of changes){
    if(ch.type==='add'){ byDept[ch.dept]=(byDept[ch.dept]||0)+ch.count; count+=ch.count; cost+= ch.count*(ch.cost||120000); }
    else if(ch.type==='remove'){ const take=Math.min(ch.count, byDept[ch.dept]||0); byDept[ch.dept]=(byDept[ch.dept]||0)-take; count-=take; cost-= take*avgCost(base); }
    else if(ch.type==='move'){ const take=Math.min(ch.count, byDept[ch.dept]||0); byDept[ch.dept]=(byDept[ch.dept]||0)-take; byDept[ch.toDept]=(byDept[ch.toDept]||0)+take; }
  }
  Object.keys(byDept).forEach(d=>{ if(byDept[d]<=0) delete byDept[d]; });
  return { count, byDept, cost:Math.max(cost,0) };
}
function seatCost(p){ return p.annualCost || p.cost || GRADE_COST[p.grade] || 120000; }
function avgCost(base){ return base.count? Math.round(base.cost/base.count) : 120000; }
const GRADE_COST={E:600000,L1:420000,L2:300000,M:220000,S:150000,P:110000,G:80000};
function fmtMoney(n){ return 'SAR '+(n>=1e6? (n/1e6).toFixed(2)+'M' : Math.round(n/1000)+'k'); }
function delta(n, money){ const s=n>0?'+':''; return money? s+fmtMoney(Math.abs(n)).replace('SAR ','') : s+n; }

function addChange(positions, base){
  const depts=[...new Set(positions.map(p=>p.department||p.unit).filter(Boolean))].sort();
  const dOpt=depts.map(d=>`<option>${H.esc(d)}</option>`).join('');
  H.modal({title:'Add planned change', size:'md',
    body:`<div class="field"><label>Change type</label><select class="input" id="ty"><option value="add">Add position(s)</option><option value="remove">Remove position(s)</option><option value="move">Move position(s)</option></select></div>
      <div class="two-col">
        <div class="field"><label>Department</label><select class="input" id="dept">${dOpt}</select></div>
        <div class="field"><label>Count</label><input class="input" type="number" id="cnt" value="1" min="1"/></div>
      </div>
      <div id="extra"></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Add change</button>`});
  const extra=document.getElementById('extra');
  const drawExtra=()=>{ const t=document.getElementById('ty').value;
    extra.innerHTML = t==='add' ? `<div class="two-col"><div class="field"><label>Job title</label><input class="input" id="title" value="New position"/></div><div class="field"><label>Annual cost each (SAR)</label><input class="input" type="number" id="cost" value="120000"/></div></div>`
      : t==='move' ? `<div class="field"><label>Move to department</label><select class="input" id="todept">${dOpt}</select></div>` : '';
  };
  drawExtra(); document.getElementById('ty').onchange=drawExtra;
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=()=>{
    const t=document.getElementById('ty').value; const ch={ type:t, dept:document.getElementById('dept').value, count:+document.getElementById('cnt').value||1 };
    if(t==='add'){ ch.title=document.getElementById('title').value.trim()||'New position'; ch.cost=+document.getElementById('cost').value||120000; }
    if(t==='move'){ ch.toDept=document.getElementById('todept').value; }
    current.changes.push(ch); H.closeModal(); location.hash='#/org-scenario'; document.querySelector('#app-main')&&window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
}

function saveScenario(){
  H.modal({title:'Save scenario', size:'sm',
    body:`<div class="field"><label>Scenario name</label><input class="input" id="nm" value="${H.esc(current.name||'')}" placeholder="e.g. 2027 Sales expansion"/></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=()=>{
    const nm=document.getElementById('nm').value.trim(); if(!nm){ H.toast('Name required'); return; }
    const all=getScen().filter(s=>s.name!==nm); all.push({name:nm, changes:current.changes, savedAt:new Date().toISOString()}); setScen(all);
    current.name=nm; H.toast('Scenario saved'); H.closeModal();
  };
}
function loadScenario(){
  const all=getScen();
  H.modal({title:'Saved scenarios', size:'md',
    body: all.length? `<div>${all.map((s,i)=>`<div class="flex between center" style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div><b>${H.esc(s.name)}</b><div class="muted" style="font-size:11px">${s.changes.length} change(s) · ${H.fmtDate(s.savedAt)}</div></div>
      <div class="flex gap"><button class="btn sm" data-open="${i}">Open</button><span class="link" data-del="${i}">delete</span></div></div>`).join('')}</div>`
     : '<div class="empty"><p>No saved scenarios.</p></div>',
    footer:`<button class="btn" id="cx">Close</button><button class="btn" id="new">New blank scenario</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('new').onclick=()=>{ current={name:'',changes:[]}; H.closeModal(); location.hash='#/org-scenario'; window.dispatchEvent(new HashChangeEvent('hashchange')); };
  document.querySelectorAll('.modal [data-open]').forEach(el=> el.onclick=()=>{ current=JSON.parse(JSON.stringify(all[+el.dataset.open])); H.closeModal(); location.hash='#/org-scenario'; window.dispatchEvent(new HashChangeEvent('hashchange')); });
  document.querySelectorAll('.modal [data-del]').forEach(el=> el.onclick=()=>{ const a=getScen(); a.splice(+el.dataset.del,1); setScen(a); loadScenario(); });
}
