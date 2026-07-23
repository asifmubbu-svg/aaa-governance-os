import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';

const SOURCES = [
  { coll:'documents', type:'Document', icon:'book', fields:['id','title','type','domainName'], label:d=>d.title, sub:d=>`${d.id} · ${d.type} · ${d.status}`, hash:d=>'#/repository/'+d.id },
  { coll:'processes', type:'Process', icon:'flow', fields:['id','name','purpose','owner'], label:p=>p.name, sub:p=>`${p.level} · ${p.id}`, hash:()=> '#/process-arch' },
  { coll:'employees', type:'Person', icon:'user', fields:['name','title','email','department'], label:e=>e.name, sub:e=>`${e.title||''} · ${e.department||''}`, hash:()=> '#/organization' },
  { coll:'positions', type:'Position', icon:'org', fields:['id','title','department','grade'], label:p=>p.title, sub:p=>`${p.id} · ${p.status}`, hash:()=> '#/positions' },
  { coll:'risks', type:'Risk', icon:'alert', fields:['id','title','category','owner'], label:r=>r.title, sub:r=>`${r.id} · residual ${r.residual}`, hash:()=> '#/risks' },
  { coll:'controls', type:'Control', icon:'shield', fields:['id','title','type','owner'], label:c=>c.title, sub:c=>`${c.id} · ${c.type}`, hash:()=> '#/risks' },
  { coll:'requirements', type:'Requirement', icon:'book', fields:['id','title','source','type'], label:r=>r.title, sub:r=>`${r.id} · ${r.source}`, hash:()=> '#/requirements' },
  { coll:'doa', type:'Delegation of Authority', icon:'key', fields:['id','transactionType','role','approver','category'], label:d=>d.transactionType, sub:d=>`${d.id} · ${d.role} · approver ${d.approver}`, hash:()=> '#/doa' },
  { coll:'findings', type:'Audit / CAPA', icon:'check', fields:['id','title','owner','domain'], label:f=>f.title, sub:f=>`${f.id} · ${f.status}`, hash:()=> '#/audit-capa' },
];

export async function renderSearch(c){
  const data = {};
  await Promise.all(SOURCES.map(async s=>{ data[s.coll] = await DB.getAll(s.coll).catch(()=>[]); }));
  const q0 = sessionStorage.getItem('q')||''; sessionStorage.removeItem('q');

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Intelligence & Reporting</div><h1>Search</h1>
    <p>Search across documents, processes, people, positions, risks, controls, requirements, delegations of authority and audit findings.</p></div></div>
  <div class="toolbar"><div class="search" style="flex:1;max-width:560px"><span class="si">${ICON('search')}</span>
    <input class="input" id="gq" placeholder="Search everything…" value="${H.esc(q0)}" style="width:100%;padding-left:34px"/></div>
    <span class="muted" id="count"></span></div>
  <div id="results"></div>`;

  const gq=document.getElementById('gq');
  const draw=()=>{
    const q=gq.value.trim().toLowerCase();
    const out=document.getElementById('results');
    if(!q){ out.innerHTML=`<div class="empty"><div class="ic">🔎</div><p>Type to search across the whole portal.</p></div>`; document.getElementById('count').textContent=''; return; }
    let total=0;
    const groups = SOURCES.map(s=>{
      const hits = (data[s.coll]||[]).filter(r=> s.fields.some(f=> String(r[f]||'').toLowerCase().includes(q))).slice(0,20);
      total += hits.length; return { s, hits };
    }).filter(g=>g.hits.length);
    document.getElementById('count').textContent = `${total} result${total!==1?'s':''}`;
    out.innerHTML = groups.length ? groups.map(g=>`<div class="card pad" style="margin-bottom:12px">
      <div class="flex center gap" style="margin-bottom:6px">${ICON(g.s.icon,16)}<b>${H.esc(g.s.type)}</b><span class="muted" style="font-size:12px">(${g.hits.length})</span></div>
      ${g.hits.map(r=>`<div class="flex between center clickable" data-h="${g.s.hash(r)}" style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer">
        <div><b style="font-size:13px">${H.esc(g.s.label(r))}</b><div class="muted" style="font-size:11.5px">${H.esc(g.s.sub(r))}</div></div>${ICON('eye',15)}</div>`).join('')}
    </div>`).join('') : `<div class="empty"><div class="ic">🤷</div><p>No matches for “${H.esc(q)}”.</p></div>`;
    out.querySelectorAll('[data-h]').forEach(el=> el.onclick=()=> location.hash=el.dataset.h);
  };
  gq.oninput=draw; draw(); gq.focus();
}
