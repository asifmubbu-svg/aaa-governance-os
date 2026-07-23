import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';

export async function renderAdmin(c){
  const user = DB.getCurrentUser() || {};
  const isAdmin = user.role === 'Admin';
  const config = await DB.getConfig();
  const ref = await DB.getMeta();
  let tab = 'types';

  c.innerHTML = `
  <div class="page-head"><div><div class="eyebrow">Administration</div><h1>Configuration</h1>
    <p>Document types, workflows and reference data are configuration, not code — so new types, sections and fields can be added without rebuilding the portal.${isAdmin?'':' <b>Read-only</b> — sign in as an Admin to make changes.'}</p></div></div>
  <div class="toolbar">
    <button class="chip active" data-t="types">Document types</button>
    <button class="chip" data-t="workflows">Statuses & workflows</button>
    <button class="chip" data-t="ref">Reference data</button>
  </div>
  <div id="admin-body"></div>`;
  const body = document.getElementById('admin-body');
  c.querySelectorAll('[data-t]').forEach(b=> b.onclick=()=>{ tab=b.dataset.t; c.querySelectorAll('[data-t]').forEach(x=>x.classList.toggle('active',x===b)); draw(); });

  function draw(){
    if(tab==='types') drawTypes();
    else if(tab==='workflows') drawWorkflows();
    else drawRef();
  }
  function drawTypes(){
    body.innerHTML = `
    <div class="flex between center" style="margin-bottom:10px"><span class="muted">${config.documentTypes.length} document types</span>
      ${isAdmin?`<button class="btn primary sm" id="add-type">${ICON('plus',14)} New document type</button>`:''}</div>
    <div class="table-wrap"><table><thead><tr><th>Type</th><th>Prefix</th><th>Review (months)</th><th>Sections</th><th>Retention (yrs)</th><th>Workflow</th>${isAdmin?'<th></th>':''}</tr></thead><tbody>
      ${config.documentTypes.map((t,i)=>`<tr><td><b>${H.esc(t.key)}</b></td><td class="mono">${H.esc(t.prefix)}</td><td>${t.reviewMonths}</td>
        <td>${(t.sections||[]).length}</td><td>${t.retentionYears||'—'}</td><td>${H.esc(t.workflow||'default')}</td>
        ${isAdmin?`<td><button class="btn ghost sm" data-edit="${i}">${ICON('edit',14)}</button></td>`:''}</tr>`).join('')}
    </tbody></table></div>`;
    if(isAdmin){
      document.getElementById('add-type').onclick=()=> editType(null);
      body.querySelectorAll('[data-edit]').forEach(b=> b.onclick=()=> editType(+b.dataset.edit));
    }
  }
  function editType(idx){
    const t = idx==null ? { key:'', prefix:'', reviewMonths:12, retentionYears:7, workflow:'default', sections:[], customFields:[] } : config.documentTypes[idx];
    H.modal({ title: idx==null?'New document type':'Edit document type', size:'lg',
      body:`<div class="field-row">
        <div class="field"><label>Type name</label><input class="input" id="t-key" value="${H.esc(t.key)}"/></div>
        <div class="field"><label>Code prefix</label><input class="input" id="t-prefix" value="${H.esc(t.prefix)}"/></div></div>
      <div class="field-row">
        <div class="field"><label>Default review period (months)</label><input class="input" type="number" id="t-review" value="${t.reviewMonths}"/></div>
        <div class="field"><label>Retention (years)</label><input class="input" type="number" id="t-ret" value="${t.retentionYears||7}"/></div></div>
      <div class="field"><label>Default workflow</label><select class="input" id="t-wf">${(config.workflows||[{key:'default',name:'Standard'}]).map(w=>`<option value="${w.key}" ${w.key===t.workflow?'selected':''}>${H.esc(w.name||w.key)}</option>`).join('')}</select></div>
      <div class="field"><label>Standard sections (one per line)</label><textarea class="input" id="t-sec" style="min-height:120px">${H.esc((t.sections||[]).join('\n'))}</textarea></div>
      <div class="field"><label>Custom fields (one per line, format: label | type)</label><textarea class="input" id="t-cf" style="min-height:80px" placeholder="Owner department | text&#10;Effective region | text">${H.esc((t.customFields||[]).map(f=>`${f.label} | ${f.type||'text'}`).join('\n'))}</textarea></div>`,
      footer:`<button class="btn" id="cx">Cancel</button>${idx!=null?'<button class="btn danger" id="del">Delete</button>':''}<button class="btn primary" id="sv">Save type</button>`});
    document.getElementById('cx').onclick=H.closeModal;
    document.getElementById('sv').onclick=async()=>{
      const obj={ key:document.getElementById('t-key').value.trim(), prefix:document.getElementById('t-prefix').value.trim().toUpperCase(),
        reviewMonths:+document.getElementById('t-review').value||12, retentionYears:+document.getElementById('t-ret').value||7,
        workflow:document.getElementById('t-wf').value,
        sections:document.getElementById('t-sec').value.split('\n').map(s=>s.trim()).filter(Boolean),
        customFields:document.getElementById('t-cf').value.split('\n').map(s=>s.trim()).filter(Boolean).map(l=>{const[label,type]=l.split('|').map(x=>x.trim());return{label,type:type||'text'};}),
        demo:false };
      if(!obj.key||!obj.prefix){ H.toast('Type name and prefix are required'); return; }
      if(idx==null) config.documentTypes.push(obj); else config.documentTypes[idx]=obj;
      try{ await DB.saveConfig(config); H.toast('Configuration saved'); H.closeModal(); draw(); }
      catch(e){ /* toast handled by db layer for 403 */ }
    };
    const del=document.getElementById('del');
    if(del) del.onclick=async()=>{ config.documentTypes.splice(idx,1); try{ await DB.saveConfig(config); H.toast('Type removed'); H.closeModal(); draw(); }catch(e){} };
  }
  function drawWorkflows(){
    body.innerHTML = `
    <div class="card pad"><b>Statuses</b><div style="margin-top:8px">${(config.statuses||[]).map(s=>`<span class="tag">${H.esc(s)}</span>`).join('')}</div></div>
    <div class="section-title">Workflow templates</div>
    ${(config.workflows||[]).map(w=>`<div class="card pad" style="margin-bottom:10px"><b>${H.esc(w.name||w.key)}</b>
      <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">${(w.stages||[]).map((s,i)=>`<span class="badge b-blue">${H.esc(s.name||s.role)}</span>${i<w.stages.length-1?'<span class="muted">→</span>':''}`).join('')}</div></div>`).join('')}
    <div class="card pad"><b>Process node types</b><div style="margin-top:8px">${(config.processNodeTypes||[]).map(n=>`<span class="tag">${H.esc(n)}</span>`).join('')}</div></div>`;
  }
  function drawRef(){
    const chips=(arr)=> (arr||[]).map(x=>`<span class="tag">${H.esc(typeof x==='string'?x:(x.name||x.code||''))}</span>`).join('') || '<span class="muted">—</span>';
    body.innerHTML = `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
      <div class="card pad"><b>Departments (${(ref.departments||[]).length})</b><div style="margin-top:8px">${chips(ref.departments)}</div></div>
      <div class="card pad"><b>Units (${(ref.units||[]).length})</b><div style="margin-top:8px">${chips(ref.units)}</div></div>
      <div class="card pad"><b>Job grades (${(ref.grades||[]).length})</b><div style="margin-top:8px">${(ref.grades||[]).map(g=>`<span class="tag">${g.code} · ${H.esc(g.name)}</span>`).join('')}</div></div>
      <div class="card pad"><b>Systems (${(ref.systems||[]).length})</b><div style="margin-top:8px">${chips(ref.systems)}</div></div>
      <div class="card pad"><b>Statuses</b><div style="margin-top:8px">${chips(ref.statuses)}</div></div>
      <div class="card pad"><b>RACI roles</b><div style="margin-top:8px">${chips(ref.raciRoles)}</div></div>
    </div>
    <p class="muted" style="font-size:12px;margin-top:12px">Reference lists are seeded from your real organization data. Full editing of entities, departments, grades and locations is planned for a later configuration sprint.</p>`;
  }
  draw();
}
