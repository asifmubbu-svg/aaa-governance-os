import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

export async function renderSimple(c, key){
  const fn = MAP[key];
  if(fn) return fn(c);
  c.innerHTML=`<div class="empty"><p>Module not found.</p></div>`;
}

const head=(eyebrow,title,desc)=>`<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div></div>`;

async function taxonomy(c){
  const docs=await DB.getAll('documents'); const domains=await DB.getAll('domains');
  c.innerHTML=head('Structure','Taxonomy','How AAA classifies its governance knowledge — by domain and artifact type.')+
  `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">
    ${domains.map(d=>{ const dd=docs.filter(x=>x.domain===d.code); const types={};
      dd.forEach(x=>types[x.type]=(types[x.type]||0)+1);
      return `<div class="card pad"><div class="flex between center"><b>${H.esc(d.name)}</b><span class="mono muted">${d.code}</span></div>
      <div class="bar" style="margin:10px 0"><span style="width:${d.coverage}%"></span></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${Object.entries(types).map(([t,n])=>`<span class="tag">${t} · ${n}</span>`).join('')||'<span class="muted">No artifacts</span>'}</div></div>`;}).join('')}
  </div>`;
}

const FORM_DEFS=[
  {n:'Customer Registration & Credit Application',dom:'Sales & Commercial',fields:[['Customer / trade name','text'],['Commercial Registration (CR) No.','text'],['VAT number','text'],['Billing address','textarea'],['Contact person & phone','text'],['Requested credit limit (SAR)','text'],['Payment terms','select'],['Attachments (CR, VAT cert, bank letter)','file'],['Sales rep','text'],['Credit approval (Finance)','sign']]},
  {n:'Supplier Qualification Questionnaire',dom:'Procurement',fields:[['Supplier legal name','text'],['CR / license number','text'],['Category of supply','select'],['Quality certifications (ISO/HACCP)','text'],['Bank details','textarea'],['References','textarea'],['SFDA registration (if food)','text'],['Assessed by','text']]},
  {n:'Purchase Requisition Form',dom:'Procurement',fields:[['Requesting department','select'],['Item / service description','textarea'],['Quantity','text'],['Estimated value (SAR)','text'],['Budget line','text'],['Needed by date','date'],['Requested by','text'],['HOD approval','sign']]},
  {n:'Non-Conformance Report (NCR)',dom:'Quality & Food Safety',fields:[['NCR number','text'],['Date raised','date'],['Product / process','text'],['Description of non-conformance','textarea'],['Batch / lot','text'],['Severity','select'],['Immediate action taken','textarea'],['Raised by','text'],['QA disposition','select']]},
  {n:'CAPA Request Form',dom:'Quality & Food Safety',fields:[['CAPA number','text'],['Source (NCR/Audit/Complaint)','select'],['Root cause','textarea'],['Corrective action','textarea'],['Preventive action','textarea'],['Owner','text'],['Target date','date'],['Effectiveness check','textarea']]},
  {n:'Leave Application Form',dom:'Human Capital',fields:[['Employee name','text'],['Employee ID','text'],['Leave type','select'],['From date','date'],['To date','date'],['Reason','textarea'],['Handover to','text'],['Manager approval','sign']]},
  {n:'IT Access Request Form',dom:'IT & Analytics',fields:[['Employee name','text'],['System / application','select'],['Access level (RBAC role)','select'],['Business justification','textarea'],['Manager approval','sign'],['IT action','text']]},
  {n:'Change Request Form',dom:'Corporate Governance',fields:[['Artifact affected','text'],['Change type','select'],['Description of change','textarea'],['Reason / driver','textarea'],['Requested by','text'],['HOD approval','sign'],['Executive approval','sign']]},
  {n:'Expense Reimbursement Form',dom:'Finance',fields:[['Employee name','text'],['Cost center','text'],['Expense details','textarea'],['Amount (SAR)','text'],['Receipts attached','file'],['Approved by','sign']]},
];
async function forms(c){
  const docs=await DB.getAll('documents');
  const custom=await DB.getAll('forms');
  const formDocs=docs.filter(d=>d.type==='Form');
  c.innerHTML=head('Templates','Forms','Standardised, controlled forms used across governance processes. Click a form to open it, or build your own.')
    .replace('</div></div>',`</div><div class="page-actions"><button class="btn primary" id="newform">${ICON('plus')} New form</button></div></div>`)+
  `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
    ${custom.map(f=>`<div class="card pad clickable" data-cf="${f._id}" style="cursor:pointer;border-color:var(--green)">
      <span class="badge b-green" style="margin-bottom:8px">Custom form</span>
      <b style="display:block">${H.esc(f.title)}</b>
      <div class="muted" style="font-size:12.5px;margin-top:4px">${H.esc(f.dom||'')} · ${f.fields.length} fields</div></div>`).join('')}
    ${FORM_DEFS.map((f,i)=>`<div class="card pad clickable" data-f="${i}" style="cursor:pointer">
      <span class="badge b-blue" style="margin-bottom:8px">Controlled form</span>
      <b style="display:block">${H.esc(f.n)}</b>
      <div class="muted" style="font-size:12.5px;margin-top:4px">${H.esc(f.dom)} · ${f.fields.length} fields</div>
    </div>`).join('')}
    ${formDocs.map(f=>`<div class="card pad clickable" data-id="${f.id}" style="cursor:pointer"><span class="badge b-slate" style="margin-bottom:8px">${H.esc(f.type)}</span><b style="display:block">${H.esc(f.title)}</b><div class="muted" style="font-size:12.5px;margin-top:4px">${H.esc(f.domainName)}</div></div>`).join('')}
  </div>`;
  c.querySelectorAll('[data-f]').forEach(el=> el.onclick=()=> showForm(FORM_DEFS[+el.dataset.f]));
  c.querySelectorAll('[data-cf]').forEach(el=> el.onclick=()=>{ const f=custom.find(x=>x._id===+el.dataset.cf); showForm({n:f.title,dom:f.dom,fields:f.fields}, f); });
  c.querySelectorAll('[data-id]').forEach(el=> el.onclick=()=> location.hash='#/repository/'+el.dataset.id);
  document.getElementById('newform').onclick=()=> buildForm(()=>renderSimple(c,'forms'));
}

const FIELD_TYPES=['text','textarea','select','date','file','sign'];
function buildForm(refresh, existing){
  let fields = existing ? existing.fields.map(f=>[...f]) : [['Field 1','text']];
  const fieldRow=(f,i)=>`<tr data-i="${i}"><td><input class="input fl" value="${H.esc(f[0])}" style="min-width:180px"/></td>
    <td><select class="input ft">${FIELD_TYPES.map(t=>`<option ${t===f[1]?'selected':''}>${t}</option>`).join('')}</select></td>
    <td><button class="btn ghost sm rm">${ICON('trash',14)}</button></td></tr>`;
  const collect=()=>{ fields=[...document.querySelectorAll('#ff tr')].map(tr=>[tr.querySelector('.fl').value, tr.querySelector('.ft').value]); };
  const drawFields=()=>{ document.getElementById('ff').innerHTML=fields.map(fieldRow).join(''); document.querySelectorAll('#ff .rm').forEach(b=> b.onclick=()=>{ collect(); fields.splice(+b.closest('tr').dataset.i,1); drawFields(); }); };
  H.modal({title:existing?'Edit form':'Build a form', size:'lg',
    body:`<div class="field-row"><div class="field"><label>Form title</label><input class="input" id="ftitle" value="${H.esc(existing?.title||'')}"/></div>
      <div class="field"><label>Domain / area</label><input class="input" id="fdom" value="${H.esc(existing?.dom||'')}"/></div></div>
      <div class="field"><label>Fields</label><div class="table-wrap"><table><thead><tr><th>Label</th><th>Type</th><th></th></tr></thead><tbody id="ff"></tbody></table></div>
      <button class="btn sm" id="addf" style="margin-top:8px">${ICON('plus',14)} Add field</button></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Save form</button>`});
  drawFields();
  document.getElementById('addf').onclick=()=>{ collect(); fields.push(['New field','text']); drawFields(); };
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('sv').onclick=async()=>{
    collect(); const title=document.getElementById('ftitle').value.trim();
    if(!title){ H.toast('Form title required'); return; }
    const obj={ title, dom:document.getElementById('fdom').value.trim(), fields:fields.filter(f=>f[0].trim()) };
    if(existing){ obj._id=existing._id; await DB.put('forms',obj); } else await DB.add('forms',obj);
    await logAudit(existing?'Updated form':'Created form', title,'AAA Holding');
    H.toast('Form saved'); H.closeModal(); refresh();
  };
}
function showForm(f){
  const inputFor=(label,type)=>{
    if(type==='textarea') return `<textarea class="input" placeholder="${H.esc(label)}"></textarea>`;
    if(type==='select') return `<select class="input"><option value="">Select…</option><option>Option A</option><option>Option B</option></select>`;
    if(type==='date') return `<input class="input" type="date"/>`;
    if(type==='file') return `<input class="input" type="file"/>`;
    if(type==='sign') return `<div style="border:1px dashed var(--border);border-radius:8px;padding:14px;text-align:center;color:var(--muted);font-size:12px">Signature / approval</div>`;
    return `<input class="input" placeholder="${H.esc(label)}"/>`;
  };
  H.modal({title:f.n, size:'lg',
    body:`<div class="muted" style="margin-top:0;font-size:12.5px">${H.esc(f.dom)} · controlled form template</div>
      <div style="margin-top:14px">${f.fields.map(([label,type])=>`<div class="field"><label>${H.esc(label)}</label>${inputFor(label,type)}</div>`).join('')}</div>`,
    footer:`<button class="btn" id="cx">Close</button><button class="btn" id="pr">${ICON('download',14)} Print / save</button><button class="btn primary" id="sub">Submit</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  document.getElementById('pr').onclick=()=>window.print();
  document.getElementById('sub').onclick=()=>{ H.toast('Form submitted (demo)'); H.closeModal(); };
}

async function raci(c){
  const rows=await DB.getAll('raci'); const meta=await DB.getMeta(); const roles=meta.raciRoles||[];
  const legend={R:'Responsible',A:'Accountable',C:'Consulted',I:'Informed'};
  c.innerHTML=head('Accountability · Knowledge Base','RACI Matrix (by role)','Role-based responsibility mapping for each governed process. Built with standard methodology: the people performing the process steps are Responsible, the Process Owner is Accountable, experts and stakeholders are Consulted, and everyone above is Informed.')+
  `<div class="flex gap wrap" style="margin-bottom:12px">${Object.entries(legend).map(([k,v])=>{const b={R:'b-green',A:'b-red',C:'b-amber',I:'b-blue'}[k];return `<span class="badge ${b}"><b>${k}</b>&nbsp;${v}</span>`;}).join('')}</div>
  <div class="table-wrap"><table><thead><tr><th>Process</th>${roles.map(r=>`<th>${H.esc(r)}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(row=>`<tr>${row.docId?`<td><span class="link" onclick="location.hash='#/repository/${row.docId}'">${H.esc(row.process)}</span></td>`:`<td><b>${H.esc(row.process)}</b></td>`}${roles.map(r=>{const v=row.assignments[r]||'-';const b={R:'b-green',A:'b-red',C:'b-amber',I:'b-blue'}[v]||'';return `<td>${v==='-'?'<span class="muted">–</span>':`<span class="badge ${b}">${v}</span>`}</td>`;}).join('')}</tr>`).join('')}
  </tbody></table></div>`;
}

async function capabilities(c){
  const caps=await DB.getAll('capabilities'); const domains=await DB.getAll('domains');
  const byDom={}; caps.forEach(x=>(byDom[x.domain]=byDom[x.domain]||[]).push(x));
  c.innerHTML=head('Operating Model','Capabilities','Documented business capabilities and their governance maturity by domain.')+
  `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">
    ${domains.map(d=>`<div class="card pad"><div class="flex between center"><b>${H.esc(d.name)}</b><span class="badge ${d.risk==='High'?'b-red':d.risk==='Medium'?'b-amber':'b-green'}">${d.risk}</span></div>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
      ${(byDom[d.code]||[]).map(cap=>`<div><div class="flex between" style="font-size:12.5px"><span>${H.esc(cap.name.split('—')[1]||cap.name)}</span><span class="muted">${cap.maturity}</span></div><div class="bar"><span style="width:${cap.coverage}%"></span></div></div>`).join('')}
      </div></div>`).join('')}
  </div>`;
}

async function opportunities(c){
  const opps=await DB.getAll('opportunities');
  let f='';
  c.innerHTML=head('Continuous Improvement','Opportunities',`${opps.length} improvement opportunities identified across domains, scored by impact and effort.`)+
  `<div class="toolbar">${['','Open','In Review','Planned'].map(s=>`<button class="chip ${s===''?'active':''}" data-s="${s}">${s||'All'}</button>`).join('')}</div><div id="rows"></div>`;
  const draw=()=>{ let list=opps.filter(o=>!f||o.status===f);
    document.getElementById('rows').innerHTML=`<div class="table-wrap"><table><thead><tr><th>ID</th><th>Opportunity</th><th>Domain</th><th>Impact</th><th>Effort</th><th>Status</th></tr></thead><tbody>
    ${list.map(o=>`<tr><td class="mono">${o.id}</td><td><b>${H.esc(o.title)}</b></td><td>${o.domain}</td>
      <td><span class="badge ${o.impact==='High'?'b-green':o.impact==='Medium'?'b-amber':'b-slate'}">${o.impact}</span></td>
      <td><span class="badge ${o.effort==='Low'?'b-green':o.effort==='Medium'?'b-amber':'b-red'}">${o.effort}</span></td>
      <td>${H.statusBadge(o.status)}</td></tr>`).join('')}</tbody></table></div>`; };
  c.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{f=b.dataset.s;c.querySelectorAll('[data-s]').forEach(x=>x.classList.toggle('active',x===b));draw();});
  draw();
}

async function announcements(c){
  const list=(await DB.getAll('announcements')).sort((a,b)=>new Date(b.date)-new Date(a.date));
  c.innerHTML=head('Communications','Announcements','Governance communications across AAA entities.')
    .replace('</div></div>',`</div><div class="page-actions"><button class="btn primary" id="new">${ICON('plus')} New announcement</button></div></div>`)+
  `<div id="list" class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">
    ${list.map(a=>`<div class="card pad"><span class="badge b-green" style="margin-bottom:8px">${H.esc(a.domain)}</span>
      <b>${H.esc(a.title)}</b><p class="muted" style="font-size:13px;margin:6px 0">${H.esc(a.body)}</p>
      <div class="muted" style="font-size:11.5px">${H.fmtDate(a.date)}</div></div>`).join('')}
  </div>`;
  document.getElementById('new').onclick=()=>{
    H.modal({title:'New announcement', body:`<div class="field"><label>Title</label><input class="input" id="t"/></div>
      <div class="field"><label>Domain / audience</label><input class="input" id="d" value="All AAA entities"/></div>
      <div class="field"><label>Message</label><textarea class="input" id="b"></textarea></div>`,
      footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Publish</button>`});
    document.getElementById('cx').onclick=H.closeModal;
    document.getElementById('sv').onclick=async()=>{ const t=document.getElementById('t').value.trim(); if(!t){H.toast('Title required');return;}
      await DB.add('announcements',{title:t,domain:document.getElementById('d').value.trim()||'All AAA entities',body:document.getElementById('b').value.trim(),date:new Date().toISOString()});
      await logAudit('Published announcement',t,'AAA Holding'); H.toast('Announcement published'); H.closeModal(); renderSimple(c,'announcements'); };
  };
}

async function knowledgeGraph(c){
  const domains=await DB.getAll('domains'); const docs=await DB.getAll('documents');
  const W=880,Hh=520,cx=W/2,cy=Hh/2;
  const nodes=domains.map((d,i)=>{const a=(i/domains.length)*2*Math.PI;return{...d,x:cx+Math.cos(a)*300,y:cy+Math.sin(a)*210};});
  c.innerHTML=head('Intelligence','Knowledge Graph','A relationship view of domains and their governance artifacts. Node size reflects artifact volume. <span class="badge b-amber">Demonstration view</span> — to be replaced by the interactive relationship explorer (upstream/downstream dependencies and impact analysis).')+
  `<div class="card pad" style="overflow:auto"><svg viewBox="0 0 ${W} ${Hh}" style="width:100%;min-width:700px">
    ${nodes.map(n=>`<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="var(--border)" stroke-width="1.5"/>`).join('')}
    <circle cx="${cx}" cy="${cy}" r="42" fill="var(--green)"/>
    <text x="${cx}" y="${cy-2}" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">AAA</text>
    <text x="${cx}" y="${cy+14}" text-anchor="middle" fill="#fff" font-size="9">Governance</text>
    ${nodes.map(n=>{const cnt=docs.filter(x=>x.domain===n.code).length;const r=16+cnt;return `
      <circle cx="${n.x}" cy="${n.y}" r="${Math.min(r,34)}" fill="var(--surface)" stroke="var(--green)" stroke-width="2"/>
      <text x="${n.x}" y="${n.y+3}" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="700">${n.code}</text>
      <text x="${n.x}" y="${n.y+ (n.y>cy?46:-40)}" text-anchor="middle" fill="var(--muted)" font-size="10">${H.esc(n.name)} (${cnt})</text>`;}).join('')}
  </svg></div>`;
}

async function impact(c){
  const docs=await DB.getAll('documents'); const raci=await DB.getAll('raci'); const crs=await DB.getAll('changeRequests');
  c.innerHTML=head('Intelligence','Impact Analysis','Select an artifact to see what a change would affect — related documents, accountable roles and open change requests.')+
  `<div class="toolbar"><select class="input" id="pick" style="min-width:340px"><option value="">Select an artifact…</option>${docs.map(d=>`<option value="${d.id}">${H.esc(d.id)} — ${H.esc(d.title)}</option>`).join('')}</select></div>
  <div id="out"></div>`;
  document.getElementById('pick').onchange=(e)=>{
    const d=docs.find(x=>x.id===e.target.value); const out=document.getElementById('out'); if(!d){out.innerHTML='';return;}
    const related=docs.filter(x=>x.domain===d.domain && x.id!==d.id).slice(0,6);
    const rr=raci.find(r=>r.process===d.title);
    const cr=crs.filter(x=>x.docId===d.id);
    out.innerHTML=`<div class="two-col">
      <div class="card pad"><b>Related artifacts (same domain)</b>
        <div style="margin-top:8px">${related.map(x=>`<div class="flex between" style="padding:7px 0;border-bottom:1px solid var(--border)"><span class="link" onclick="location.hash='#/repository/${x.id}'">${H.esc(x.title)}</span>${H.statusBadge(x.status)}</div>`).join('')||'<span class="muted">None</span>'}</div></div>
      <div><div class="card pad"><b>Accountable roles</b>
        <div style="margin-top:8px">${rr?Object.entries(rr.assignments).filter(([k,v])=>v!=='-'&&v!=='I').map(([k,v])=>`<div class="flex between" style="padding:6px 0"><span>${k}</span><span class="badge b-slate">${v}</span></div>`).join(''):'<span class="muted">No RACI mapped</span>'}</div></div>
      <div class="card pad" style="margin-top:14px"><b>Open change requests</b><div style="margin-top:8px">${cr.length?cr.map(x=>`<div class="mono" style="font-size:12px">${x.id} · ${x.status}</div>`).join(''):'<span class="muted">None</span>'}</div></div></div>
    </div>`;
  };
}

async function audit(c){
  const events=(await DB.getAll('auditEvents')).sort((a,b)=>new Date(b.date)-new Date(a.date));
  let q='';
  c.innerHTML=head('Assurance','Audit Activity',`${events.length} recorded governance events — timestamped and attributable. A tamper-resistant (immutable) audit store is planned for the security phase.`)+
  `<div class="toolbar"><input class="input" id="q" placeholder="Filter by actor, action or artifact…" style="min-width:280px"/></div><div id="rows"></div>`;
  const draw=()=>{ const list=events.filter(e=>!q||(e.actor+e.action+e.target).toLowerCase().includes(q));
    document.getElementById('rows').innerHTML=`<div class="table-wrap"><table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Artifact</th><th>Entity</th></tr></thead><tbody>
    ${list.slice(0,120).map(e=>`<tr><td class="muted" style="white-space:nowrap">${H.fmtDate(e.date)}</td><td><b>${H.esc(e.actor)}</b></td><td>${H.esc(e.action)}</td><td>${H.esc(e.target)}</td><td class="muted">${H.esc(e.entity||'')}</td></tr>`).join('')}
  </tbody></table></div>`; };
  document.getElementById('q').oninput=e=>{q=e.target.value.toLowerCase();draw();}; draw();
}

const MAP={taxonomy,forms,raci,capabilities,opportunities,announcements,'knowledge-graph':knowledgeGraph,'impact-analysis':impact,audit};
