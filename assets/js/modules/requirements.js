import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

const canEdit = ()=> ({Author:2,HOD:3,Executive:4,Admin:5}[(DB.getCurrentUser&&DB.getCurrentUser()?.role)]||0) >= 2;
const statusBadge = (s)=>{ const m={Compliant:'b-green',Partial:'b-amber',Gap:'b-red','Not Assessed':'b-slate'}; return `<span class="badge ${m[s]||'b-slate'}">${H.esc(s)}</span>`; };
let filter='';

export async function renderRequirements(c){
  const reqs = await DB.getAll('requirements');
  const domains = await DB.getAll('domains');
  const docs = await DB.getAll('documents');
  const risks = await DB.getAll('risks');
  const controls = await DB.getAll('controls');
  const pct = (s)=> reqs.length? Math.round(reqs.filter(r=>r.complianceStatus===s).length/reqs.length*100):0;

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Compliance & Assurance</div><h1>Requirements Library</h1>
    <p>Laws, regulations, ISO clauses, internal and contractual requirements — mapped to the policies, risks and controls that satisfy them.</p></div>
    <div class="page-actions">${canEdit()?`<button class="btn primary" id="new">${ICON('plus')} New requirement</button>`:''}</div>
  </div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="stat"><div class="v">${reqs.length}</div><div class="l">Requirements</div></div>
    <div class="stat"><div class="v" style="color:var(--green)">${pct('Compliant')}%</div><div class="l">Compliant</div></div>
    <div class="stat"><div class="v" style="color:var(--amber)">${reqs.filter(r=>r.complianceStatus==='Partial').length}</div><div class="l">Partial</div></div>
    <div class="stat"><div class="v" style="color:var(--red)">${reqs.filter(r=>r.complianceStatus==='Gap').length}</div><div class="l">Gaps</div></div>
  </div>
  <div class="toolbar">${['','Compliant','Partial','Gap','Not Assessed'].map(s=>`<button class="chip ${s===filter?'active':''}" data-s="${s}">${s||'All'}</button>`).join('')}</div>
  <div id="rows"></div>`;
  c.querySelectorAll('[data-s]').forEach(b=> b.onclick=()=>{ filter=b.dataset.s; c.querySelectorAll('[data-s]').forEach(x=>x.classList.toggle('active',x===b)); draw(); });
  if(document.getElementById('new')) document.getElementById('new').onclick=()=> editReq(null, domains, ()=>renderRequirements(c));
  const draw=()=>{
    const list=reqs.filter(r=>!filter||r.complianceStatus===filter);
    document.getElementById('rows').innerHTML=`<div class="table-wrap"><table><thead><tr>
      <th>ID</th><th>Requirement</th><th>Type</th><th>Source</th><th>Owner</th><th>Status</th><th>Links</th></tr></thead><tbody>
      ${list.map(r=>`<tr class="clickable" data-id="${r._id}"><td class="mono">${r.id}</td><td><b>${H.esc(r.title)}</b></td><td>${H.esc(r.type)}</td>
        <td>${H.esc(r.source)}</td><td>${H.esc(r.owner)}</td><td>${statusBadge(r.complianceStatus)}</td>
        <td class="muted">${(r.linkedDocs||[]).length}P · ${(r.linkedRisks||[]).length}R · ${(r.linkedControls||[]).length}C</td></tr>`).join('')}
    </tbody></table></div>`;
    document.querySelectorAll('#rows tr[data-id]').forEach(tr=> tr.onclick=()=> openReq(reqs.find(x=>x._id===+tr.dataset.id), docs, risks, controls, domains, ()=>renderRequirements(c)));
  };
  draw();
}

function openReq(r, docs, risks, controls, domains, refresh){
  const ld=docs.filter(d=>(r.linkedDocs||[]).includes(d.id));
  const lr=risks.filter(x=>(r.linkedRisks||[]).includes(x.id));
  const lc=controls.filter(x=>(r.linkedControls||[]).includes(x.id));
  H.modal({title:`${r.id} — ${r.title}`, size:'lg',
    body:`<div class="flex gap wrap" style="margin-bottom:10px">${statusBadge(r.complianceStatus)}<span class="badge b-slate">${H.esc(r.type)}</span></div>
    <div class="doc-meta">
      <div class="row"><span class="k">Source</span><span>${H.esc(r.source)}</span></div>
      <div class="row"><span class="k">Owner</span><span>${H.esc(r.owner)}</span></div>
      <div class="row"><span class="k">Applicability</span><span>${H.esc(r.applicability)}</span></div>
      <div class="row"><span class="k">Evidence required</span><span>${H.esc(r.evidenceRequired)}</span></div>
      <div class="row"><span class="k">Review date</span><span>${H.fmtDate(r.reviewDate)}</span></div>
    </div>
    ${r.gaps?`<div class="card pad" style="box-shadow:none;margin-top:12px;border-color:var(--red)"><b>Gap / remediation</b><p class="mb0 muted">${H.esc(r.gaps)}</p></div>`:''}
    <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px">
      <div><div class="muted" style="font-size:11px">Policies</div>${ld.map(d=>`<div class="link" style="font-size:12.5px;padding:2px 0" onclick="location.hash='#/repository/${d.id}'">${H.esc(d.title)}</div>`).join('')||'<span class="muted">—</span>'}</div>
      <div><div class="muted" style="font-size:11px">Risks</div>${lr.map(x=>`<div style="font-size:12.5px;padding:2px 0">${H.esc(x.id)} ${H.esc(x.title)}</div>`).join('')||'<span class="muted">—</span>'}</div>
      <div><div class="muted" style="font-size:11px">Controls</div>${lc.map(x=>`<div style="font-size:12.5px;padding:2px 0">${H.esc(x.id)} ${H.esc(x.title)}</div>`).join('')||'<span class="muted">—</span>'}</div>
    </div>`,
    footer:`<button class="btn" id="cx">Close</button>${canEdit()?'<button class="btn danger" id="dl">Delete</button><button class="btn primary" id="ed">Edit</button>':''}`});
  document.getElementById('cx').onclick=H.closeModal;
  if(document.getElementById('ed')) document.getElementById('ed').onclick=()=> editReq(r, domains, refresh);
  if(document.getElementById('dl')) document.getElementById('dl').onclick=()=> H.confirmDialog(`Delete ${r.id}?`, async()=>{ await DB.del('requirements',r._id); H.toast('Deleted'); H.closeModal(); refresh(); });
}

function editReq(req, domains, refresh){
  const isNew=!req;
  const r=req||{title:'',type:'Regulation',source:'',domain:domains[0].code,owner:'',applicability:'All AAA entities',complianceStatus:'Not Assessed',reviewDate:'2026-12-31',evidenceRequired:'Certificate',gaps:'',linkedDocs:[],linkedRisks:[],linkedControls:[]};
  const v=id=>document.getElementById(id).value.trim();
  H.modal({title:isNew?'New requirement':'Edit requirement', size:'lg', body:`
    <div class="field"><label>Title</label><input class="input" id="r-title" value="${H.esc(r.title)}"/></div>
    <div class="field-row"><div class="field"><label>Type</label><select class="input" id="r-type">${['Law','Regulation','ISO Clause','Standard','Internal','Contractual'].map(t=>`<option ${t===r.type?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Domain</label><select class="input" id="r-domain">${domains.map(d=>`<option value="${d.code}" ${d.code===r.domain?'selected':''}>${H.esc(d.name)}</option>`).join('')}</select></div></div>
    <div class="field"><label>Source / authority</label><input class="input" id="r-source" value="${H.esc(r.source)}"/></div>
    <div class="field-row"><div class="field"><label>Owner</label><input class="input" id="r-owner" value="${H.esc(r.owner)}"/></div>
      <div class="field"><label>Compliance status</label><select class="input" id="r-status">${['Compliant','Partial','Gap','Not Assessed'].map(s=>`<option ${s===r.complianceStatus?'selected':''}>${s}</option>`).join('')}</select></div></div>
    <div class="field-row"><div class="field"><label>Applicability</label><input class="input" id="r-appl" value="${H.esc(r.applicability)}"/></div>
      <div class="field"><label>Evidence required</label><input class="input" id="r-evid" value="${H.esc(r.evidenceRequired)}"/></div></div>
    <div class="field"><label>Gap / remediation</label><textarea class="input" id="r-gaps">${H.esc(r.gaps)}</textarea></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    const o={...r,title:v('r-title'),type:document.getElementById('r-type').value,domain:document.getElementById('r-domain').value,source:v('r-source'),
      owner:v('r-owner'),complianceStatus:document.getElementById('r-status').value,applicability:v('r-appl'),evidenceRequired:v('r-evid'),gaps:v('r-gaps')};
    if(!o.title){ H.toast('Title required'); return; }
    if(isNew){ o.id='REQ-'+String(Math.floor(Math.random()*900)+100); await DB.add('requirements',o); } else await DB.put('requirements',o);
    await logAudit(isNew?'Created requirement':'Updated requirement', o.title,'AAA Holding');
    H.toast('Requirement saved'); H.closeModal(); refresh();
  };
}
