import * as DB from '../db.js';
import { H } from '../app.js';

const ROLES=[
  {role:'CEO', scope:'All entities', perms:['View all','Approve any','Publish','Delegate'], count:1},
  {role:'Domain Owner', scope:'Own domain', perms:['View','Edit','Approve stage','Raise CR'], count:13},
  {role:'Process Owner', scope:'Assigned processes', perms:['View','Edit draft','Raise CR'], count:34},
  {role:'Author', scope:'Assigned artifacts', perms:['View','Create draft','Raise CR'], count:52},
  {role:'Approver (Finance)', scope:'Financial controls', perms:['View','Approve financial'], count:6},
  {role:'Risk & Compliance', scope:'All', perms:['View','Comment','Flag risk'], count:4},
  {role:'Viewer', scope:'Published only', perms:['View','Acknowledge'], count:600},
];
export async function renderAccess(c){
  const emps = await DB.getAll('employees');
  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Security</div><h1>Access &amp; Roles</h1>
    <p>Role-based access control (RBAC) governs who can view, edit, approve and publish. ${emps.length} identities mapped from the people master.</p></div></div>
  <div class="table-wrap"><table><thead><tr><th>Role</th><th>Scope</th><th>Permissions</th><th>Identities</th></tr></thead><tbody>
    ${ROLES.map(r=>`<tr><td><b>${r.role}</b></td><td>${r.scope}</td><td>${r.perms.map(p=>`<span class="tag">${p}</span>`).join('')}</td><td class="mono">${r.count}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="section-title">Access model</div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
    <div class="card pad"><b>Segregation of duties</b><p class="muted mb0">Authors cannot approve their own change requests; approval requires a different role in the chain.</p></div>
    <div class="card pad"><b>Least privilege</b><p class="muted mb0">Viewers see only Published artifacts; drafts and superseded versions are restricted to owners.</p></div>
    <div class="card pad"><b>Evidenced actions</b><p class="muted mb0">Every edit, approval and acknowledgment is written to the audit activity log with the signed-in user. A tamper-resistant audit store is planned for the security phase.</p></div>
  </div>`;
}
