import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';

export async function renderDashboard(c){
  const [docs, emps, domains, entities, crs, audit, anns] = await Promise.all([
    DB.getAll('documents'), DB.getAll('employees'), DB.getAll('domains'),
    DB.getAll('entities'), DB.getAll('changeRequests'), DB.getAll('auditEvents'), DB.getAll('announcements')
  ]);
  const byStatus = s=> docs.filter(d=>d.status===s).length;
  const coverage = Math.round(domains.reduce((a,d)=>a+d.coverage,0)/domains.length);
  const pending = crs.filter(x=>x.status==='Submitted').length;
  const overdue = docs.filter(d=> new Date(d.reviewDate) < new Date('2026-07-23')).length;
  const upcoming = [...docs].filter(d=> new Date(d.reviewDate) >= new Date('2026-07-23'))
    .sort((a,b)=> new Date(a.reviewDate)-new Date(b.reviewDate)).slice(0,6);
  const recentAudit = [...audit].sort((a,b)=> new Date(b.date)-new Date(a.date)).slice(0,7);
  const trend=[58,61,63,66,69,coverage];

  c.innerHTML = `
  <div class="page-head">
    <div>
      <div class="eyebrow">Governance Health</div>
      <h1>Governance Command Center</h1>
      <p>A real-time, board-ready view of how AAA documents, owns and governs its operating knowledge across ${entities.length} entities and ${domains.length} domains.</p>
    </div>
    <div class="page-actions">
      <a class="btn" href="#/insights">${ICON('spark')} AI Insights</a>
      <a class="btn primary" href="#/assistant">${ICON('chat')} Ask AI</a>
    </div>
  </div>

  <div class="kpis" style="margin-bottom:8px">
    ${kpi(emps.length,'Employees')}
    ${kpi(entities.length,'Entities')}
    ${kpi(new Set(emps.map(e=>e.department)).size,'Departments')}
    ${kpi(docs.length,'Artifacts')}
    ${kpi(new Set(emps.map(e=>e.location)).size,'Locations')}
    ${kpi(new Set(emps.map(e=>e.title)).size,'Job Titles')}
  </div>

  <div class="grid" style="grid-template-columns:repeat(4,1fr);margin:16px 0">
    ${stat('Governance Coverage', coverage+'%', `<span class="up">+6.0%</span> vs last quarter`)}
    ${stat('Governance Artifacts', docs.length, `${byStatus('Active')} active · ${byStatus('Approved')} approved`)}
    ${stat('Pending Approvals', pending, `${crs.filter(x=>x.status==='Draft').length} drafts open`)}
    ${stat('Overdue Reviews', overdue, `across ${domains.length} domains`)}
  </div>

  <div class="two-col">
    <div class="card pad">
      <div class="flex between center"><b>Coverage by domain</b><a class="link" href="#/capabilities">View</a></div>
      <div style="margin-top:14px;display:flex;flex-direction:column;gap:9px">
        ${[...domains].sort((a,b)=>b.coverage-a.coverage).map(d=>`
          <div class="flex center gap">
            <span class="mono" style="width:44px">${d.code}</span>
            <div class="bar" style="flex:1"><span style="width:${d.coverage}%"></span></div>
            <b style="width:40px;text-align:right">${d.coverage}%</b>
          </div>`).join('')}
      </div>
    </div>
    <div class="card pad">
      <b>Documentation coverage trend</b>
      <div class="muted" style="font-size:12px;margin-bottom:8px">Last 6 months · +${coverage-trend[0]} pts</div>
      <div class="spark">${trend.map(v=>`<div class="b" style="height:${v}%" title="${v}%"></div>`).join('')}</div>
      <div class="flex between muted" style="font-size:11px;margin-top:6px"><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span></div>
      <div style="margin-top:16px">
        <b>Documents by status</b>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
          ${['Draft','Review','Approved','Active','Superseded','Archived'].map(s=>`<div class="flex center gap">${H.statusBadge(s)}<b>${byStatus(s)}</b></div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <div class="two-col" style="margin-top:16px">
    <div class="card pad">
      <div class="flex between center"><b>Recent governance activity</b><a class="link" href="#/audit">View all</a></div>
      <div style="margin-top:10px">
        ${recentAudit.map(a=>`<div class="flex center gap" style="padding:9px 0;border-bottom:1px solid var(--border)">
          <div class="avatar" style="width:32px;height:32px;font-size:11px">${H.initials(a.actor)}</div>
          <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px">${H.esc(a.actor)}</div>
          <div class="muted" style="font-size:12px">${H.esc(a.action)} · ${H.esc(a.target)}</div></div>
          <div class="muted" style="font-size:11.5px">${H.fmtDate(a.date)}</div></div>`).join('')}
      </div>
    </div>
    <div class="card pad">
      <div class="flex between center"><b>Upcoming reviews</b><a class="link" href="#/version-control">View all</a></div>
      <div style="margin-top:10px">
        ${upcoming.map(d=>`<div class="flex center gap clickable" style="padding:9px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="location.hash='#/repository/${d.id}'">
          <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:13px">${H.esc(d.title)}</div>
          <div class="muted mono" style="font-size:11.5px">${d.id} · ${H.esc(d.domainName)}</div></div>
          <div class="badge b-amber">${H.fmtDate(d.reviewDate)}</div></div>`).join('')}
      </div>
    </div>
  </div>

  <div class="card pad" style="margin-top:16px">
    <div class="flex between center"><b>Recent announcements</b><a class="link" href="#/announcements">View all</a></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:12px">
      ${anns.slice(0,4).map(a=>`<div class="card pad" style="box-shadow:none">
        <div class="badge b-green" style="margin-bottom:8px">${H.esc(a.domain)}</div>
        <div style="font-weight:600">${H.esc(a.title)}</div>
        <div class="muted" style="font-size:12px;margin-top:4px">${H.fmtDate(a.date)}</div></div>`).join('')}
    </div>
  </div>`;
}

const kpi=(v,l)=>`<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`;
const stat=(l,v,s)=>`<div class="stat"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
