import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';

const SUGGEST=[
  'What is the current governance health of the organization?',
  'Which domains are under-governed?',
  'Show me all overdue policy reviews',
  'What is our procurement approval authority?',
  'Which policies require acknowledgment?',
];
let history=[];

export async function renderAssistant(c){
  const docs = await DB.getAll('documents');
  const domains = await DB.getAll('domains');
  const emps = await DB.getAll('employees');
  const settings = await DB.getSettings();

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Intelligence & Reporting</div><h1>Governance Smart Search</h1>
    <p>Ask questions in plain language. Answers are retrieved from your live repository, org data and domains, and every answer cites its sources. This is grounded search over your records; a model-powered assistant will be enabled when a private AI endpoint is connected.</p></div>
    <div class="page-actions"><span class="badge ${settings.aiKey?'b-green':'b-amber'}">${settings.aiKey?'Model endpoint connected':'Grounded search (no external AI)'}</span></div>
  </div>
  <div class="card pad">
    <div class="chat">
      <div class="chat-msgs" id="msgs">
        ${history.length?history.map(renderMsg).join(''):`<div class="msg ai">Hello Asif. I can answer questions about AAA's policies, SOPs, domains, approvals and people. Try one of the prompts below.</div>`}
      </div>
      <div class="suggest">${SUGGEST.map(s=>`<button class="s">${H.esc(s)}</button>`).join('')}</div>
      <div class="chat-input">
        <input class="input" id="q" placeholder="Ask about governance, policies, people…"/>
        <button class="btn primary" id="send">${ICON('send',16)} Ask</button>
      </div>
      ${settings.aiKey?'':`<div class="muted" style="font-size:11.5px;margin-top:8px">Running in grounded local mode (no API key). Add a key in Settings to connect a live model for richer answers.</div>`}
    </div>
  </div>`;

  const ctx={docs,domains,emps};
  const send=async()=>{
    const q=document.getElementById('q').value.trim(); if(!q) return;
    document.getElementById('q').value='';
    history.push({role:'user',text:q});
    const ans=answer(q, ctx);
    history.push({role:'ai',text:ans.text,cites:ans.cites});
    document.getElementById('msgs').innerHTML=history.map(renderMsg).join('');
    const m=document.getElementById('msgs'); m.scrollTop=m.scrollHeight;
  };
  document.getElementById('send').onclick=send;
  document.getElementById('q').onkeydown=e=>{ if(e.key==='Enter') send(); };
  c.querySelectorAll('.suggest .s').forEach(b=> b.onclick=()=>{ document.getElementById('q').value=b.textContent; send(); });
}

const renderMsg=(m)=> m.role==='user'
  ? `<div class="msg user">${H.esc(m.text)}</div>`
  : `<div class="msg ai">${m.text}${m.cites&&m.cites.length?`<div class="cite">Sources: ${m.cites.map(x=>`<span class="link" onclick="location.hash='#/repository/${x.id}'">${x.id}</span>`).join(', ')}</div>`:''}</div>`;

// ---- grounded local answer engine ----
function answer(q, {docs,domains,emps}){
  const ql=q.toLowerCase();
  // health / coverage
  if(/health|coverage|governed|maturity/.test(ql)){
    const cov=Math.round(domains.reduce((a,d)=>a+d.coverage,0)/domains.length);
    const weak=[...domains].sort((a,b)=>a.coverage-b.coverage).slice(0,3);
    const strong=[...domains].sort((a,b)=>b.maturity-a.maturity)[0];
    return {text:`Overall governance coverage is <b>${cov}%</b> across ${domains.length} domains. The strongest is <b>${strong.name}</b> (${strong.maturity}% maturity). The most under-governed are ${weak.map(d=>`<b>${d.name}</b> (${d.coverage}%)`).join(', ')} — prioritise remediation there to lift the group score fastest.`, cites:docs.filter(d=>weak.some(w=>w.code===d.domain)).slice(0,3)};
  }
  if(/overdue|review/.test(ql)){
    const od=docs.filter(d=> new Date(d.reviewDate) < new Date('2026-07-23'));
    return {text:`There are <b>${od.length}</b> artifacts past their review date. The oldest are: ${od.slice(0,4).map(d=>`<b>${d.title}</b> (due ${H.fmtDate(d.reviewDate)})`).join('; ')}. Open Version Control to action these.`, cites:od.slice(0,4)};
  }
  if(/acknowledg|attest|read/.test(ql)){
    const ack=docs.filter(d=>d.acknowRequired);
    return {text:`<b>${ack.length}</b> artifacts require read &amp; acknowledge, mostly policies, standards and delegations of authority. Examples: ${ack.slice(0,4).map(d=>`<b>${d.title}</b>`).join(', ')}.`, cites:ack.slice(0,4)};
  }
  if(/approval|authority|delegation|doa|procure/.test(ql)){
    const doa=docs.filter(d=>/authority|delegation|procure/i.test(d.title));
    return {text:`Approval authority is governed by the Delegation of Authority set and domain manuals. Relevant artifacts: ${doa.slice(0,4).map(d=>`<b>${d.title}</b>`).join(', ')||'the Procurement Governance Manual'}. Each defines the approver by role and financial threshold.`, cites:doa.slice(0,4)};
  }
  // people lookup
  const person=emps.find(e=> ql.includes(e.name.toLowerCase().split(' ')[0]) && e.name.split(' ')[0].length>3);
  if(/who|owner|manager|head of|responsible/.test(ql) || person){
    if(person) return {text:`<b>${person.name}</b> is ${person.title||'—'} in ${person.department||person.unit}${person.location?`, based at ${person.location}`:''}. Contact: ${person.email||'—'}.`, cites:[]};
    const mgr=emps.filter(e=>/manager|director|head|chief/i.test(e.title||'')).slice(0,5);
    return {text:`Here are relevant owners: ${mgr.map(e=>`<b>${e.name}</b> (${e.title})`).join('; ')}.`, cites:[]};
  }
  // keyword search over docs
  const hits=docs.map(d=>({d,score:score(d,ql)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
  if(hits.length){
    const top=hits[0].d;
    const purpose=(top.sections||[]).find(s=>/purpose/i.test(s.heading));
    return {text:`I found ${hits.length} relevant artifact${hits.length>1?'s':''}. The most relevant is <b>${top.title}</b> (${top.domainName}). ${purpose?H.esc(purpose.body.slice(0,220))+'…':''}`, cites:hits.map(h=>h.d)};
  }
  return {text:`I couldn't find a direct match in the repository. Try rephrasing, or browse the <span class="link" onclick="location.hash='#/repository'">Repository</span>. You can also ask about governance health, overdue reviews, approval authority, or a person's role.`, cites:[]};
}
function score(d,ql){
  let s=0; const terms=ql.split(/\W+/).filter(w=>w.length>3);
  const hay=(d.title+' '+d.domainName+' '+(d.tags||[]).join(' ')+' '+(d.sections||[]).map(x=>x.heading).join(' ')).toLowerCase();
  terms.forEach(t=>{ if(hay.includes(t)) s+=hay.indexOf(t)<d.title.length?3:1; });
  return s;
}
