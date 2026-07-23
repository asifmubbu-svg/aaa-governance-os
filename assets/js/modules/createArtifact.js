import * as DB from '../db.js';
import { H } from '../app.js';
import { ICON } from '../icons.js';
import { createArtifact } from './repository.js';

const canCreate = ()=> ({Author:2,HOD:3,Executive:4,Admin:5}[(DB.getCurrentUser&&DB.getCurrentUser()?.role)]||0) >= 2;
const TYPE_ICON = {
  Policy:'shield', Standard:'layers', 'Delegation of Authority':'key', Charter:'award', Framework:'grid',
  Process:'flow', Procedure:'flow', SOP:'form', 'Work Instruction':'edit', Manual:'book', Guideline:'book',
  Register:'table', Form:'form', Checklist:'check', Plan:'target', Program:'target', 'Job Description':'user',
};

export async function renderCreateArtifact(c){
  const config = await DB.getConfig();
  const docs = await DB.getAll('documents');
  const types = (config.documentTypes||[]);
  const countOf = (k)=> docs.filter(d=>d.type===k).length;
  const editable = canCreate();

  c.innerHTML=`
  <div class="page-head"><div><div class="eyebrow">Document & Process Management</div><h1>Create Artifact</h1>
    <p>Pick a document type to start a new controlled artifact. It opens in Draft with the type's standard sections, numbering and review period, then routes for approval.${editable?'':' <b>Read-only</b> — you need Author role or above to create.'}</p></div>
    <div class="page-actions"><a class="btn" href="#/repository">${ICON('book')} Open Repository</a></div>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
    ${types.map(t=>`<div class="card pad create-tile ${editable?'':'disabled'}" data-t="${H.esc(t.key)}" style="cursor:${editable?'pointer':'default'}">
      <div class="flex between center" style="margin-bottom:10px"><div class="tile-ic">${ICON(TYPE_ICON[t.key]||'book',20)}</div><span class="mono muted">${H.esc(t.prefix)}</span></div>
      <b style="display:block;font-size:14px">${H.esc(t.key)}</b>
      <div class="muted" style="font-size:12px;margin-top:4px">${(t.sections||[]).length} sections · review ${t.reviewMonths}m · ${countOf(t.key)} existing</div>
      ${editable?`<div class="link" style="margin-top:8px;font-size:12.5px">+ New ${H.esc(t.key)}</div>`:''}
    </div>`).join('')}
  </div>`;
  if(editable) c.querySelectorAll('.create-tile').forEach(el=> el.onclick=()=> createArtifact(el.dataset.t));
}
