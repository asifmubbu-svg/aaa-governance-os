import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { renderFlow, renderSwimlane, openFlowEditor, generateRaciFromFlow } from './flow.js';

const me = ()=> (DB.getCurrentUser && DB.getCurrentUser()?.name) || 'System';

export async function renderRepository(c, params){
  if(params && params[0]){ return viewDoc(c, params[0]); }
  const docs = await DB.getAll('documents');
  const domains = await DB.getAll('domains');
  const employees = await DB.getAll('employees');
  const meta = await DB.getMeta();
  const q0 = sessionStorage.getItem('q')||''; sessionStorage.removeItem('q');

  c.innerHTML = `
  <div class="page-head">
    <div><div class="eyebrow">Knowledge Base</div><h1>Governance Repository</h1>
    <p>Single source of truth for every policy, SOP, standard and process — versioned, owned, approved and auditable.</p></div>
    <div class="page-actions"><button class="btn primary" id="new-doc">${ICON('plus')} New Artifact</button></div>
  </div>
  <div class="toolbar">
    <input class="input" id="q" placeholder="Search title or ID…" value="${H.esc(q0)}" style="min-width:240px"/>
    <select class="input" id="f-domain"><option value="">All domains</option>${domains.map(d=>`<option value="${d.code}">${H.esc(d.name)}</option>`).join('')}</select>
    <select class="input" id="f-type"><option value="">All types</option>${(meta.docTypes||[]).map(t=>`<option>${t}</option>`).join('')}</select>
    <select class="input" id="f-status"><option value="">All statuses</option>${(meta.statuses||[]).map(s=>`<option>${s}</option>`).join('')}</select>
    <span class="muted" id="count" style="margin-left:auto"></span>
  </div>
  <div id="rows"></div>`;

  const draw=()=>{
    const q=document.getElementById('q').value.toLowerCase();
    const fd=document.getElementById('f-domain').value, ft=document.getElementById('f-type').value, fs=document.getElementById('f-status').value;
    let list=docs.filter(d=>
      (!q || d.title.toLowerCase().includes(q) || d.id.toLowerCase().includes(q)) &&
      (!fd || d.domain===fd) && (!ft || d.type===ft) && (!fs || d.status===fs));
    list.sort((a,b)=> a.id.localeCompare(b.id));
    document.getElementById('count').textContent=`${list.length} of ${docs.length} artifacts`;
    document.getElementById('rows').innerHTML = list.length ? `
      <div class="table-wrap"><table><thead><tr>
        <th>ID</th><th>Title</th><th>Type</th><th>Domain</th><th>Owner</th><th>Status</th><th>Ver</th><th>Review due</th><th></th>
      </tr></thead><tbody>
        ${list.map(d=>`<tr class="clickable" data-id="${d.id}">
          <td class="mono">${d.id}</td>
          <td><b>${H.esc(d.title)}</b>${d.flow&&d.flow.length?' <span class="badge b-green" style="font-size:10px">flow</span>':''}${d.acknowRequired?' <span class="badge b-blue" style="font-size:10px">ack</span>':''}</td>
          <td>${H.esc(d.type)}</td><td>${H.esc(d.domainName)}</td><td>${H.esc(d.owner||'—')}</td>
          <td>${H.statusBadge(d.status)}</td><td class="mono">${d.version}</td><td>${H.fmtDate(d.reviewDate)}</td>
          <td><button class="btn ghost sm view">${ICON('eye',15)}</button></td>
        </tr>`).join('')}
      </tbody></table></div>` : `<div class="empty"><div class="ic">📄</div><p>No artifacts match your filters.</p></div>`;
    document.querySelectorAll('#rows tr[data-id]').forEach(tr=> tr.onclick=()=> location.hash='#/repository/'+tr.dataset.id);
  };
  ['q','f-domain','f-type','f-status'].forEach(id=> document.getElementById(id).oninput=draw);
  document.getElementById('new-doc').onclick=()=> editDoc(null, domains, meta, employees);
  draw();
}

function wfVisualizer(d){
  const wf=d.workflow;
  const cls=(s,i)=> s.status==='Approved'?'done':(s.status==='Rejected'?'rej':((s.status==='Returned'||s.status==='Changes requested')?'ret':((i===wf.stageIndex && d.status==='Released')?'cur':'')));
  const stages = (wf&&wf.stages&&wf.stages.length)? wf.stages : [{name:'Review',status:'Pending'},{name:'Approve',status:'Pending'}];
  return `<div class="wf-viz">
    <span class="wf-stage done">Draft</span><span class="wf-arrow">→</span>
    ${stages.map((s,i)=>`<span class="wf-stage ${wf?cls(s,i):''}" title="${H.esc(s.decidedBy?('by '+s.decidedBy):(s.dueDate?('due '+H.fmtDate(s.dueDate)):''))}">${H.esc(s.name)}${(s.status&&s.status!=='Pending')?' · '+s.status:''}</span><span class="wf-arrow">→</span>`).join('')}
    <span class="wf-stage ${d.status==='Active'?'done':''}">Active</span>
  </div>`;
}
function redline(oldT,newT){
  const a=(oldT||'').split(/(\s+)/), b=(newT||'').split(/(\s+)/), n=a.length, m=b.length;
  const dp=Array.from({length:n+1},()=>new Array(m+1).fill(0));
  for(let i=n-1;i>=0;i--) for(let j=m-1;j>=0;j--) dp[i][j]= a[i]===b[j]? dp[i+1][j+1]+1 : Math.max(dp[i+1][j],dp[i][j+1]);
  let i=0,j=0,out='';
  while(i<n&&j<m){ if(a[i]===b[j]){ out+=H.esc(b[j]); i++;j++; } else if(dp[i+1][j]>=dp[i][j+1]){ out+=`<del>${H.esc(a[i])}</del>`; i++; } else { out+=`<ins>${H.esc(b[j])}</ins>`; j++; } }
  while(i<n){ out+=`<del>${H.esc(a[i])}</del>`; i++; }
  while(j<m){ out+=`<ins>${H.esc(b[j])}</ins>`; j++; }
  return out;
}
function promptComment(title, label, required, cb){
  H.modal({title, body:`<div class="field"><label>${H.esc(label)}</label><textarea class="input" id="pc" placeholder="${required?'Required':'Optional'}"></textarea></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="ok">Confirm</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('ok').onclick=()=>{ const v=document.getElementById('pc').value.trim(); if(required&&!v){ H.toast('A comment is required'); return; } H.closeModal(); cb(v); };
}

async function viewDoc(c, id){
  const d = (await DB.getAll('documents')).find(x=>x.id===id);
  if(!d){ c.innerHTML=`<div class="empty"><div class="ic">🔍</div><p>Artifact ${H.esc(id)} not found.</p><a class="btn" href="#/repository">Back</a></div>`; return; }
  const crs = (await DB.getAll('changeRequests')).filter(x=>x.docId===id);
  const acks = (await DB.getAll('acknowledgments')).filter(x=>x.docId===id);
  const domains = await DB.getAll('domains'); const meta = await DB.getMeta();
  const employees = await DB.getAll('employees');
  let versions = []; try{ versions = await DB.getVersions(d._id); }catch(e){}
  const user = DB.getCurrentUser()||{}; const RANKV={Viewer:1,Author:2,HOD:3,Executive:4,Admin:5}; const rankv=RANKV[user.role]||0;
  const wf=d.workflow; const stage=(d.status==='Released'&&wf&&wf.stages)?wf.stages[wf.stageIndex]:null;
  const canAct=stage&&(user.role===stage.role||rankv>=5); const isOwner=d.owner===user.name;

  const acts=[];
  if(d.status==='Draft' && rankv>=2) acts.push(`<button class="btn sm primary" id="submit">${ICON('send',15)} Submit for approval</button>`);
  else if(d.status==='Released'){
    if(canAct){
      if(isOwner) acts.push(`<span class="badge b-amber">Conflict of interest — you own this</span>`);
      else acts.push(`<button class="btn sm primary" id="approve">${ICON('check',15)} Approve</button>`);
      acts.push(`<button class="btn sm" id="changes">Request changes</button>`);
      acts.push(`<button class="btn sm" id="return">Return</button>`);
      acts.push(`<button class="btn sm danger" id="reject">Reject</button>`);
    } else acts.push(stage?`<span class="badge b-amber">Awaiting ${H.esc(stage.role)} decision</span>`:`<span class="badge b-slate">Submitted (pre-workflow) — cancel &amp; resubmit to route</span>`);
    if(isOwner||rankv>=5) acts.push(`<button class="btn sm" id="cancel">Cancel</button>`);
  } else if(d.status==='Active'){
    if(rankv>=3) acts.push(`<button class="btn sm" id="withdraw">Withdraw</button>`);
    acts.push(`<button class="btn sm" id="ctrlcopy">${ICON('download',15)} Controlled copy</button>`);
  } else if(['Rejected','Withdrawn','Superseded'].includes(d.status) && rankv>=2){
    acts.push(`<button class="btn sm" id="reopen">Reopen as draft</button>`);
  }
  if(d.acknowRequired) acts.push(`<button class="btn sm" id="ack">${ICON('check',15)} Acknowledge</button>`);
  acts.push(`<button class="btn sm" id="evi">${ICON('download',15)} Evidence pack</button>`);
  if(rankv>=2) acts.push(`<button class="btn sm" id="edit">${ICON('edit',15)} Edit</button>`);
  if(rankv>=2) acts.push(`<button class="btn sm danger" id="del">${ICON('trash',15)} Delete</button>`);

  const history=(wf&&wf.history)?wf.history:[];
  c.innerHTML=`
  <div class="flex between center wrap" style="margin-bottom:14px">
    <a class="btn ghost sm" href="#/repository">← Repository</a>
    <div class="page-actions">${acts.join('')}</div>
  </div>
  <div class="doc-layout">
    <div>
      <div class="card pad">
        <div class="mono muted">${d.id} · v${d.version||'0.0'}</div>
        <h1 style="margin:6px 0 4px">${H.esc(d.title)}</h1>
        <div class="flex gap wrap" style="margin:6px 0 8px">${H.statusBadge(d.status)} ${H.riskBadge(d.riskLevel)} <span class="badge b-slate">${H.esc(d.type)}</span></div>
        ${wfVisualizer(d)}
        <div class="doc-body" style="margin-top:12px">
          ${(d.sections||[]).map(s=>`<h2>${H.esc(s.heading)}</h2><p>${H.esc(s.body)||'<span class="muted">—</span>'}</p>`).join('')}
        </div>
      </div>
      <div class="card pad" style="margin-top:16px">
        <div class="flex between center wrap gap"><b>Process flow</b><div class="flex gap center">
          ${d.flow&&d.flow.length?`<div class="flow-toggle"><button data-fv="flow" class="active">Flow</button><button data-fv="swim">Swimlane</button></div>`:''}
          ${d.flow&&d.flow.length?`<button class="btn ghost sm" id="genraci">${ICON('table',14)} Generate RACI</button>`:''}
          <button class="btn ghost sm" id="flow2">${ICON('edit',14)} Design</button></div></div>
        <div id="flow-view">${renderFlow(d.flow, employees)}</div>
      </div>
    </div>
    <div>
      <div class="card pad doc-meta">
        <b>Details</b>
        <div class="row"><span class="k">Domain</span><span>${H.esc(d.domainName)}</span></div>
        <div class="row"><span class="k">Type</span><span>${H.esc(d.type)}</span></div>
        <div class="row"><span class="k">Owner</span><span>${H.esc(d.owner||'—')}</span></div>
        <div class="row"><span class="k">Entity</span><span>${H.esc(d.entity)}</span></div>
        <div class="row"><span class="k">Effective</span><span>${H.fmtDate(d.effectiveDate)}</span></div>
        <div class="row"><span class="k">Expiry</span><span>${d.expiryDate?H.fmtDate(d.expiryDate):'—'}</span></div>
        <div class="row"><span class="k">Review due</span><span>${H.fmtDate(d.reviewDate)}</span></div>
        <div class="row"><span class="k">Version</span><span class="mono">${d.version||'0.0'}</span></div>
      </div>
      <div class="card pad" style="margin-top:14px">
        <b>Workflow</b>
        <div style="margin-top:8px">${(wf&&wf.stages)? wf.stages.map(s=>`<div class="flex between center" style="padding:7px 0;border-bottom:1px solid var(--border)"><div><b style="font-size:12.5px">${H.esc(s.name)}</b><div class="muted" style="font-size:11px">${H.esc(s.role)}${s.decidedBy?(' · '+H.esc(s.decidedBy)):''}${s.dueDate&&s.status==='Pending'?(' · due '+H.fmtDate(s.dueDate)):''}</div>${s.comment?`<div class="muted" style="font-size:11.5px">“${H.esc(s.comment)}”</div>`:''}</div>${H.statusBadge(s.status)}</div>`).join('') : '<div class="muted" style="font-size:12.5px">Not yet submitted. Workflow: '+H.esc(d.workflowKey||'default')+'.</div>'}</div>
        ${history.length?`<div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-top:10px">History</div><div style="margin-top:4px">${history.slice().reverse().slice(0,8).map(h=>`<div style="font-size:11.5px;padding:3px 0"><b>${H.esc(h.action)}</b> · ${H.esc(h.by)} · ${H.fmtDate(h.at)}${h.comment?` — ${H.esc(h.comment)}`:''}</div>`).join('')}</div>`:''}
      </div>
      <div class="card pad" style="margin-top:14px">
        <div class="flex between center"><b>Version history</b>${versions.length>=2?`<button class="btn ghost sm" id="compare">Compare</button>`:''}</div>
        <div style="margin-top:8px">${versions.length? versions.slice().reverse().map(v=>`<div class="flex between center" style="padding:7px 0;border-bottom:1px solid var(--border)">
          <div><b class="mono" style="font-size:12.5px">v${v.version}</b> ${H.statusBadge(v.status)}<div class="muted" style="font-size:11px">${H.esc(v.createdBy)} · ${H.fmtDate(v.createdAt)}${v.changeJustification?` · ${H.esc(v.changeJustification)}`:''}</div></div>
          <div class="flex gap"><button class="btn ghost sm vview" data-v="${H.esc(v.version)}">${ICON('eye',13)}</button>${rankv>=2?`<button class="btn ghost sm vroll" data-v="${H.esc(v.version)}" title="Roll back to this version">${ICON('git',13)}</button>`:''}</div></div>`).join('') : '<div class="muted" style="font-size:12.5px">No versions yet. Submitting for approval creates the first immutable snapshot.</div>'}</div>
      </div>
      <div class="card pad" style="margin-top:14px">
        <b>Linked to</b>
        <div style="margin-top:8px">
          <div class="muted" style="font-size:12px">Departments</div>${(d.linkedDepartments||[]).map(x=>`<span class="tag">${H.esc(x)}</span>`).join('')||'<span class="muted" style="font-size:12px">—</span>'}
          <div class="muted" style="font-size:12px;margin-top:8px">Employees</div>${(d.linkedEmployees||[]).map(x=>`<span class="tag">${H.esc(x)}</span>`).join('')||'<span class="muted" style="font-size:12px">—</span>'}
        </div>
      </div>
      ${d.custom && Object.keys(d.custom).filter(k=>d.custom[k]).length ? `<div class="card pad doc-meta" style="margin-top:14px"><b>Custom fields</b>${Object.entries(d.custom).filter(([k,v])=>v).map(([k,v])=>`<div class="row"><span class="k">${H.esc(k)}</span><span>${H.esc(v)}</span></div>`).join('')}</div>` : ''}
      <div class="card pad" style="margin-top:14px"><b>Tags</b><div style="margin-top:8px">${(d.tags||[]).map(t=>`<span class="tag">${H.esc(t)}</span>`).join('')}</div></div>
    </div>
  </div>`;

  const reload=()=> viewDoc(c,id);
  const wrap=(fn)=> async()=>{ try{ await fn(); reload(); }catch(e){ /* db layer toasts 403 */ } };
  const on=(idn,fn)=>{ const b=document.getElementById(idn); if(b) b.onclick=fn; };
  on('edit', ()=> editDoc(d, domains, meta, employees));
  on('flow', ()=> openFlowEditor(d, reload));
  on('flow2', ()=> openFlowEditor(d, reload));
  const gr=document.getElementById('genraci'); if(gr) gr.onclick=async()=>{ await generateRaciFromFlow(d); };
  c.querySelectorAll('[data-fv]').forEach(b=> b.onclick=()=>{ c.querySelectorAll('[data-fv]').forEach(x=>x.classList.toggle('active',x===b)); document.getElementById('flow-view').innerHTML = b.dataset.fv==='swim'? renderSwimlane(d.flow, employees) : renderFlow(d.flow, employees); });
  on('evi', ()=> exportEvidencePack(d, crs, acks, versions));
  on('del', ()=> H.confirmDialog(`Delete "${d.title}"? This cannot be undone.`, async()=>{ await DB.del('documents', d._id); await logAudit('Deleted document', d.title, d.entity); H.toast('Artifact deleted'); location.hash='#/repository'; }));
  on('submit', ()=> promptComment('Submit for approval','Change justification (what changed and why)', true, wrap(async(j)=>{ await DB.submitDoc(d._id, j); H.toast('Submitted — routed for approval'); })));
  on('approve', ()=> promptComment('Approve','Approval comment', false, wrap(async(cm)=>{ await DB.decideDoc(d._id,'approve',cm); H.toast('Approved'); })));
  on('changes', ()=> promptComment('Request changes','What needs to change', true, wrap(async(cm)=>{ await DB.decideDoc(d._id,'changes',cm); H.toast('Changes requested'); })));
  on('return', ()=> promptComment('Return for correction','Reason for return', true, wrap(async(cm)=>{ await DB.decideDoc(d._id,'return',cm); H.toast('Returned for correction'); })));
  on('reject', ()=> promptComment('Reject','Reason for rejection', true, wrap(async(cm)=>{ await DB.decideDoc(d._id,'reject',cm); H.toast('Rejected'); })));
  on('cancel', wrap(async()=>{ await DB.cancelDoc(d._id); H.toast('Submission cancelled'); }));
  on('withdraw', ()=> promptComment('Withdraw document','Reason', true, wrap(async(cm)=>{ await DB.withdrawDoc(d._id, cm); H.toast('Withdrawn'); })));
  on('reopen', wrap(async()=>{ d.status='Draft'; await DB.put('documents',d); await logAudit('Reopened as draft', d.title, d.entity); H.toast('Reopened as draft'); }));
  on('ctrlcopy', ()=> printControlledCopy(d));
  const ackBtn=document.getElementById('ack');
  if(ackBtn) ackBtn.onclick=wrap(async()=>{ await DB.add('acknowledgments',{docId:d.id, user:me(), date:new Date().toISOString()}); await logAudit('Acknowledged policy', d.title, d.entity); H.toast('Acknowledged'); });
  // version view / rollback / compare
  c.querySelectorAll('.vview').forEach(b=> b.onclick=()=>{ const v=versions.find(x=>x.version===b.dataset.v); if(v) viewSnapshot(v); });
  c.querySelectorAll('.vroll').forEach(b=> b.onclick=()=> H.confirmDialog(`Roll back "${d.title}" to v${b.dataset.v}? This creates a new draft from that version.`, wrap(async()=>{ await DB.rollbackDoc(d._id, b.dataset.v); H.toast('Rolled back — new draft created'); })));
  on('compare', ()=> compareVersions(versions));
}
function viewSnapshot(v){
  const s=v.snapshot||{};
  H.modal({title:`v${v.version} — ${s.title||''}`, size:'lg',
    body:`<div class="flex gap wrap" style="margin-bottom:8px">${H.statusBadge(v.status)}<span class="muted">${H.esc(v.createdBy)} · ${H.fmtDate(v.createdAt)}</span></div>
      ${v.changeJustification?`<div class="muted" style="margin-bottom:10px">Change: ${H.esc(v.changeJustification)}</div>`:''}
      <div class="doc-body">${(s.sections||[]).map(x=>`<h2>${H.esc(x.heading)}</h2><p>${H.esc(x.body)||'—'}</p>`).join('')}</div>`,
    footer:`<button class="btn primary" id="cx">Close</button>`});
  document.getElementById('cx').onclick=H.closeModal;
}
function compareVersions(versions){
  const opts=(sel)=>versions.map(v=>`<option value="${H.esc(v.version)}" ${v.version===sel?'selected':''}>v${v.version} (${v.status})</option>`).join('');
  const a=versions[versions.length-2].version, b=versions[versions.length-1].version;
  H.modal({title:'Compare versions', size:'lg',
    body:`<div class="toolbar"><label class="muted" style="font-size:12px">From</label><select class="input" id="cv-a">${opts(a)}</select>
      <label class="muted" style="font-size:12px">To</label><select class="input" id="cv-b">${opts(b)}</select>
      <button class="btn sm primary" id="cv-run">Compare</button></div><div id="cv-out"></div>`,
    footer:`<button class="btn" id="cx">Close</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  const run=()=>{
    const va=versions.find(x=>x.version===document.getElementById('cv-a').value);
    const vb=versions.find(x=>x.version===document.getElementById('cv-b').value);
    const sa=(va.snapshot||{}).sections||[], sb=(vb.snapshot||{}).sections||[];
    const heads=[...new Set([...sa.map(x=>x.heading),...sb.map(x=>x.heading)])];
    document.getElementById('cv-out').innerHTML=`<div class="redline">${heads.map(h=>{
      const oa=(sa.find(x=>x.heading===h)||{}).body||'', ob=(sb.find(x=>x.heading===h)||{}).body||'';
      return `<h3>${H.esc(h)}</h3><p>${redline(oa,ob)}</p>`;
    }).join('')}</div><div class="muted" style="font-size:11.5px;margin-top:8px"><ins>inserted</ins> · <del>removed</del></div>`;
  };
  document.getElementById('cv-run').onclick=run; run();
}
function printControlledCopy(d){
  const w=window.open('','_blank'); if(!w){ H.toast('Allow pop-ups to print the controlled copy'); return; }
  const stamp=new Date().toLocaleString('en-GB');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${H.esc(d.id)} v${d.version}</title><style>
    body{font-family:Arial,sans-serif;color:#0f1a14;margin:0;padding:40px 48px;position:relative}
    .wm{position:fixed;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:70px;color:rgba(6,113,57,.08);font-weight:800;white-space:nowrap;pointer-events:none;z-index:0}
    .hd{border-bottom:3px solid #067139;padding-bottom:10px;margin-bottom:16px}
    .hd h1{margin:0;color:#04582d;font-size:20px}.meta{font-size:12px;color:#647067;margin-top:4px}
    h2{font-size:14px;color:#04582d;margin:18px 0 6px}p{white-space:pre-wrap;position:relative;z-index:1}
    .foot{margin-top:30px;border-top:1px solid #ccc;padding-top:8px;font-size:11px;color:#647067}
  </style></head><body>
  <div class="wm">CONTROLLED COPY</div>
  <div class="hd"><h1>${H.esc(d.title)}</h1><div class="meta">${d.id} · v${d.version} · ${H.esc(d.type)} · Status: ${H.esc(d.status)} · Effective: ${d.effectiveDate?H.fmtDate(d.effectiveDate):'—'} · Owner: ${H.esc(d.owner||'—')}</div></div>
  ${(d.sections||[]).map(s=>`<h2>${H.esc(s.heading)}</h2><p>${H.esc(s.body)||'—'}</p>`).join('')}
  <div class="foot">Controlled copy printed ${stamp}. Uncontrolled when printed — verify the current version in Governance OS before use. Ahmad A. Abed Holding.</div>
  </body></html>`);
  w.document.close(); w.focus();
  logAudit('Printed controlled copy', d.title, d.entity);
}

async function editDoc(doc, domains, meta, employees, presetType){
  const isNew=!doc;
  const config = await DB.getConfig();
  const typeCfgLookup = (k)=> (config.documentTypes||[]).find(t=>t.key===k) || {};
  let d;
  if(doc){ d=doc; }
  else {
    const tk = presetType || (config.documentTypes&&config.documentTypes[0]&&config.documentTypes[0].key) || 'Policy';
    const cfg = typeCfgLookup(tk);
    const dt = new Date(); dt.setMonth(dt.getMonth()+(cfg.reviewMonths||12));
    d = { title:'', type:tk, domain:domains[0].code, status:'Draft', version:'0.1', owner:'', entity:'All AAA entities', riskLevel:'Medium',
      effectiveDate:new Date().toISOString().slice(0,10), reviewDate:dt.toISOString().slice(0,10), acknowRequired:false, tags:[], custom:{},
      sections:(cfg.sections&&cfg.sections.length)? cfg.sections.map(h=>({heading:h,body:''})) : [{heading:'1. Purpose',body:''},{heading:'2. Scope',body:''}] };
  }
  const empSorted=employees.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const ownerOpts=`<option value="">— Unassigned —</option>`+empSorted.map(e=>`<option ${e.name===d.owner?'selected':''}>${H.esc(e.name)}</option>`).join('');
  const types = (config.documentTypes&&config.documentTypes.length)? config.documentTypes.map(t=>t.key) : meta.docTypes;
  const typeCfg = (k)=> (config.documentTypes||[]).find(t=>t.key===k) || {};
  const cfRows = (tk, values={})=> ((typeCfg(tk).customFields)||[]).map(f=>`<div class="field"><label>${H.esc(f.label)}</label><input class="input cf" data-label="${H.esc(f.label)}" type="${f.type==='date'?'date':(f.type==='number'?'number':'text')}" value="${H.esc((values&&values[f.label])||'')}"/></div>`).join('') || '<div class="muted" style="font-size:12px">No custom fields for this type.</div>';
  H.modal({title:isNew?'New Artifact':'Edit Artifact', size:'lg',
    body:`
    <div class="field-row">
      <div class="field"><label>Title</label><input class="input" id="e-title" value="${H.esc(d.title)}"/></div>
      <div class="field"><label>Owner (from employees — can be blank)</label><select class="input" id="e-owner">${ownerOpts}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Type</label><select class="input" id="e-type">${types.map(t=>`<option ${t===d.type?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Domain</label><select class="input" id="e-domain">${domains.map(x=>`<option value="${x.code}" ${x.code===d.domain?'selected':''}>${H.esc(x.name)}</option>`).join('')}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Risk level</label><select class="input" id="e-risk">${['Low','Medium','High'].map(r=>`<option ${r===d.riskLevel?'selected':''}>${r}</option>`).join('')}</select></div>
      <div class="field"><label>Version</label><input class="input" id="e-ver" value="${H.esc(d.version)}"/></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Review due</label><input class="input" type="date" id="e-review" value="${(d.reviewDate||'').slice(0,10)}"/></div>
      <div class="field"><label>Expiry (optional)</label><input class="input" type="date" id="e-expiry" value="${(d.expiryDate||'').slice(0,10)}"/></div>
    </div>
    <div class="field"><label><input type="checkbox" id="e-ack" ${d.acknowRequired?'checked':''}/> Requires read &amp; acknowledge</label></div>
    ${isNew?'<div class="muted" style="font-size:12px;margin-bottom:8px">New artifacts start in <b>Draft</b>. Release it from the document view to route it for HOD then Executive approval before it becomes Active.</div>':''}
    <div class="field"><label>Content sections</label><div id="secs">${(d.sections||[]).map((s,i)=>secRow(s,i)).join('')}</div>
      <button class="btn sm" id="add-sec" type="button">${ICON('plus',14)} Add section</button></div>
    <div class="field"><label>Custom fields <span class="muted" style="font-weight:400">(defined per document type in Administration)</span></label><div id="custom-fields">${cfRows(d.type, d.custom)}</div></div>
    `,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">${isNew?'Create artifact':'Save changes'}</button>`});

  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('add-sec').onclick=()=>{ const w=document.getElementById('secs'); w.insertAdjacentHTML('beforeend', secRow({heading:'',body:''}, w.children.length)); };
  document.getElementById('e-type').onchange=(ev)=>{
    const tk=ev.target.value; const cfg=typeCfg(tk);
    document.getElementById('custom-fields').innerHTML=cfRows(tk, d.custom);
    if(isNew){
      if(cfg.sections&&cfg.sections.length){ document.getElementById('secs').innerHTML=cfg.sections.map((h,i)=>secRow({heading:h,body:''},i)).join(''); }
      if(cfg.reviewMonths){ const dt=new Date(); dt.setMonth(dt.getMonth()+cfg.reviewMonths); document.getElementById('e-review').value=dt.toISOString().slice(0,10); }
    }
  };
  document.getElementById('sv').onclick=async()=>{
    const secs=[...document.querySelectorAll('#secs .sec')].map(r=>({heading:r.querySelector('.sh').value, body:r.querySelector('.sb').value})).filter(s=>s.heading||s.body);
    const custom={}; document.querySelectorAll('#custom-fields .cf').forEach(i=> custom[i.dataset.label]=i.value);
    const obj={...d,
      title:val('e-title'), owner:document.getElementById('e-owner').value, type:val('e-type'), domain:val('e-domain'),
      domainName:domains.find(x=>x.code===val('e-domain')).name,
      riskLevel:val('e-risk'), version:val('e-ver'), reviewDate:val('e-review'), expiryDate:document.getElementById('e-expiry').value,
      acknowRequired:document.getElementById('e-ack').checked, sections:secs, custom,
      tags:d.tags&&d.tags.length?d.tags:[domains.find(x=>x.code===val('e-domain')).name, val('e-type')]
    };
    if(!obj.title){ H.toast('Title is required'); return; }
    if(isNew){ obj.status='Draft'; obj.approval={hod:{approver:'',status:'Pending',at:''},exec:{approver:'',status:'Pending',at:''}}; const t=(config.documentTypes||[]).find(x=>x.key===obj.type); const prefix=t?t.prefix:'DOC'; obj.id=`${prefix}-${obj.domain}-${String(Math.floor(Math.random()*900)+100)}`; await DB.add('documents',obj); await logAudit('Created document', obj.title, obj.entity); H.toast('Artifact created (Draft)'); H.closeModal(); location.hash='#/repository/'+obj.id; }
    else { await DB.put('documents',obj); await logAudit('Updated document', obj.title, obj.entity); H.toast('Changes saved'); H.closeModal(); location.hash='#/repository'; setTimeout(()=>location.hash='#/repository/'+obj.id,10); }
  };
}
const secRow=(s,i)=>`<div class="sec card pad" style="box-shadow:none;margin-bottom:8px;padding:12px">
  <input class="input sh" placeholder="Section heading" value="${H.esc(s.heading)}" style="width:100%;margin-bottom:6px"/>
  <textarea class="input sb" placeholder="Section body">${H.esc(s.body)}</textarea></div>`;
const val=id=>document.getElementById(id).value.trim();
function genId(o){ const tc={'Policy':'POL','SOP':'SOP','Process':'PRC','Standard':'STD','Knowledge Article':'KB','Form':'FRM','Delegation of Authority':'DOA'}[o.type]||'DOC'; return `${tc}-${o.domain}-${String(Math.floor(Math.random()*900)+100)}`; }

export async function logAudit(action, target, entity){
  await DB.add('auditEvents',{actor:me(), action, target, date:new Date().toISOString(), entity:entity||'AAA Holding'});
}

// Open the New Artifact editor pre-set to a document type (used by the Create Artifact page)
export async function createArtifact(typeKey){
  const domains = await DB.getAll('domains');
  const meta = await DB.getMeta();
  const employees = await DB.getAll('employees');
  editDoc(null, domains, meta, employees, typeKey);
}

async function exportEvidencePack(d, crs, acks, versions){
  const risks=(await DB.getAll('risks')).filter(r=>(r.linkedDocs||[]).includes(d.id));
  const audit=(await DB.getAll('auditEvents')).filter(a=>a.target===d.title).slice(0,25);
  if(!versions){ try{ versions=await DB.getVersions(d._id); }catch(e){ versions=[]; } }
  const hist=(d.workflow&&d.workflow.history)?d.workflow.history:[];
  const row=(k,v)=>`<tr><td class="k">${H.esc(k)}</td><td>${v}</td></tr>`;
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Evidence Pack — ${H.esc(d.id)}</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;color:#0f1a14}
    body{margin:0;padding:0}
    .hd{background:#067139;color:#fff;padding:22px 32px}
    .hd h1{margin:0;font-size:20px}.hd .s{opacity:.9;font-size:13px;margin-top:3px}
    .wrap{padding:24px 32px}
    h2{font-size:14px;border-bottom:2px solid #067139;padding-bottom:5px;margin:22px 0 10px;color:#04582d}
    table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:6px}
    td,th{border:1px solid #dfe5e1;padding:7px 9px;text-align:left;vertical-align:top}
    th{background:#f2f6f4}
    td.k{background:#f8faf9;font-weight:bold;width:200px}
    .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:bold;background:#e6f2ec;color:#067139}
    .muted{color:#647067}.foot{margin-top:26px;font-size:11px;color:#647067;border-top:1px solid #dfe5e1;padding-top:10px}
    @media print{.noprint{display:none}}
  </style></head><body>
  <div class="hd"><h1>Governance Evidence Pack</h1><div class="s">Ahmad A. Abed Holding · Governance OS · Generated ${new Date().toLocaleString('en-GB')}</div></div>
  <div class="wrap">
    <button class="noprint" onclick="window.print()" style="float:right;padding:8px 14px;background:#067139;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer">Print / Save as PDF</button>
    <h2>1. Artifact</h2><table>
      ${row('Reference',d.id)}${row('Title','<b>'+H.esc(d.title)+'</b>')}${row('Type',H.esc(d.type))}${row('Domain',H.esc(d.domainName))}
      ${row('Owner',H.esc(d.owner||'—'))}${row('Entity',H.esc(d.entity))}${row('Version',d.version)}
      ${row('Status','<span class="badge">'+H.esc(d.status)+'</span>')}${row('Risk level',H.esc(d.riskLevel))}
      ${row('Effective',H.fmtDate(d.effectiveDate))}${row('Expiry',d.expiryDate?H.fmtDate(d.expiryDate):'—')}${row('Review due',H.fmtDate(d.reviewDate))}</table>
    <h2>2. Approval &amp; workflow history</h2><table><tr><th>Action</th><th>By</th><th>Role</th><th>Date</th><th>Comment</th></tr>
      ${hist.length?hist.map(h=>`<tr><td>${H.esc(h.action)}</td><td>${H.esc(h.by)}</td><td>${H.esc(h.role||'')}</td><td>${H.fmtDate(h.at)}</td><td>${H.esc(h.comment||'')}</td></tr>`).join(''):'<tr><td colspan="5" class="muted">Not yet submitted for approval.</td></tr>'}</table>
    <h2>3. Version history</h2><table><tr><th>Version</th><th>Status</th><th>Effective</th><th>By</th><th>Change justification</th></tr>
      ${(versions&&versions.length)?versions.map(v=>`<tr><td>v${H.esc(v.version)}</td><td>${H.esc(v.status)}</td><td>${v.effectiveDate?H.fmtDate(v.effectiveDate):'—'}</td><td>${H.esc(v.createdBy)}</td><td>${H.esc(v.changeJustification||'')}</td></tr>`).join(''):'<tr><td colspan="5" class="muted">No versions recorded.</td></tr>'}</table>
    <h2>4. Acknowledgements</h2><table><tr><th>User</th><th>Date</th></tr>
      ${acks.length?acks.map(x=>`<tr><td>${H.esc(x.user)}</td><td>${H.fmtDate(x.date)}</td></tr>`).join(''):'<tr><td colspan="2" class="muted">No acknowledgements recorded.</td></tr>'}</table>
    <h2>5. Change requests</h2><table><tr><th>ID</th><th>Type</th><th>Status</th><th>Requester</th></tr>
      ${crs.length?crs.map(x=>`<tr><td>${H.esc(x.id)}</td><td>${H.esc(x.type)}</td><td>${H.esc(x.status)}</td><td>${H.esc(x.requester)}</td></tr>`).join(''):'<tr><td colspan="4" class="muted">None.</td></tr>'}</table>
    <h2>6. Linked risks</h2><table><tr><th>ID</th><th>Risk</th><th>Residual</th><th>Owner</th></tr>
      ${risks.length?risks.map(r=>`<tr><td>${H.esc(r.id)}</td><td>${H.esc(r.title)}</td><td>${H.esc(r.residual)}</td><td>${H.esc(r.owner)}</td></tr>`).join(''):'<tr><td colspan="4" class="muted">None linked.</td></tr>'}</table>
    <h2>7. Audit activity (recent)</h2><table><tr><th>Date</th><th>Actor</th><th>Action</th></tr>
      ${audit.length?audit.map(x=>`<tr><td>${H.fmtDate(x.date)}</td><td>${H.esc(x.actor)}</td><td>${H.esc(x.action)}</td></tr>`).join(''):'<tr><td colspan="3" class="muted">No events.</td></tr>'}</table>
    <div class="foot">This evidence pack was generated automatically from Governance OS records for audit purposes. Ahmad A. Abed Holding Co.</div>
  </div></body></html>`;
  const w=window.open('','_blank');
  if(!w){ H.toast('Allow pop-ups to export the evidence pack'); return; }
  w.document.write(html); w.document.close(); w.focus();
  await logAudit('Exported evidence pack', d.title, d.entity);
  H.toast('Evidence pack generated');
}
