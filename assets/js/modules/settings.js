import * as DB from '../db.js';
import { H, state } from '../app.js';

export async function renderSettings(c){
  const s = await DB.getSettings();
  const counts = {};
  for(const st of ['employees','documents','changeRequests','approvals','auditEvents']) counts[st]=(await DB.getAll(st)).length;

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">System</div><h1>Settings</h1>
    <p>Configure appearance, AI connection and data. All data is stored locally in your browser (IndexedDB) and never leaves your machine unless you connect a model.</p></div></div>

  <div class="two-col">
    <div class="card pad">
      <b>AI Assistant connection</b>
      <p class="muted" style="font-size:12.5px">Optional. Add an API key to connect a live model for richer answers. Without a key, the assistant runs in grounded local mode over your repository.</p>
      <div class="field"><label>Provider</label><select class="input" id="prov">
        <option value="anthropic" ${s.aiProvider==='anthropic'?'selected':''}>Anthropic (Claude)</option>
        <option value="openai" ${s.aiProvider==='openai'?'selected':''}>OpenAI</option>
        <option value="bedrock" ${s.aiProvider==='bedrock'?'selected':''}>AWS Bedrock</option>
      </select></div>
      <div class="field"><label>API key</label><input class="input" id="key" type="password" placeholder="sk-… (stored locally only)" value="${H.esc(s.aiKey||'')}"/></div>
      <button class="btn primary" id="save-ai">Save connection</button>
    </div>
    <div class="card pad">
      <b>Data</b>
      <div class="doc-meta" style="margin-top:8px">
        ${Object.entries(counts).map(([k,v])=>`<div class="row"><span class="k">${k}</span><b>${v}</b></div>`).join('')}
      </div>
      <div class="flex gap wrap" style="margin-top:14px">
        <button class="btn" id="export">Export all data (JSON)</button>
        <button class="btn danger" id="reset">Reset to seed data</button>
      </div>
      <p class="muted" style="font-size:11.5px;margin-top:8px">Reset restores the original real employee data and seeded governance content, discarding your edits.</p>
    </div>
  </div>

  <div class="card pad" style="margin-top:16px">
    <b>Appearance</b>
    <div class="flex gap wrap" style="margin-top:10px">
      <button class="btn" id="theme">Theme: ${s.theme==='dark'?'Dark':'Light'}</button>
      <button class="btn" id="lang">Language: ${s.lang==='ar'?'العربية (RTL)':'English'}</button>
    </div>
  </div>`;

  document.getElementById('save-ai').onclick=async()=>{
    s.aiProvider=document.getElementById('prov').value; s.aiKey=document.getElementById('key').value.trim();
    await DB.saveSettings(s); state.settings=s; H.toast(s.aiKey?'AI connection saved':'Saved — running in local mode');
  };
  document.getElementById('export').onclick=async()=>{
    const dump={}; for(const st of DB.STORES) dump[st]=await DB.getAll(st);
    const blob=new Blob([JSON.stringify(dump,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='governance-os-export.json'; a.click();
    H.toast('Exported');
  };
  document.getElementById('reset').onclick=()=> H.confirmDialog('Reset all data to the original seed? Your edits will be lost.', async()=>{ await DB.resetAll(); H.toast('Data reset'); location.hash='#/'; location.reload(); });
  document.getElementById('theme').onclick=async()=>{ s.theme=s.theme==='dark'?'light':'dark'; document.documentElement.setAttribute('data-theme',s.theme); state.settings=s; await DB.saveSettings(s); renderSettings(c); };
  document.getElementById('lang').onclick=async()=>{ s.lang=s.lang==='ar'?'en':'ar'; document.documentElement.setAttribute('dir',s.lang==='ar'?'rtl':'ltr'); document.documentElement.setAttribute('lang',s.lang); state.settings=s; await DB.saveSettings(s); renderSettings(c); };
}
