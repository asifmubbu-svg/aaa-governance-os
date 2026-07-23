import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

const canEdit = ()=> ({Author:2,HOD:3,Executive:4,Admin:5}[(DB.getCurrentUser&&DB.getCurrentUser()?.role)]||0) >= 3;
const statusBadge = (p)=> p.status==='Vacant' ? '<span class="badge b-red">Vacant</span>' : p.status==='Acting' ? '<span class="badge b-amber">Acting</span>' : '<span class="badge b-green">Filled</span>';
let tab='chart';

export async function renderPositions(c){
  const positions = await DB.getAll('positions');
  const emps = await DB.getAll('employees');
  const meta = await DB.getMeta();
  const byParent={}; positions.forEach(p=>{ const k=p.reportsTo||'__root'; (byParent[k]=byParent[k]||[]).push(p); });

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Organization & Accountability</div><h1>Positions</h1>
    <p>Budgeted seats in the organization — separate from the people who fill them. ${positions.length} positions: ${positions.filter(p=>p.status==='Filled').length} filled, ${positions.filter(p=>p.status==='Vacant').length} vacant, ${positions.filter(p=>p.status==='Acting').length} acting.</p></div>
    <div class="page-actions">${canEdit()?`<button class="btn primary" id="new">${ICON('plus')} New position</button>`:''}</div>
  </div>
  <div class="toolbar">
    <button class="chip ${tab==='chart'?'active':''}" data-t="chart">Position chart</button>
    <button class="chip ${tab==='register'?'active':''}" data-t="register">Register</button>
    <button class="chip ${tab==='analytics'?'active':''}" data-t="analytics">Workforce analytics</button>
  </div>
  <div id="pos-body"></div>`;
  c.querySelectorAll('[data-t]').forEach(b=> b.onclick=()=>{ tab=b.dataset.t; renderPositions(c); });
  if(document.getElementById('new')) document.getElementById('new').onclick=()=> editPos(null, positions, meta, emps, ()=>renderPositions(c));
  const body=document.getElementById('pos-body');
  if(tab==='chart') drawChart(body, positions, byParent, emps, meta);
  else if(tab==='register') drawRegister(body, positions, meta, emps, ()=>renderPositions(c));
  else drawAnalytics(body, positions, byParent);
}

function drawChart(body, positions, byParent, emps, meta){
  const roots = byParent['__root']||[];
  const node=(p)=>{ const kids=byParent[p.id]||[]; const inc = p.status==='Vacant' ? '<span class="badge b-red">Vacant</span>' : p.status==='Acting' ? `<span class="badge b-amber">Acting: ${H.esc(p.acting||'')}</span>` : (p.incumbents||[]).map(H.esc).join(', ');
    return `<li>
      <div class="proc-node pos-card" data-id="${p._id}">
        <span class="lvl">${p.grade}</span>
        <div style="flex:1"><b style="font-size:13px">${H.esc(p.title)}</b>${p.critical?' <span class="badge b-red" style="font-size:9px">critical</span>':''}<div class="muted" style="font-size:11.5px">${inc||'—'} · ${H.esc(p.department)}</div></div>
        ${kids.length?`<span class="muted" style="font-size:11px" title="Direct reports">▾ ${kids.length}</span>`:''}
      </div>
      ${kids.length?`<ul>${kids.map(node).join('')}</ul>`:''}</li>`; };
  body.innerHTML=`<div class="card pad"><p class="muted mt0">Reporting structure by position. Click a position to view or edit it.</p>
    <ul class="proc-tree">${roots.map(node).join('')}</ul></div>`;
  body.querySelectorAll('.pos-card').forEach(el=> el.onclick=(e)=>{ e.stopPropagation(); openPos(positions.find(x=>x._id===+el.dataset.id), positions, byParent, meta, emps, ()=>renderPositions(document.getElementById('view'))); });
}

function openPos(p, positions, byParent, meta, emps, refresh){
  const reportsToPos = positions.find(x=>x.id===p.reportsTo);
  const kids = byParent[p.id]||[];
  H.modal({title:`${p.id} — ${p.title}`, size:'lg',
    body:`<div class="flex gap wrap" style="margin-bottom:10px">${statusBadge(p)}<span class="badge b-slate">Grade ${p.grade}</span>${p.critical?'<span class="badge b-red">Critical role</span>':''}</div>
    <div class="jd-grid">
      <div class="card pad doc-meta" style="box-shadow:none">
        <b>Position</b>
        <div class="row"><span class="k">Department</span><span>${H.esc(p.department)}</span></div>
        <div class="row"><span class="k">Unit / Location</span><span>${H.esc(p.unit)} · ${H.esc(p.location)}</span></div>
        <div class="row"><span class="k">Reports to</span><span>${reportsToPos?H.esc(reportsToPos.title):'—'}</span></div>
        <div class="row"><span class="k">Direct reports</span><span>${kids.length}</span></div>
        <div class="row"><span class="k">Succession</span><span>${H.esc(p.successionReady||'—')}</span></div>
      </div>
      <div class="card pad doc-meta" style="box-shadow:none">
        <b>Incumbency</b>
        <div class="row"><span class="k">Status</span><span>${statusBadge(p)}</span></div>
        <div class="row"><span class="k">Incumbent(s)</span><span>${(p.incumbents||[]).map(H.esc).join(', ')||'—'}</span></div>
        ${p.acting?`<div class="row"><span class="k">Acting</span><span>${H.esc(p.acting)}</span></div>`:''}
      </div>
    </div>
    ${kids.length?`<div class="card pad" style="box-shadow:none;margin-top:12px"><b>Reports</b><div style="margin-top:6px">${kids.map(k=>`<span class="tag">${H.esc(k.title)}${k.status==='Vacant'?' (vacant)':''}</span>`).join('')}</div></div>`:''}`,
    footer:`<button class="btn" id="cx">Close</button>${canEdit()?'<button class="btn danger" id="dl">Delete</button><button class="btn primary" id="ed">Edit</button>':''}`});
  document.getElementById('cx').onclick=H.closeModal;
  if(document.getElementById('ed')) document.getElementById('ed').onclick=()=> editPos(p, positions, meta, emps, refresh);
  if(document.getElementById('dl')) document.getElementById('dl').onclick=()=> H.confirmDialog(`Delete position ${p.id}?`, async()=>{ await DB.del('positions',p._id); await logAudit('Deleted position', p.title,'AAA Holding'); H.toast('Deleted'); H.closeModal(); refresh(); });
}

function drawRegister(body, positions, meta, emps, refresh){
  body.innerHTML=`<div class="table-wrap"><table><thead><tr>
    <th>ID</th><th>Title</th><th>Department</th><th>Grade</th><th>Incumbent</th><th>Status</th><th>Reports to</th><th>Critical</th></tr></thead><tbody>
    ${positions.map(p=>{ const rt=positions.find(x=>x.id===p.reportsTo); const inc=p.status==='Vacant'?'—':(p.status==='Acting'?p.acting:(p.incumbents||[]).join(', '));
      return `<tr class="clickable" data-id="${p._id}"><td class="mono">${p.id}</td><td><b>${H.esc(p.title)}</b></td><td>${H.esc(p.department)}</td>
      <td>${p.grade}</td><td>${H.esc(inc||'—')}</td><td>${statusBadge(p)}</td><td>${rt?H.esc(rt.title):'—'}</td><td>${p.critical?'<span class="badge b-red">Yes</span>':'—'}</td></tr>`;}).join('')}
  </tbody></table></div>`;
  const byParent={}; positions.forEach(p=>{ const k=p.reportsTo||'__root'; (byParent[k]=byParent[k]||[]).push(p); });
  body.querySelectorAll('tr[data-id]').forEach(tr=> tr.onclick=()=> openPos(positions.find(x=>x._id===+tr.dataset.id), positions, byParent, meta, emps, refresh));
}

function drawAnalytics(body, positions, byParent){
  const managers = positions.filter(p=>(byParent[p.id]||[]).length>0).map(p=>({p, span:(byParent[p.id]||[]).length})).sort((a,b)=>b.span-a.span);
  const avgSpan = managers.length ? (managers.reduce((a,m)=>a+m.span,0)/managers.length).toFixed(1) : '0';
  // layers: depth from roots
  const depthOf=(p)=>{ let d=1,cur=p; while(cur.reportsTo){ const par=positions.find(x=>x.id===cur.reportsTo); if(!par)break; d++; cur=par; } return d; };
  const maxLayers=Math.max(...positions.map(depthOf),1);
  // headcount by grade
  const grades=['E','L1','L2','M','S','P','G'];
  const byGrade=grades.map(g=>{ const ps=positions.filter(p=>p.grade===g); return {g, budgeted:ps.length, filled:ps.filter(p=>p.status!=='Vacant').length, vacant:ps.filter(p=>p.status==='Vacant').length}; }).filter(x=>x.budgeted);
  const critical=positions.filter(p=>p.critical);
  const critVacant=critical.filter(p=>p.status==='Vacant');
  const critNoSucc=critical.filter(p=>p.successionReady==='None' && p.status!=='Vacant');

  body.innerHTML=`
  <div class="kpis" style="margin-bottom:16px">
    <div class="stat"><div class="v">${maxLayers}</div><div class="l">Org layers (CEO→deepest)</div></div>
    <div class="stat"><div class="v">${avgSpan}</div><div class="l">Avg span of control</div></div>
    <div class="stat"><div class="v" style="color:var(--red)">${critVacant.length}</div><div class="l">Critical roles vacant</div></div>
    <div class="stat"><div class="v" style="color:var(--amber)">${critNoSucc.length}</div><div class="l">Critical, no successor</div></div>
  </div>
  <div class="two-col">
    <div class="card pad"><b>Span of control</b>
      <div style="margin-top:8px">${managers.slice(0,8).map(m=>`<div class="flex center gap" style="padding:6px 0;border-bottom:1px solid var(--border)"><span style="flex:1">${H.esc(m.p.title)}</span><div class="bar" style="width:120px"><span style="width:${Math.min(100,m.span/Math.max(...managers.map(x=>x.span))*100)}%"></span></div><b style="width:24px;text-align:right">${m.span}</b></div>`).join('')}</div>
    </div>
    <div class="card pad"><b>Headcount by grade (budgeted / filled / vacant)</b>
      <div class="table-wrap" style="margin-top:8px;border:none"><table><thead><tr><th>Grade</th><th>Budgeted</th><th>Filled</th><th>Vacant</th></tr></thead><tbody>
        ${byGrade.map(x=>`<tr><td><b>${x.g}</b></td><td>${x.budgeted}</td><td>${x.filled}</td><td>${x.vacant?`<span class="badge b-amber">${x.vacant}</span>`:'0'}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
  </div>
  <div class="card pad" style="margin-top:16px"><b>Critical roles &amp; succession</b>
    <div class="table-wrap" style="margin-top:8px;border:none"><table><thead><tr><th>Position</th><th>Incumbent</th><th>Status</th><th>Succession readiness</th></tr></thead><tbody>
      ${critical.map(p=>`<tr><td><b>${H.esc(p.title)}</b></td><td>${p.status==='Vacant'?'—':H.esc((p.incumbents||[]).join(', ')||p.acting)}</td><td>${statusBadge(p)}</td>
        <td>${p.successionReady==='Ready'?'<span class="badge b-green">Ready</span>':p.successionReady==='1-2 yrs'?'<span class="badge b-amber">1-2 yrs</span>':'<span class="badge b-red">No successor</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="muted" style="font-size:11.5px;margin-top:8px">Scenario planning (drag-and-drop what-if org design) is planned for a later iteration; this analysis supports it with current-state span, layers and succession data.</p>
  </div>`;
}

function editPos(pos, positions, meta, emps, refresh){
  const isNew=!pos;
  const p = pos || { title:'', department:(meta.departments||[])[0]||'', unit:(meta.units||[])[0]||'', location:'', grade:'M', reportsTo:'', incumbents:[], acting:'', status:'Vacant', critical:false, successionReady:'None', budgeted:true };
  const v=id=>document.getElementById(id).value.trim();
  H.modal({title:isNew?'New position':'Edit position', size:'lg', body:`
    <div class="field-row"><div class="field"><label>Position title</label><input class="input" id="q-title" value="${H.esc(p.title)}"/></div>
      <div class="field"><label>Grade</label><select class="input" id="q-grade">${['E','L1','L2','M','S','P','G'].map(x=>`<option ${x===p.grade?'selected':''}>${x}</option>`).join('')}</select></div></div>
    <div class="field-row"><div class="field"><label>Department</label><input class="input" id="q-dept" list="depts2" value="${H.esc(p.department)}"/><datalist id="depts2">${(meta.departments||[]).map(d=>`<option>${H.esc(d)}</option>`).join('')}</datalist></div>
      <div class="field"><label>Unit</label><select class="input" id="q-unit">${(meta.units||[]).map(u=>`<option ${u===p.unit?'selected':''}>${H.esc(u)}</option>`).join('')}</select></div></div>
    <div class="field"><label>Location</label><input class="input" id="q-loc" value="${H.esc(p.location)}"/></div>
    <div class="field"><label>Reports to (position)</label><select class="input" id="q-reports"><option value="">— none (top) —</option>${positions.filter(x=>x.id!==p.id).map(x=>`<option value="${x.id}" ${x.id===p.reportsTo?'selected':''}>${x.grade} · ${H.esc(x.title)}</option>`).join('')}</select></div>
    <div class="field-row"><div class="field"><label>Status</label><select class="input" id="q-status">${['Filled','Vacant','Acting'].map(s=>`<option ${s===p.status?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Succession readiness</label><select class="input" id="q-succ">${['Ready','1-2 yrs','None'].map(s=>`<option ${s===p.successionReady?'selected':''}>${s}</option>`).join('')}</select></div></div>
    <div class="field"><label>Incumbent(s) — comma separated</label><input class="input" id="q-inc" value="${H.esc((p.incumbents||[]).join(', '))}"/></div>
    <div class="field"><label>Acting (if applicable)</label><input class="input" id="q-acting" value="${H.esc(p.acting||'')}"/></div>
    <div class="field"><label><input type="checkbox" id="q-crit" ${p.critical?'checked':''}/> Critical role</label></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    const o={...p,title:v('q-title'),grade:document.getElementById('q-grade').value,department:v('q-dept'),unit:document.getElementById('q-unit').value,
      location:v('q-loc'),reportsTo:document.getElementById('q-reports').value,status:document.getElementById('q-status').value,
      successionReady:document.getElementById('q-succ').value,incumbents:v('q-inc').split(',').map(s=>s.trim()).filter(Boolean),
      acting:v('q-acting'),critical:document.getElementById('q-crit').checked};
    if(!o.title){ H.toast('Title required'); return; }
    if(isNew){ o.id='POS-'+String(Math.floor(Math.random()*900)+100); await DB.add('positions',o); } else await DB.put('positions',o);
    await logAudit(isNew?'Created position':'Updated position', o.title,'AAA Holding');
    H.toast('Position saved'); H.closeModal(); refresh();
  };
}
