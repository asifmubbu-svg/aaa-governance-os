import { H } from '../app.js';

const DATA=[
 {cat:'Policy & GRC',
  platforms:['NAVEX One (PolicyTech)','MetricStream','LogicGate Risk Cloud','Diligent One','AuditBoard','Workiva','ServiceNow GRC','OneTrust','Archer','VComply','PowerDMS'],
  features:[
   ['Read & acknowledge / attestation tracking','Adopted'],
   ['Configurable multi-stage workflow (submit / approve / return / reject / request-changes)','Adopted'],
   ['Version history with immutable snapshots + redline compare + rollback','Adopted'],
   ['Controlled-copy watermark & change justification','Adopted'],
   ['Conflict-of-interest / self-approval prevention','Adopted'],
   ['Automated review / expiry scheduling','Adopted'],
   ['Audit activity log & evidence (tamper-resistant store planned)','Adopted'],
   ['Central notifications & task inbox (approvals, reviews, actions, expiries)','Adopted'],
   ['Cross-entity global search','Adopted'],
   ['Relationship explorer & impact analysis (upstream/downstream)','Adopted'],
   ['Calculated dashboards with drill-down & CSV export','Adopted'],
   ['Acknowledgement campaigns with reminders','Adopted'],
   ['Policy ↔ risk ↔ control linkage & registers','Adopted'],
   ['No-code workflow / form builder','Adopted'],
   ['Auditor evidence export packs (PDF)','Adopted'],
   ['Requirements library (laws / ISO / internal / contractual) with mapping','Adopted'],
   ['Enterprise risk register with inherent/residual & heatmap','Adopted'],
   ['Control library + control testing (design & operating effectiveness)','Adopted'],
   ['Audit & CAPA management (findings, root cause, corrective/preventive)','Adopted'],
   ['Evidence-request campaigns','Adopted'],
   ['Regulatory change mapping','Adopted'],
   ['Compliance training library tie-in','Adopted'],
  ]},
 {cat:'Business Process Management',
  platforms:['Nintex Process Manager (Promapp)','SAP Signavio','Bizagi','Gluu','Software AG ARIS','Lucidchart','Pipefy'],
  features:[
   ['Drag-and-drop graphical process designer (nodes, connectors, zoom, export)','Adopted'],
   ['Process hierarchy L0-L5 (value chain to transactions)','Adopted'],
   ['Auto-generate RACI from process roles','Adopted'],
   ['Step-level role, employee & department links','Adopted'],
   ['Structured Delegation of Authority module (thresholds, joint authority, lookup)','Adopted'],
   ['Process ownership, versioning & reviews','Adopted'],
   ['Swimlane / role-lane view','Adopted'],
   ['Link forms, systems & risks to each step','Adopted'],
   ['BPMN-style modelling with validation & path simulation','Adopted'],
   ['AI process capture / auto-documentation','Future'],
  ]},
 {cat:'Org Chart & Workforce Design',
  platforms:['ChartHop','Pingboard (Workleap)','Orgvue','Functionly','The Org','Creately'],
  features:[
   ['Interactive org chart from people master','Adopted'],
   ['Entity + departmental structure views','Adopted'],
   ['Rich employee directory with search & filters','Adopted'],
   ['Position management (position vs employee, vacant / acting)','Adopted'],
   ['Position-based org chart with succession & critical roles','Adopted'],
   ['Budgeted-vs-filled headcount by grade & department','Adopted'],
   ['Span-of-control & org-layers analysis','Adopted'],
   ['Scenario / what-if org planning','Adopted'],
   ['HRIS / SAP sync (framework + employee sync)','Partial'],
  ]},
 {cat:'Job Descriptions & Competency',
  platforms:['JDXpert','HRSG CompetencyCore','SAP SuccessFactors','Workday','BambooHR'],
  features:[
   ['Structured JD templates (purpose, RL, responsibilities, quals)','Adopted'],
   ['Job profiles with assigned employees','Adopted'],
   ['Responsibilities library by role','Adopted'],
   ['Job families / grades / bands','Adopted'],
   ['Decision rights & career path per grade','Adopted'],
   ['Competency framework mapped to roles','Adopted'],
   ['Employee JD acknowledgement','Adopted'],
   ['JD approval & version control','Adopted'],
  ]},
];

const badge=(s)=>{ const m={Adopted:'b-green',Partial:'b-amber',Planned:'b-blue',Future:'b-slate'}; return `<span class="badge ${m[s]||'b-slate'}">${s}</span>`; };

export async function renderBenchmarks(c){
  const all=DATA.flatMap(d=>d.features);
  const adopted=all.filter(f=>f[1]==='Adopted').length;
  const planned=all.filter(f=>f[1]==='Planned').length;
  const future=all.filter(f=>f[1]==='Future').length;

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Intelligence</div><h1>Industry Benchmarks</h1>
    <p>How Governance OS compares to leading platforms across policy/GRC, process management, org design and job descriptions — and what's already adopted vs on the roadmap.</p></div></div>
  <div class="kpis" style="margin-bottom:18px">
    <div class="stat"><div class="v">${all.length}</div><div class="l">Benchmarked features</div></div>
    <div class="stat"><div class="v" style="color:var(--green)">${adopted}</div><div class="l">Adopted</div></div>
    <div class="stat"><div class="v">${planned}</div><div class="l">Planned</div></div>
    <div class="stat"><div class="v">${future}</div><div class="l">Future</div></div>
  </div>
  ${DATA.map(d=>`
    <div class="card pad" style="margin-bottom:16px">
      <div class="flex between center wrap"><b style="font-size:15px">${H.esc(d.cat)}</b>
        <div class="muted" style="font-size:12px">${d.features.filter(f=>f[1]==='Adopted').length}/${d.features.length} adopted</div></div>
      <div style="margin:10px 0 12px;display:flex;flex-wrap:wrap;gap:5px">${d.platforms.map(p=>`<span class="tag">${H.esc(p)}</span>`).join('')}</div>
      <div class="table-wrap"><table><thead><tr><th>Feature</th><th style="width:120px">Status</th></tr></thead><tbody>
        ${d.features.map(f=>`<tr><td>${H.esc(f[0])}</td><td>${badge(f[1])}</td></tr>`).join('')}
      </tbody></table></div>
    </div>`).join('')}`;
}
