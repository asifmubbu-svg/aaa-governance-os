import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { logAudit } from './repository.js';

function audienceOf(camp, emps){
  if(camp.audienceType==='all') return emps;
  if(camp.audienceType==='unit') return emps.filter(e=>e.unit===camp.audienceValue);
  if(camp.audienceType==='department') return emps.filter(e=>e.department===camp.audienceValue);
  return emps;
}

export async function renderCampaigns(c){
  const camps = await DB.getAll('campaigns');
  const emps = await DB.getAll('employees');
  const docs = await DB.getAll('documents');
  const meta = await DB.getMeta();

  const stat=(camp)=>{ const aud=audienceOf(camp,emps); const done=camp.acknowledgedBy.length; return {total:aud.length, done, pct: aud.length?Math.round(done/aud.length*100):0}; };
  const overall=camps.reduce((a,camp)=>{ const s=stat(camp); a.total+=s.total; a.done+=s.done; return a; },{total:0,done:0});

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Workflow</div><h1>Acknowledgement Campaigns</h1>
    <p>Distribute policies for read &amp; acknowledge, and track completion per employee — with reminders for anyone outstanding.</p></div>
    <div class="page-actions"><button class="btn primary" id="new">${ICON('plus')} New campaign</button></div>
  </div>
  <div class="kpis" style="margin-bottom:16px">
    <div class="stat"><div class="v">${camps.length}</div><div class="l">Active campaigns</div></div>
    <div class="stat"><div class="v">${overall.total?Math.round(overall.done/overall.total*100):0}%</div><div class="l">Overall completion</div></div>
    <div class="stat"><div class="v">${overall.total-overall.done}</div><div class="l">Outstanding</div></div>
    <div class="stat"><div class="v">${overall.done}</div><div class="l">Acknowledged</div></div>
  </div>
  <div id="rows"></div>`;

  const draw=()=>{ document.getElementById('rows').innerHTML=`<div class="table-wrap"><table><thead><tr>
    <th>Campaign</th><th>Policy</th><th>Audience</th><th>Due</th><th>Completion</th><th></th></tr></thead><tbody>
    ${camps.map(camp=>{ const s=stat(camp); return `<tr class="clickable" data-id="${camp._id}">
      <td><b>${H.esc(camp.title)}</b><div class="mono muted" style="font-size:11px">${camp.id}</div></td>
      <td>${H.esc(camp.docTitle)}</td>
      <td>${H.esc(camp.audienceType==='all'?'All employees':camp.audienceValue)}<div class="muted" style="font-size:11px">${s.total} people</div></td>
      <td>${H.fmtDate(camp.due)}</td>
      <td style="min-width:160px"><div class="flex center gap"><div class="bar" style="flex:1"><span style="width:${s.pct}%"></span></div><b style="width:64px;text-align:right">${s.pct}% (${s.done}/${s.total})</b></div></td>
      <td>${ICON('eye',15)}</td></tr>`; }).join('')}
  </tbody></table></div>`;
    document.querySelectorAll('#rows tr[data-id]').forEach(tr=> tr.onclick=()=> openCampaign(camps.find(x=>x._id===+tr.dataset.id), emps, ()=>renderCampaigns(c)));
  };
  draw();
  document.getElementById('new').onclick=()=> newCampaign(docs, meta, ()=>renderCampaigns(c));
}

function openCampaign(camp, emps, refresh){
  const aud=audienceOf(camp,emps);
  const done=new Set(camp.acknowledgedBy);
  const pending=aud.filter(e=>!done.has(e.empId));
  H.modal({title:camp.title, size:'lg',
    body:`<div class="flex between center wrap" style="margin-bottom:12px">
      <div class="muted">Policy: <span class="link" onclick="location.hash='#/repository/${camp.docId}'">${H.esc(camp.docTitle)}</span> · Due ${H.fmtDate(camp.due)}</div>
      <span class="badge b-green">${aud.length?Math.round(done.size/aud.length*100):0}% complete</span></div>
    <div class="bar" style="margin-bottom:14px"><span style="width:${aud.length?Math.round(done.size/aud.length*100):0}%"></span></div>
    <div class="flex between center"><b>Outstanding (${pending.length})</b>${pending.length?`<button class="btn sm" id="remind">${ICON('bell',14)} Send reminder to all</button>`:'<span class="badge b-green">All acknowledged</span>'}</div>
    <div class="table-wrap" style="margin-top:8px;max-height:340px;overflow:auto"><table><thead><tr><th>Employee</th><th>Department</th><th>Status</th><th></th></tr></thead><tbody>
      ${aud.slice().sort((a,b)=>(done.has(a.empId)?1:0)-(done.has(b.empId)?1:0)).map(e=>`<tr>
        <td><b>${H.esc(e.name)}</b></td><td>${H.esc(e.department||'—')}</td>
        <td>${done.has(e.empId)?'<span class="badge b-green">Acknowledged</span>':'<span class="badge b-amber">Pending</span>'}</td>
        <td>${done.has(e.empId)?'':`<button class="btn ghost sm mk" data-e="${H.esc(e.empId)}">Mark done</button>`}</td></tr>`).join('')}
    </tbody></table></div>`,
    footer:`<button class="btn" id="cx">Close</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  const rem=document.getElementById('remind');
  if(rem) rem.onclick=async()=>{ await logAudit('Sent acknowledgement reminder', camp.title, 'AAA Holding'); H.toast(`Reminder sent to ${pending.length} employees`); };
  document.querySelectorAll('.modal .mk').forEach(b=> b.onclick=async()=>{
    camp.acknowledgedBy.push(b.dataset.e); await DB.put('campaigns',camp);
    await DB.add('acknowledgments',{docId:camp.docId,user:b.dataset.e,date:new Date().toISOString(),campaign:camp.id});
    await logAudit('Acknowledged policy (campaign)', camp.docTitle,'AAA Holding');
    H.toast('Marked acknowledged'); openCampaign(camp, emps, refresh); refresh();
  });
}

function newCampaign(docs, meta, refresh){
  const ackDocs=docs.filter(d=>d.acknowRequired).concat(docs.filter(d=>!d.acknowRequired));
  H.modal({title:'New acknowledgement campaign',
    body:`<div class="field"><label>Policy / document</label><select class="input" id="doc">${ackDocs.map(d=>`<option value="${d.id}">${H.esc(d.title)}</option>`).join('')}</select></div>
      <div class="field"><label>Audience</label><select class="input" id="atype"><option value="all">All employees</option><option value="unit">By unit</option><option value="department">By department</option></select></div>
      <div class="field" id="avalwrap" style="display:none"><label>Which one</label><select class="input" id="aval"></select></div>
      <div class="field"><label>Due date</label><input class="input" type="date" id="due" value="2026-08-31"/></div>`,
    footer:`<button class="btn" id="cx">Cancel</button><button class="btn primary" id="sv">Launch campaign</button>`});
  document.getElementById('cx').onclick=H.closeModal;
  const atype=document.getElementById('atype'), wrap=document.getElementById('avalwrap'), aval=document.getElementById('aval');
  atype.onchange=()=>{ if(atype.value==='all'){ wrap.style.display='none'; return; } wrap.style.display='block';
    const opts=(atype.value==='unit'?meta.units:meta.departments)||[]; aval.innerHTML=opts.map(o=>`<option>${H.esc(o)}</option>`).join(''); };
  document.getElementById('sv').onclick=async()=>{
    const doc=docs.find(d=>d.id===document.getElementById('doc').value);
    const camp={ id:H.uid('ACK-2026'), title:`Acknowledge: ${doc.title}`, docId:doc.id, docTitle:doc.title,
      audienceType:atype.value, audienceValue: atype.value==='all'?'All employees':aval.value,
      due:document.getElementById('due').value, createdAt:new Date().toISOString().slice(0,10), acknowledgedBy:[] };
    await DB.add('campaigns',camp); await logAudit('Launched acknowledgement campaign', camp.title,'AAA Holding');
    H.toast('Campaign launched'); H.closeModal(); refresh();
  };
}
