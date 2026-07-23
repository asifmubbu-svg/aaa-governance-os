import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

const canEdit = ()=> ({Author:2,HOD:3,Executive:4,Admin:5}[(DB.getCurrentUser&&DB.getCurrentUser()?.role)]||0) >= 2;
const ratingBadge=(r)=>{ const m={Critical:'b-red',High:'b-red',Medium:'b-amber',Low:'b-green'}; return `<span class="badge ${m[r]||'b-slate'}">${r}</span>`; };
const rate=(l,i)=>{ const v=l*i; return v>=15?'Critical':v>=9?'High':v>=4?'Medium':'Low'; };
let tab='register';

export async function renderRisks(c){
  const risks=await DB.getAll('risks'); const controls=await DB.getAll('controls');
  const domains=await DB.getAll('domains'); const docs=await DB.getAll('documents');
  const emps=await DB.getAll('employees');

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Risk & Assurance</div><h1>Risk &amp; Control Register</h1>
    <p>${risks.length} risks and ${controls.length} controls, linked to policies and processes. Inherent vs residual rating using a 5×5 likelihood/impact model.</p></div>
    <div class="page-actions"><button class="btn primary" id="new">${ICON('plus')} New risk</button></div>
  </div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="stat"><div class="v" style="color:var(--red)">${risks.filter(r=>r.residual==='Critical'||r.residual==='High').length}</div><div class="l">High / Critical (residual)</div></div>
    <div class="stat"><div class="v">${controls.length}</div><div class="l">Controls</div></div>
    <div class="stat"><div class="v">${controls.filter(x=>x.effectiveness==='Effective').length}</div><div class="l">Effective controls</div></div>
    <div class="stat"><div class="v">${risks.filter(r=>r.treatment==='Mitigate').length}</div><div class="l">Being mitigated</div></div>
  </div>
  <div class="toolbar">
    <button class="chip ${tab==='register'?'active':''}" data-t="register">Risk register</button>
    <button class="chip ${tab==='heatmap'?'active':''}" data-t="heatmap">Heatmap</button>
    <button class="chip ${tab==='controls'?'active':''}" data-t="controls">Control library</button>
    <button class="chip ${tab==='testing'?'active':''}" data-t="testing">Control testing</button>
  </div>
  <div id="body"></div>`;
  c.querySelectorAll('[data-t]').forEach(b=> b.onclick=()=>{ tab=b.dataset.t; renderRisks(c); });
  const body=document.getElementById('body');
  document.getElementById('new').onclick=()=> editRisk(null, domains, emps, ()=>renderRisks(c));
  if(tab==='register') drawRegister(body, risks, controls, docs, domains, emps, ()=>renderRisks(c));
  else if(tab==='heatmap') drawHeatmap(body, risks);
  else if(tab==='testing') drawTesting(body, controls, ()=>renderRisks(c));
  else drawControls(body, controls, risks, emps, ()=>renderRisks(c));
}

function drawRegister(body, risks, controls, docs, domains, emps, refresh){
  body.innerHTML=`<div class="table-wrap"><table><thead><tr>
    <th>ID</th><th>Risk</th><th>Domain</th><th>Category</th><th>Inherent</th><th>Residual</th><th>Treatment</th><th>Owner</th></tr></thead><tbody>
    ${risks.map(r=>`<tr class="clickable" data-id="${r._id}"><td class="mono">${r.id}</td><td><b>${H.esc(r.title)}</b></td>
      <td>${H.esc(r.domainName||r.domain)}</td><td>${H.esc(r.category)}</td>
      <td>${ratingBadge(r.inherent)}</td><td>${ratingBadge(r.residual)}</td><td>${H.esc(r.treatment)}</td><td>${H.esc(r.owner)}</td></tr>`).join('')}
  </tbody></table></div>`;
  body.querySelectorAll('tr[data-id]').forEach(tr=> tr.onclick=()=> openRisk(risks.find(x=>x._id===+tr.dataset.id), controls, docs, domains, emps, refresh));
}

function openRisk(r, controls, docs, domains, emps, refresh){
  const linkedCtl=controls.filter(c=> (r.controlIds||[]).includes(c.id));
  const linkedDocs=docs.filter(d=> (r.linkedDocs||[]).includes(d.id));
  H.modal({title:`${r.id} — ${r.title}`, size:'lg',
    body:`<div class="flex gap wrap" style="margin-bottom:12px">${ratingBadge(r.inherent)} <span class="muted">inherent</span> → ${ratingBadge(r.residual)} <span class="muted">residual</span> <span class="badge b-slate">${H.esc(r.category)}</span></div>
    <div class="jd-grid">
      <div class="card pad" style="box-shadow:none">
        <b>Assessment</b>
        <div class="doc-meta">
          <div class="row"><span class="k">Likelihood (inherent)</span><span>${r.likelihood}/5</span></div>
          <div class="row"><span class="k">Impact (inherent)</span><span>${r.impact}/5</span></div>
          <div class="row"><span class="k">Residual likelihood</span><span>${r.resLikelihood}/5</span></div>
          <div class="row"><span class="k">Residual impact</span><span>${r.resImpact}/5</span></div>
          <div class="row"><span class="k">Treatment</span><span>${H.esc(r.treatment)}</span></div>
          <div class="row"><span class="k">Owner</span><span>${H.esc(r.owner)}</span></div>
        </div>
      </div>
      <div>
        <div class="card pad" style="box-shadow:none"><b>Mitigating controls</b>
          <div style="margin-top:6px">${linkedCtl.map(c=>`<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12.5px"><b>${H.esc(c.title)}</b><div class="muted" style="font-size:11px">${c.type} · ${c.frequency} · ${c.effectiveness}</div></div>`).join('')||'<span class="muted">None linked</span>'}</div></div>
        <div class="card pad" style="box-shadow:none;margin-top:12px"><b>Linked policies</b>
          <div style="margin-top:6px">${linkedDocs.map(d=>`<div class="link" style="padding:4px 0" onclick="location.hash='#/repository/${d.id}'">${H.esc(d.title)}</div>`).join('')||'<span class="muted">None</span>'}</div></div>
      </div>
    </div>`,
    footer:`<button class="btn" id="cx">Close</button><button class="btn danger" id="dl">Delete</button><button class="btn primary" id="ed">Edit</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('ed').onclick=()=> editRisk(r, domains, emps, refresh);
  document.getElementById('dl').onclick=()=> H.confirmDialog(`Delete risk ${r.id}?`, async()=>{ await DB.del('risks',r._id); await logAudit('Deleted risk', r.title,'AAA Holding'); H.toast('Risk deleted'); H.closeModal(); refresh(); });
}

function editRisk(risk, domains, emps, refresh){
  const isNew=!risk; const r=risk||{title:'',domain:domains[0].code,category:'Operational',likelihood:3,impact:3,resLikelihood:2,resImpact:2,treatment:'Mitigate',owner:'',controlIds:[],linkedDocs:[]};
  const sel=(id,v,opts)=>`<select class="input" id="${id}">${opts.map(o=>`<option ${String(o)===String(v)?'selected':''}>${o}</option>`).join('')}</select>`;
  H.modal({title:isNew?'New risk':'Edit risk', size:'lg',
    body:`<div class="field"><label>Risk title</label><input class="input" id="t" value="${H.esc(r.title)}"/></div>
      <div class="field-row">
        <div class="field"><label>Domain</label><select class="input" id="dom">${domains.map(d=>`<option value="${d.code}" ${d.code===r.domain?'selected':''}>${H.esc(d.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Category</label>${sel('cat',r.category,['Operational','Financial','Compliance','Strategic','Health & Safety','Cyber'])}</div>
      </div>
      <div class="field-row">
        <div class="field"><label>Likelihood (1-5)</label>${sel('l',r.likelihood,[1,2,3,4,5])}</div>
        <div class="field"><label>Impact (1-5)</label>${sel('i',r.impact,[1,2,3,4,5])}</div>
      </div>
      <div class="field-row">
        <div class="field"><label>Residual likelihood</label>${sel('rl',r.resLikelihood,[1,2,3,4,5])}</div>
        <div class="field"><label>Residual impact</label>${sel('ri',r.resImpact,[1,2,3,4,5])}</div>
      </div>
      <div class="field-row">
        <div class="field"><label>Treatment</label>${sel('tr',r.treatment,['Mitigate','Accept','Transfer','Avoid'])}</div>
        <div class="field"><label>Owner</label><input class="input" id="ow" list="owlist" value="${H.esc(r.owner)}"/><datalist id="owlist">${[...new Set(emps.map(e=>e.name))].slice(0,60).map(n=>`<option>${H.esc(n)}</option>`).join('')}</datalist></div>
      </div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">${isNew?'Add risk':'Save'}</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  const g=id=>document.getElementById(id).value;
  document.getElementById('sv').onclick=async()=>{
    const l=+g('l'),i=+g('i'),rl=+g('rl'),ri=+g('ri');
    const o={...r,title:g('t').trim(),domain:g('dom'),domainName:domains.find(d=>d.code===g('dom')).name,category:g('cat'),
      likelihood:l,impact:i,inherent:rate(l,i),resLikelihood:rl,resImpact:ri,residual:rate(rl,ri),treatment:g('tr'),owner:g('ow').trim()};
    if(!o.title){ H.toast('Title required'); return; }
    if(isNew){ o.id='RSK-'+String(Math.floor(Math.random()*900)+100); await DB.add('risks',o); } else await DB.put('risks',o);
    await logAudit(isNew?'Added risk':'Updated risk', o.title,'AAA Holding');
    H.toast(isNew?'Risk added':'Risk saved'); H.closeModal(); refresh();
  };
}

function drawHeatmap(body, risks){
  const useRes=true;
  const cell=(l,i)=> risks.filter(r=> (useRes?r.resLikelihood:r.likelihood)===l && (useRes?r.resImpact:r.impact)===i);
  const color=(l,i)=>{ const v=l*i; return v>=15?'#dc2626':v>=9?'#f97316':v>=4?'#f59e0b':'#22c55e'; };
  let html=`<div class="card pad"><p class="muted mt0">Residual risk heatmap (likelihood × impact). Cell colour = risk score; number = risks in that cell.</p>
    <div style="display:flex;gap:10px"><div style="writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;font-size:12px;color:var(--muted);padding:8px 0">Likelihood →</div>
    <div style="flex:1">
    <table style="border-collapse:separate;border-spacing:6px;width:100%">`;
  for(let l=5;l>=1;l--){ html+=`<tr><td style="width:20px;color:var(--muted);font-size:12px">${l}</td>`;
    for(let i=1;i<=5;i++){ const cs=cell(l,i); html+=`<td style="background:${color(l,i)};opacity:${cs.length?1:.28};border-radius:8px;height:56px;text-align:center;color:#fff;font-weight:700;vertical-align:middle" title="${cs.map(x=>x.title).join(', ')}">${cs.length||''}</td>`; }
    html+=`</tr>`; }
  html+=`<tr><td></td>${[1,2,3,4,5].map(i=>`<td style="text-align:center;color:var(--muted);font-size:12px">${i}</td>`).join('')}</tr>
    <tr><td></td><td colspan="5" style="text-align:center;color:var(--muted);font-size:12px">Impact →</td></tr>
    </table></div></div></div>`;
  body.innerHTML=html;
}

function drawControls(body, controls, risks, emps, refresh){
  body.innerHTML=`<div class="table-wrap"><table><thead><tr><th>ID</th><th>Control</th><th>Type</th><th>Frequency</th><th>Effectiveness</th><th>Owner</th><th>Risks</th></tr></thead><tbody>
    ${controls.map(c=>`<tr><td class="mono">${c.id}</td><td><b>${H.esc(c.title)}</b></td><td>${H.esc(c.type)}</td><td>${H.esc(c.frequency)}</td>
      <td><span class="badge ${c.effectiveness==='Effective'?'b-green':c.effectiveness==='Partially Effective'?'b-amber':'b-red'}">${H.esc(c.effectiveness)}</span></td>
      <td>${H.esc(c.owner)}</td><td class="muted">${(c.riskIds||[]).length}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function drawTesting(body, controls, refresh){
  const eff=(v)=>{ const m={Effective:'b-green','Partially Effective':'b-amber','Pass':'b-green','Pass with exceptions':'b-amber','Fail':'b-red','Deficient':'b-red','Not Assessed':'b-slate'}; return `<span class="badge ${m[v]||'b-slate'}">${H.esc(v||'—')}</span>`; };
  const passed=controls.filter(c=>c.testResult==='Pass').length;
  body.innerHTML=`<div class="kpis" style="margin-bottom:14px">
    <div class="stat"><div class="v">${controls.length}</div><div class="l">Controls</div></div>
    <div class="stat"><div class="v" style="color:var(--green)">${passed}</div><div class="l">Tests passed</div></div>
    <div class="stat"><div class="v" style="color:var(--red)">${controls.filter(c=>c.testResult==='Fail').length}</div><div class="l">Failed</div></div>
    <div class="stat"><div class="v" style="color:var(--amber)">${controls.filter(c=>c.designEffectiveness==='Deficient').length}</div><div class="l">Design deficient</div></div>
  </div>
  <div class="table-wrap"><table><thead><tr><th>ID</th><th>Control</th><th>Design</th><th>Operating</th><th>Test result</th><th>Sample</th><th>Last tested</th><th>Next</th>${canEdit()?'<th></th>':''}</tr></thead><tbody>
    ${controls.map(c=>`<tr><td class="mono">${c.id}</td><td><b>${H.esc(c.title)}</b></td><td>${eff(c.designEffectiveness)}</td><td>${eff(c.operatingEffectiveness||c.effectiveness)}</td>
      <td>${eff(c.testResult)}</td><td class="muted">${c.sampleSize||'—'}</td><td>${c.lastTested?H.fmtDate(c.lastTested):'—'}</td><td>${c.nextTest?H.fmtDate(c.nextTest):'—'}</td>
      ${canEdit()?`<td><button class="btn ghost sm rt" data-id="${c._id}">${ICON('check',13)} Record test</button></td>`:''}</tr>`).join('')}
  </tbody></table></div>`;
  body.querySelectorAll('.rt').forEach(b=> b.onclick=()=> recordTest(controls.find(x=>x._id===+b.dataset.id), refresh));
}
function recordTest(c, refresh){
  const sel=(id,cur,opts)=>`<select class="input" id="${id}">${opts.map(o=>`<option ${o===cur?'selected':''}>${o}</option>`).join('')}</select>`;
  H.modal({title:`Record control test — ${c.id}`, body:`
    <div class="field"><label>Design effectiveness</label>${sel('t-des',c.designEffectiveness,['Effective','Deficient','Not Assessed'])}</div>
    <div class="field"><label>Operating effectiveness</label>${sel('t-op',c.operatingEffectiveness||c.effectiveness,['Effective','Partially Effective','Needs Improvement'])}</div>
    <div class="field"><label>Test result</label>${sel('t-res',c.testResult,['Pass','Pass with exceptions','Fail'])}</div>
    <div class="field-row"><div class="field"><label>Sample size</label><input class="input" id="t-samp" type="number" value="${c.sampleSize||10}"/></div>
      <div class="field"><label>Test date</label><input class="input" type="date" id="t-date" value="${(c.lastTested||'2026-07-23').slice(0,10)}"/></div></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save test</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    c.designEffectiveness=document.getElementById('t-des').value; c.operatingEffectiveness=document.getElementById('t-op').value; c.effectiveness=c.operatingEffectiveness;
    c.testResult=document.getElementById('t-res').value; c.sampleSize=+document.getElementById('t-samp').value||0; c.lastTested=document.getElementById('t-date').value;
    await DB.put('controls',c); await logAudit('Recorded control test', c.title,'AAA Holding'); H.toast('Control test recorded'); H.closeModal(); refresh();
  };
}
