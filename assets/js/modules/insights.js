import * as DB from '../db.js';
import { H } from '../app.js';

export async function renderInsights(c){
  const domains = await DB.getAll('domains');
  const docs = await DB.getAll('documents');
  const crs = await DB.getAll('changeRequests');
  const opps = await DB.getAll('opportunities');
  const weak=[...domains].sort((a,b)=>a.coverage-b.coverage).slice(0,3);
  const strong=[...domains].sort((a,b)=>b.maturity-a.maturity)[0];
  const highRisk=domains.filter(d=>d.risk==='High');
  const pending=crs.filter(x=>x.status==='Submitted').length;

  const insights=[
    {t:`${weak.length} domains are under-governed`, b:`${weak.map(d=>d.name).join(', ')} sit below 65% coverage — concentrate remediation here to lift the group score fastest.`, sev:'High'},
    {t:`${strong.name} is your governance benchmark`, b:`Highest maturity at ${strong.maturity}% — replicate its control patterns across weaker domains.`, sev:'Positive'},
    {t:`${highRisk.length} domains carry High risk`, b:`${highRisk.map(d=>d.name).join(', ')} combine elevated risk with incomplete documentation — prioritise for executive review.`, sev:'High'},
    {t:`${pending} change requests awaiting approval`, b:`Clear the approvals queue to keep cycle time within the standard-route SLA.`, sev:'Medium'},
    {t:`${docs.filter(d=>d.status==='Active').length} artifacts are Active`, b:`${docs.filter(d=>d.status==='Draft').length} remain in draft — moving these to Active would raise effective coverage.`, sev:'Medium'},
    {t:`${opps.filter(o=>o.status==='Open').length} open improvement opportunities`, b:`Automating approval routing and adding read-and-acknowledge are the highest-impact quick wins.`, sev:'Medium'},
  ];
  const sevb={High:'b-red',Medium:'b-amber',Positive:'b-green'};
  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Executive Insights</div><h1>Insights</h1>
    <p>Automated observations across coverage, risk, maturity and workflow, derived from the current records. <span class="badge b-amber">Demonstration data</span> — coverage/maturity scores are seeded examples and are excluded from production reporting until validated.</p></div></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">
    ${insights.map((x,i)=>`<div class="card pad"><div class="flex between center" style="margin-bottom:8px"><span class="badge ${sevb[x.sev]}">${x.sev}</span><span class="mono muted">S${i+1}</span></div>
      <b>${H.esc(x.t)}</b><p class="muted mb0" style="margin-top:6px">${H.esc(x.b)}</p></div>`).join('')}
  </div>`;
}
