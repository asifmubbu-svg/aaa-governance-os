import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';

const TODAY = new Date('2026-07-23');
let tab='lifecycle';

export async function renderReports(c){
  const [docs, reqs, risks, controls, finds, positions, camps, emps] = await Promise.all([
    DB.getAll('documents'), DB.getAll('requirements').catch(()=>[]), DB.getAll('risks').catch(()=>[]),
    DB.getAll('controls').catch(()=>[]), DB.getAll('findings').catch(()=>[]), DB.getAll('positions').catch(()=>[]),
    DB.getAll('campaigns').catch(()=>[]), DB.getAll('employees')
  ]);
  const D={docs,reqs,risks,controls,finds,positions,camps,emps};
  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Intelligence & Reporting</div><h1>Dashboards</h1>
    <p>Calculated from live records — not seeded scores. Click a figure to drill into the source module.</p></div>
    <div class="page-actions"><button class="btn" id="csv">${ICON('download')} Export CSV</button><button class="btn" onclick="window.print()">Print</button></div>
  </div>
  <div class="toolbar">
    ${[['lifecycle','Document lifecycle'],['compliance','Compliance'],['risk','Risk & controls'],['assurance','Assurance'],['workforce','Workforce']].map(([k,l])=>`<button class="chip ${tab===k?'active':''}" data-t="${k}">${l}</button>`).join('')}
  </div>
  <div id="rbody"></div>`;
  c.querySelectorAll('[data-t]').forEach(b=> b.onclick=()=>{ tab=b.dataset.t; renderReports(c); });
  document.getElementById('csv').onclick=()=> exportCSV(D);
  const body=document.getElementById('rbody');
  ({lifecycle:drawLifecycle,compliance:drawCompliance,risk:drawRisk,assurance:drawAssurance,workforce:drawWorkforce}[tab])(body, D);
  body.querySelectorAll('[data-h]').forEach(el=> el.onclick=()=> location.hash=el.dataset.h);
}

const stat=(v,l,color,hash)=>`<div class="stat clickable" ${hash?`data-h="${hash}" style="cursor:pointer"`:''}><div class="v" ${color?`style="color:${color}"`:''}>${v}</div><div class="l">${l}</div></div>`;
const barRow=(label,val,max,hash)=>`<div class="flex center gap ${hash?'clickable':''}" ${hash?`data-h="${hash}" style="cursor:pointer;padding:5px 0"`:'style="padding:5px 0"'}><span style="flex:1;font-size:12.5px">${H.esc(label)}</span><div class="bar" style="width:160px"><span style="width:${max?Math.round(val/max*100):0}%"></span></div><b style="width:34px;text-align:right">${val}</b></div>`;

function drawLifecycle(body, {docs}){
  const statuses=['Draft','Released','Active','Superseded','Archived','Rejected','Withdrawn'];
  const by=s=>docs.filter(d=>d.status===s).length;
  const overdue=docs.filter(d=>d.status==='Active'&&new Date(d.reviewDate)<TODAY).length;
  const inAppr=docs.filter(d=>d.status==='Released').length;
  const withVersions=docs.filter(d=>(d.major||0)>=1).length;
  const max=Math.max(...statuses.map(by),1);
  body.innerHTML=`<div class="kpis" style="margin-bottom:16px">
    ${stat(docs.length,'Total artifacts',null,'#/repository')}
    ${stat(by('Active'),'Active','var(--green)','#/repository')}
    ${stat(inAppr,'In approval','var(--amber)','#/approvals')}
    ${stat(overdue,'Overdue reviews','var(--red)','#/version-control')}
  </div>
  <div class="two-col">
    <div class="card pad"><b>Documents by status</b><div style="margin-top:8px">${statuses.map(s=>barRow(s,by(s),max,'#/repository')).join('')}</div></div>
    <div class="card pad"><b>Lifecycle health</b><div class="doc-meta" style="margin-top:8px">
      <div class="row"><span class="k">Approved & effective (v1.0+)</span><b>${withVersions}</b></div>
      <div class="row"><span class="k">Requiring acknowledgement</span><b>${docs.filter(d=>d.acknowRequired).length}</b></div>
      <div class="row"><span class="k">Superseded</span><b>${by('Superseded')}</b></div>
      <div class="row"><span class="k">Rejected / withdrawn</span><b>${by('Rejected')+by('Withdrawn')}</b></div>
    </div></div>
  </div>`;
}
function drawCompliance(body, {reqs}){
  const by=s=>reqs.filter(r=>r.complianceStatus===s).length;
  const cov=reqs.length?Math.round(by('Compliant')/reqs.length*100):0;
  const doms={}; reqs.forEach(r=>{ doms[r.domain]=(doms[r.domain]||{c:0,t:0}); doms[r.domain].t++; if(r.complianceStatus==='Compliant')doms[r.domain].c++; });
  body.innerHTML=`<div class="kpis" style="margin-bottom:16px">
    ${stat(reqs.length,'Requirements',null,'#/requirements')}
    ${stat(cov+'%','Compliance coverage','var(--green)','#/requirements')}
    ${stat(by('Partial'),'Partial','var(--amber)','#/requirements')}
    ${stat(by('Gap'),'Gaps','var(--red)','#/requirements')}
  </div>
  <div class="card pad"><b>Compliance by domain</b><div style="margin-top:8px">${Object.entries(doms).map(([d,x])=>barRow(d+' — '+Math.round(x.c/x.t*100)+'%',x.c,x.t)).join('')||'<span class="muted">No data</span>'}</div></div>`;
}
function drawRisk(body, {risks,controls}){
  const band=b=>risks.filter(r=>r.residual===b).length;
  const passed=controls.filter(c=>c.testResult==='Pass').length;
  const rate=controls.length?Math.round(passed/controls.length*100):0;
  body.innerHTML=`<div class="kpis" style="margin-bottom:16px">
    ${stat(risks.length,'Risks',null,'#/risks')}
    ${stat(band('Critical')+band('High'),'High / Critical (residual)','var(--red)','#/risks')}
    ${stat(controls.length,'Controls',null,'#/risks')}
    ${stat(rate+'%','Control test pass rate','var(--green)','#/risks')}
  </div>
  <div class="two-col">
    <div class="card pad"><b>Residual risk distribution</b><div style="margin-top:8px">${['Critical','High','Medium','Low'].map(b=>barRow(b,band(b),Math.max(...['Critical','High','Medium','Low'].map(band),1),'#/risks')).join('')}</div></div>
    <div class="card pad"><b>Control effectiveness</b><div class="doc-meta" style="margin-top:8px">
      <div class="row"><span class="k">Effective (operating)</span><b>${controls.filter(c=>(c.operatingEffectiveness||c.effectiveness)==='Effective').length}</b></div>
      <div class="row"><span class="k">Design deficient</span><b>${controls.filter(c=>c.designEffectiveness==='Deficient').length}</b></div>
      <div class="row"><span class="k">Failed tests</span><b>${controls.filter(c=>c.testResult==='Fail').length}</b></div>
    </div></div>
  </div>`;
}
function drawAssurance(body, {finds}){
  const by=s=>finds.filter(f=>f.status===s).length;
  const overdue=finds.filter(f=>f.status!=='Closed'&&new Date(f.dueDate)<TODAY).length;
  const sev=s=>finds.filter(f=>f.severity===s).length;
  body.innerHTML=`<div class="kpis" style="margin-bottom:16px">
    ${stat(finds.length,'Findings & CAPA',null,'#/audit-capa')}
    ${stat(overdue,'Overdue','var(--red)','#/audit-capa')}
    ${stat(by('Closed'),'Closed','var(--green)','#/audit-capa')}
    ${stat(sev('High'),'High severity','var(--amber)','#/audit-capa')}
  </div>
  <div class="two-col">
    <div class="card pad"><b>By status</b><div style="margin-top:8px">${['Open','In Progress','Closed','Overdue'].map(s=>barRow(s,by(s),Math.max(...['Open','In Progress','Closed','Overdue'].map(by),1),'#/audit-capa')).join('')}</div></div>
    <div class="card pad"><b>By type</b><div class="doc-meta" style="margin-top:8px"><div class="row"><span class="k">Audit findings</span><b>${finds.filter(f=>f.type==='Audit Finding').length}</b></div><div class="row"><span class="k">CAPA actions</span><b>${finds.filter(f=>f.type==='CAPA').length}</b></div></div></div>
  </div>`;
}
function drawWorkforce(body, {positions,emps}){
  const filled=positions.filter(p=>p.status!=='Vacant').length, vacant=positions.filter(p=>p.status==='Vacant').length;
  const crit=positions.filter(p=>p.critical).length, critVac=positions.filter(p=>p.critical&&p.status==='Vacant').length;
  body.innerHTML=`<div class="kpis" style="margin-bottom:16px">
    ${stat(emps.length,'Employees',null,'#/organization')}
    ${stat(positions.length,'Positions',null,'#/positions')}
    ${stat(vacant,'Vacant','var(--amber)','#/positions')}
    ${stat(critVac,'Critical vacant','var(--red)','#/positions')}
  </div>
  <div class="card pad"><b>Positions</b><div style="margin-top:8px">${barRow('Filled',filled,positions.length,'#/positions')}${barRow('Vacant',vacant,positions.length,'#/positions')}${barRow('Critical roles',crit,positions.length,'#/positions')}</div></div>`;
}

function exportCSV(D){
  const rows=[['Metric','Value']];
  rows.push(['Total artifacts',D.docs.length],['Active',D.docs.filter(d=>d.status==='Active').length],['In approval',D.docs.filter(d=>d.status==='Released').length],
    ['Overdue reviews',D.docs.filter(d=>d.status==='Active'&&new Date(d.reviewDate)<TODAY).length],
    ['Requirements',D.reqs.length],['Compliance gaps',D.reqs.filter(r=>r.complianceStatus==='Gap').length],
    ['Risks',D.risks.length],['High/Critical residual',D.risks.filter(r=>['High','Critical'].includes(r.residual)).length],
    ['Controls',D.controls.length],['Failed control tests',D.controls.filter(c=>c.testResult==='Fail').length],
    ['Findings & CAPA',D.finds.length],['Overdue findings',D.finds.filter(f=>f.status!=='Closed'&&new Date(f.dueDate)<TODAY).length],
    ['Positions',D.positions.length],['Vacant positions',D.positions.filter(p=>p.status==='Vacant').length],
    ['Employees',D.emps.length]);
  const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='governance-dashboard.csv'; a.click();
  H.toast('Dashboard exported');
}
