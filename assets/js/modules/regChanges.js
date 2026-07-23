import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

const canEdit = ()=> ({Author:2,HOD:3,Executive:4,Admin:5}[(DB.getCurrentUser&&DB.getCurrentUser()?.role)]||0) >= 2;
const me = ()=> (DB.getCurrentUser&&DB.getCurrentUser()?.name) || '';
const sBadge = (s)=>{ const m={Assessing:'b-amber','In Progress':'b-blue',Done:'b-green','On Hold':'b-slate'}; return `<span class="badge ${m[s]||'b-slate'}">${H.esc(s)}</span>`; };
const iBadge = (i)=>{ const m={High:'b-red',Medium:'b-amber',Low:'b-green'}; return `<span class="badge ${m[i]||'b-slate'}">${H.esc(i)} impact</span>`; };
let filter='';

export async function renderRegChanges(c){
  const [items, reqs, docs, emps] = await Promise.all([
    DB.getAll('regChanges').catch(()=>[]), DB.getAll('requirements').catch(()=>[]), DB.getAll('documents'), DB.getAll('employees')
  ]);
  const open=items.filter(r=>r.status!=='Done').length;
  const high=items.filter(r=>r.impact==='High').length;
  const done=items.filter(r=>r.status==='Done').length;

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Compliance & Assurance</div><h1>Regulatory Change</h1>
    <p>Track new and changing laws, regulations and standards, assess impact, and map each to the requirements and policies it affects.</p></div>
    <div class="page-actions">${canEdit()?`<button class="btn primary" id="new">${ICON('plus')} Log change</button>`:''}</div>
  </div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="stat"><div class="v">${items.length}</div><div class="l">Tracked changes</div></div>
    <div class="stat"><div class="v" style="color:var(--amber)">${open}</div><div class="l">Open</div></div>
    <div class="stat"><div class="v" style="color:var(--red)">${high}</div><div class="l">High impact</div></div>
    <div class="stat"><div class="v" style="color:var(--green)">${done}</div><div class="l">Addressed</div></div>
  </div>
  <div class="toolbar">${['','Assessing','In Progress','Done'].map(s=>`<button class="chip ${s===filter?'active':''}" data-s="${s}">${s||'All'}</button>`).join('')}</div>
  <div id="rows"></div>`;
  if(document.getElementById('new')) document.getElementById('new').onclick=()=> editChange(null, reqs, emps);
  c.querySelectorAll('[data-s]').forEach(b=> b.onclick=()=>{ filter=b.dataset.s; renderRegChanges(c); });

  const list=items.filter(r=>!filter||r.status===filter).sort((a,b)=> new Date(a.effectiveDate)-new Date(b.effectiveDate));
  document.getElementById('rows').innerHTML = list.length? list.map(r=>`
    <div class="card pad clickable" data-id="${r._id}" style="cursor:pointer;margin-bottom:10px">
      <div class="flex between center wrap gap">
        <div><b style="font-size:14px">${H.esc(r.title)}</b>
          <div class="muted" style="font-size:12px;margin-top:2px">${H.esc(r.authority)} · ${H.esc(r.type)} · effective ${H.fmtDate(r.effectiveDate)}</div></div>
        <div class="flex center gap">${iBadge(r.impact)}${sBadge(r.status)}</div>
      </div>
      <p class="mb0 muted" style="font-size:12.5px;margin-top:8px">${H.esc(r.summary||'')}</p>
      <div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap">
        ${(r.linkedRequirements||[]).map(x=>`<span class="tag">${ICON('book',11)} ${H.esc(x)}</span>`).join('')}
        ${(r.linkedDocs||[]).map(x=>`<span class="tag">${ICON('file',11)} ${H.esc(x)}</span>`).join('')}
        <span class="tag">Owner: ${H.esc(r.owner||'—')}</span>
      </div>
    </div>`).join('') : `<div class="empty"><p>No regulatory changes${filter?' ('+filter+')':''}.</p></div>`;
  document.querySelectorAll('#rows [data-id]').forEach(el=> el.onclick=()=>{ const r=items.find(x=>x._id===+el.dataset.id); openChange(r, reqs, docs, emps); });
}

function openChange(r, reqs, docs, emps){
  const linkedReqs=(r.linkedRequirements||[]).map(id=> reqs.find(x=>x.id===id)).filter(Boolean);
  H.modal({title:`${r.id} — ${r.title}`, size:'lg',
    body:`<div class="doc-meta">
      <div class="row"><span class="k">Authority</span><span>${H.esc(r.authority)}</span></div>
      <div class="row"><span class="k">Type</span><span>${H.esc(r.type)}</span></div>
      <div class="row"><span class="k">Published</span><span>${H.fmtDate(r.publishedDate)}</span></div>
      <div class="row"><span class="k">Effective</span><span>${H.fmtDate(r.effectiveDate)}</span></div>
      <div class="row"><span class="k">Impact</span><span>${iBadge(r.impact)}</span></div>
      <div class="row"><span class="k">Status</span><span>${sBadge(r.status)}</span></div>
      <div class="row"><span class="k">Owner</span><span>${H.esc(r.owner||'—')}</span></div>
    </div>
    <h4 style="margin:12px 0 4px">Summary</h4><p class="mb0">${H.esc(r.summary||'—')}</p>
    <h4 style="margin:12px 0 4px">Required action</h4><p class="mb0">${H.esc(r.action||'—')}</p>
    <h4 style="margin:12px 0 4px">Mapped requirements</h4>
    ${linkedReqs.length? `<div>${linkedReqs.map(q=>`<div class="flex between center" style="padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:12.5px">${H.esc(q.id)} — ${H.esc(q.title)}</span><span class="link" data-req="${H.esc(q.id)}">open</span></div>`).join('')}</div>`
     : '<p class="muted mb0">No requirements mapped yet.</p>'}`,
    footer:`<button class="btn" id="cx">Close</button>${canEdit()?`<button class="btn primary" id="edit">Edit / update status</button>`:''}`});
  document.getElementById('cx').onclick=H.closeModal;
  document.querySelectorAll('.modal [data-req]').forEach(el=> el.onclick=()=>{ H.closeModal(); location.hash='#/requirements'; });
  if(document.getElementById('edit')) document.getElementById('edit').onclick=()=> editChange(r, reqs, emps);
}

function editChange(existing, reqs, emps){
  const r=existing||{impact:'Medium',status:'Assessing',type:'Regulation'};
  const reqOpts= reqs.map(q=>`<label style="display:block;font-size:12.5px;padding:2px 0"><input type="checkbox" value="${H.esc(q.id)}" ${(r.linkedRequirements||[]).includes(q.id)?'checked':''}/> ${H.esc(q.id)} — ${H.esc(q.title)}</label>`).join('');
  const empOpts= emps.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(e=>`<option ${r.owner===e.name?'selected':''}>${H.esc(e.name)}</option>`).join('');
  H.modal({title: existing?'Update regulatory change':'Log regulatory change', size:'lg',
    body:`<div class="field"><label>Title</label><input class="input" id="t" value="${H.esc(r.title||'')}"/></div>
      <div class="two-col">
        <div class="field"><label>Authority</label><input class="input" id="auth" value="${H.esc(r.authority||'')}" placeholder="e.g. ZATCA, SFDA, SDAIA"/></div>
        <div class="field"><label>Type</label><input class="input" id="type" value="${H.esc(r.type||'')}"/></div>
      </div>
      <div class="two-col">
        <div class="field"><label>Published</label><input class="input" type="date" id="pub" value="${H.esc((r.publishedDate||'').slice(0,10))}"/></div>
        <div class="field"><label>Effective</label><input class="input" type="date" id="eff" value="${H.esc((r.effectiveDate||'').slice(0,10))}"/></div>
      </div>
      <div class="two-col">
        <div class="field"><label>Impact</label><select class="input" id="imp">${['High','Medium','Low'].map(x=>`<option ${r.impact===x?'selected':''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label>Status</label><select class="input" id="st">${['Assessing','In Progress','On Hold','Done'].map(x=>`<option ${r.status===x?'selected':''}>${x}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Owner</label><select class="input" id="own"><option value="">— select —</option>${empOpts}</select></div>
      <div class="field"><label>Summary</label><textarea class="input" id="sum" style="min-height:64px">${H.esc(r.summary||'')}</textarea></div>
      <div class="field"><label>Required action</label><textarea class="input" id="act" style="min-height:56px">${H.esc(r.action||'')}</textarea></div>
      <div class="field"><label>Mapped requirements</label><div class="card pad" style="max-height:150px;overflow:auto;box-shadow:none">${reqOpts||'<span class="muted">No requirements.</span>'}</div></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">${existing?'Save':'Log change'}</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    const linked=[...document.querySelectorAll('.modal input[type=checkbox]:checked')].map(x=>x.value);
    const obj={ ...r, title:document.getElementById('t').value.trim(), authority:document.getElementById('auth').value.trim(),
      type:document.getElementById('type').value.trim(), publishedDate:document.getElementById('pub').value, effectiveDate:document.getElementById('eff').value,
      impact:document.getElementById('imp').value, status:document.getElementById('st').value, owner:document.getElementById('own').value,
      summary:document.getElementById('sum').value.trim(), action:document.getElementById('act').value.trim(), linkedRequirements:linked };
    if(!obj.title){ H.toast('Title required'); return; }
    if(!existing){ obj.id='RC-'+new Date().getFullYear()+'-'+Math.random().toString().slice(2,5); }
    if(existing) await DB.put('regChanges',obj); else await DB.add('regChanges',obj);
    await logAudit(existing?'Updated regulatory change':'Logged regulatory change', obj.id, obj.authority);
    H.toast('Saved'); H.closeModal(); location.hash='#/reg-changes';
  };
}
