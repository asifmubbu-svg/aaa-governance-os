import { H } from '../app.js';
import { ICON } from '../icons.js';

const NW = 156, NH = 56;
const TYPE_COLORS = {
  start:'#067139', end:'#067139', task:'#2563eb', decision:'#d97706',
  system:'#7c3aed', approval:'#0ea5e9', manual:'#64748b', subprocess:'#0f766e',
  event:'#0891b2', gateway:'#d97706',
};
// BPMN-style palette: start/end events, task, subprocess, exclusive (decision) and
// parallel (gateway) gateways, intermediate event, plus system/manual/approval task kinds.
const TYPES = ['start','task','decision','gateway','event','approval','system','manual','subprocess','end'];

function centerTrim(a, b){
  // line from a-center to b-center, trimmed to node borders (approx box)
  const ax=a.x+NW/2, ay=a.y+NH/2, bx=b.x+NW/2, by=b.y+NH/2;
  const dx=bx-ax, dy=by-ay; const len=Math.hypot(dx,dy)||1;
  const ux=dx/len, uy=dy/len;
  const tA = Math.min(Math.abs((NW/2)/(ux||1e-6)), Math.abs((NH/2)/(uy||1e-6)));
  const tB = Math.min(Math.abs((NW/2)/(ux||1e-6)), Math.abs((NH/2)/(uy||1e-6)));
  return { x1:ax+ux*tA, y1:ay+uy*tA, x2:bx-ux*tB, y2:by-uy*tB };
}

function nodeMarkup(n, selId){
  const c = TYPE_COLORS[n.type] || '#2563eb';
  const sel = selId===n.id;
  const meta = [n.dept, n.role, n.system].filter(Boolean).join(' · ');
  let shape;
  if(n.type==='decision'||n.type==='gateway'){
    const cx=n.x+NW/2, cy=n.y+NH/2;
    const glyph = n.type==='gateway' ? `<text x="${cx}" y="${cy-14}" text-anchor="middle" font-size="15" font-weight="700" fill="${c}">+</text>` : `<text x="${cx}" y="${cy-13}" text-anchor="middle" font-size="14" font-weight="700" fill="${c}">×</text>`;
    shape=`<polygon points="${cx},${n.y-6} ${n.x+NW+6},${cy} ${cx},${n.y+NH+6} ${n.x-6},${cy}" fill="var(--surface)" stroke="${c}" stroke-width="${sel?3:2}"/>${glyph}`;
  } else if(n.type==='start'||n.type==='end'||n.type==='event'){
    const cx=n.x+NW/2, cy=n.y+NH/2; const rx=NW/2, ry=NH/2;
    const dbl = n.type==='event' ? `<ellipse cx="${cx}" cy="${cy}" rx="${rx-4}" ry="${ry-4}" fill="none" stroke="${c}" stroke-width="1.4"/>` : '';
    shape=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="color-mix(in srgb,${c} 10%,var(--surface))" stroke="${c}" stroke-width="${sel?3:2}"/>${dbl}`;
  } else {
    shape=`<rect x="${n.x}" y="${n.y}" width="${NW}" height="${NH}" rx="10" fill="var(--surface)" stroke="${c}" stroke-width="${sel?3:2}"/>`;
  }
  return `<g class="cv-node" data-id="${n.id}" style="cursor:grab">
    ${shape}
    <text x="${n.x+NW/2}" y="${n.y+(meta?NH/2-2:NH/2+4)}" text-anchor="middle" font-size="12.5" font-weight="600" fill="var(--text)">${H.esc((n.label||'').slice(0,26))}</text>
    ${meta?`<text x="${n.x+NW/2}" y="${n.y+NH/2+13}" text-anchor="middle" font-size="10" fill="var(--muted)">${H.esc(meta.slice(0,30))}</text>`:''}
  </g>`;
}
function edgeMarkup(e, nodes, selId){
  const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to); if(!a||!b) return '';
  const t=centerTrim(a,b); const sel=selId===e.id;
  const mx=(t.x1+t.x2)/2, my=(t.y1+t.y2)/2;
  return `<g class="cv-edge" data-id="${e.id}" style="cursor:pointer">
    <line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="${sel?'#067139':'var(--muted-2)'}" stroke-width="${sel?2.5:1.6}" marker-end="url(#arrow)"/>
    ${e.label?`<rect x="${mx-16}" y="${my-9}" width="32" height="16" rx="8" fill="var(--surface)"/><text x="${mx}" y="${my+3}" text-anchor="middle" font-size="10" fill="var(--amber)">${H.esc(e.label)}</text>`:''}
  </g>`;
}
function svgInner(nodes, edges, selId){
  return `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted-2)"/></marker></defs>
    ${edges.map(e=>edgeMarkup(e,nodes,selId)).join('')}
    ${nodes.map(n=>nodeMarkup(n,selId)).join('')}`;
}

// read-only render for record views
export function renderCanvasSVG(canvas){
  const nodes=(canvas&&canvas.nodes)||[], edges=(canvas&&canvas.edges)||[];
  if(!nodes.length) return `<div class="empty" style="padding:24px"><div class="ic">🗺️</div><p>No diagram yet. Use “Open designer”.</p></div>`;
  const maxX=Math.max(...nodes.map(n=>n.x+NW+40),400), maxY=Math.max(...nodes.map(n=>n.y+NH+40),260);
  return `<div style="overflow:auto"><svg viewBox="0 0 ${maxX} ${maxY}" style="width:100%;min-width:${Math.min(maxX,900)}px;background:var(--surface-2);border-radius:10px">${svgInner(nodes,edges,null)}</svg></div>`;
}

// interactive editor
export function openCanvasEditor(initial, onSave){
  const canvas = JSON.parse(JSON.stringify(initial && initial.nodes ? initial : { nodes:[], edges:[] }));
  let sel=null, connectFrom=null, zoom=1, panX=20, panY=20, drag=null, panning=null, seq=canvas.nodes.length;
  H.modal({ title:'Process designer', size:'lg', body:`
    <div class="cv-toolbar">
      ${TYPES.map(t=>`<button class="chip cv-add" data-t="${t}">+ ${t}</button>`).join('')}
      <span style="flex:1"></span>
      <button class="btn ghost sm" id="cv-connect">Connect</button>
      <button class="btn ghost sm" id="cv-del">Delete</button>
      <button class="btn ghost sm" id="cv-zin">+</button><button class="btn ghost sm" id="cv-zout">−</button><button class="btn ghost sm" id="cv-fit">Fit</button>
      <button class="btn ghost sm" id="cv-sim">Validate</button>
      <button class="btn ghost sm" id="cv-export">Export SVG</button>
    </div>
    <div id="cv-hint" class="muted" style="font-size:11.5px;margin:6px 0">Drag nodes to move. Click Connect then two nodes to link. Double-click a node to edit. Drag the background to pan.</div>
    <div id="cv-wrap" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface-2);height:440px">
      <svg id="cv-svg" width="100%" height="440" style="display:block;touch-action:none"></svg>
    </div>`,
    footer:`<button class="btn" id="cv-cancel">Cancel</button><button class="btn primary" id="cv-save">Save diagram</button>` });

  const svg=document.getElementById('cv-svg'), hint=document.getElementById('cv-hint');
  const draw=()=>{ svg.innerHTML=`<g transform="translate(${panX},${panY}) scale(${zoom})">${svgInner(canvas.nodes,canvas.edges,sel&&sel.id)}</g>`; bind(); };
  const pt=(ev)=>{ const r=svg.getBoundingClientRect(); return { x:(ev.clientX-r.left-panX)/zoom, y:(ev.clientY-r.top-panY)/zoom }; };
  function bind(){
    svg.querySelectorAll('.cv-node').forEach(g=>{
      g.addEventListener('mousedown',(ev)=>{ ev.stopPropagation(); const id=g.dataset.id;
        if(connectFrom!==null){ if(connectFrom&&connectFrom!==id){ canvas.edges.push({id:'e'+Math.random().toString(36).slice(2,6),from:connectFrom,to:id,label:''}); } connectFrom=null; document.getElementById('cv-connect').classList.remove('active'); sel={type:'node',id}; draw(); return; }
        sel={type:'node',id}; const n=canvas.nodes.find(x=>x.id===id); const p=pt(ev); drag={id,dx:p.x-n.x,dy:p.y-n.y}; draw();
      });
      g.addEventListener('dblclick',(ev)=>{ ev.stopPropagation(); editNode(canvas.nodes.find(x=>x.id===g.dataset.id)); });
    });
    svg.querySelectorAll('.cv-edge').forEach(g=> g.addEventListener('mousedown',(ev)=>{ ev.stopPropagation(); sel={type:'edge',id:g.dataset.id}; draw(); }));
  }
  svg.addEventListener('mousedown',(ev)=>{ if(connectFrom!==null){ connectFrom=null; document.getElementById('cv-connect').classList.remove('active'); } sel=null; panning={x:ev.clientX-panX,y:ev.clientY-panY}; draw(); });
  svg.addEventListener('mousemove',(ev)=>{ if(drag){ const p=pt(ev); const n=canvas.nodes.find(x=>x.id===drag.id); n.x=Math.round(p.x-drag.dx); n.y=Math.round(p.y-drag.dy); draw(); } else if(panning){ panX=ev.clientX-panning.x; panY=ev.clientY-panning.y; draw(); } });
  const stop=()=>{ drag=null; panning=null; }; svg.addEventListener('mouseup',stop); svg.addEventListener('mouseleave',stop);
  svg.addEventListener('wheel',(ev)=>{ ev.preventDefault(); zoom=Math.min(2.2,Math.max(0.4, zoom*(ev.deltaY<0?1.1:0.9))); draw(); },{passive:false});

  document.querySelectorAll('.cv-add').forEach(b=> b.onclick=()=>{ const t=b.dataset.t; const id='n'+(++seq)+Math.random().toString(36).slice(2,4); canvas.nodes.push({id,type:t,label:t.charAt(0).toUpperCase()+t.slice(1),x:Math.round((60-panX)/zoom)+ (canvas.nodes.length%5)*30, y:Math.round((60-panY)/zoom)+ (canvas.nodes.length%5)*30, role:'',dept:''}); sel={type:'node',id}; draw(); editNode(canvas.nodes.find(n=>n.id===id)); });
  document.getElementById('cv-connect').onclick=(e)=>{ const on=e.target.classList.toggle('active'); connectFrom= on ? (sel&&sel.type==='node'?sel.id:'') : null; hint.textContent= on?'Click the source node, then the target node.':'Drag nodes to move. Double-click to edit.'; };
  document.getElementById('cv-del').onclick=()=>{ if(!sel) return; if(sel.type==='node'){ canvas.nodes=canvas.nodes.filter(n=>n.id!==sel.id); canvas.edges=canvas.edges.filter(e=>e.from!==sel.id&&e.to!==sel.id); } else { canvas.edges=canvas.edges.filter(e=>e.id!==sel.id); } sel=null; draw(); };
  document.getElementById('cv-zin').onclick=()=>{ zoom=Math.min(2.2,zoom*1.15); draw(); };
  document.getElementById('cv-zout').onclick=()=>{ zoom=Math.max(0.4,zoom/1.15); draw(); };
  document.getElementById('cv-fit').onclick=()=>{ zoom=1; panX=20; panY=20; draw(); };
  document.getElementById('cv-export').onclick=()=>{ const maxX=Math.max(...canvas.nodes.map(n=>n.x+NW+40),400), maxY=Math.max(...canvas.nodes.map(n=>n.y+NH+40),260); const s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxX} ${maxY}">${svgInner(canvas.nodes,canvas.edges,null)}</svg>`; const blob=new Blob([s],{type:'image/svg+xml'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='process-diagram.svg'; a.click(); };
  document.getElementById('cv-sim').onclick=()=> simulate(canvas, ()=> openCanvasEditor(canvas, onSave));
  document.getElementById('cv-cancel').onclick=H.closeModal;
  document.getElementById('cv-save').onclick=()=>{ H.closeModal(); onSave(canvas); };

  function editNode(n){ if(!n) return;
    H.modal({title:'Edit node', body:`
      <div class="field"><label>Label</label><input class="input" id="nl" value="${H.esc(n.label||'')}"/></div>
      <div class="field-row">
        <div class="field"><label>Type</label><select class="input" id="nt">${TYPES.map(t=>`<option ${t===n.type?'selected':''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Department / lane</label><input class="input" id="nd" value="${H.esc(n.dept||'')}"/></div>
      </div>
      <div class="field"><label>Role</label><input class="input" id="nr" value="${H.esc(n.role||'')}"/></div>`,
      footer:`<button class="btn" id="nx">Cancel</button><button class="btn primary" id="nk">Apply</button>`});
    document.getElementById('nx').onclick=()=>{ H.closeModal(); reopenAfterNodeEdit(); };
    document.getElementById('nk').onclick=()=>{ n.label=document.getElementById('nl').value; n.type=document.getElementById('nt').value; n.dept=document.getElementById('nd').value; n.role=document.getElementById('nr').value; H.closeModal(); reopenAfterNodeEdit(); };
  }
  // node edit uses a nested modal; reopen the editor with current state
  function reopenAfterNodeEdit(){ openCanvasEditor(canvas, onSave); }
  draw();
}

// Lightweight BPMN validation + token simulation: checks start/end presence,
// reachability from start, dead-ends, gateway branch coverage, and traces the path.
export function validateFlow(canvas){
  const nodes=(canvas&&canvas.nodes)||[], edges=(canvas&&canvas.edges)||[];
  const out=(edges2,id)=> edges2.filter(e=>e.from===id);
  const inc=(id)=> edges.filter(e=>e.to===id);
  const issues=[];
  const starts=nodes.filter(n=>n.type==='start'), ends=nodes.filter(n=>n.type==='end');
  if(!nodes.length) return { issues:['Diagram is empty.'], path:[], reachable:[] };
  if(!starts.length) issues.push('No start event — add a "start" node.');
  if(!ends.length) issues.push('No end event — add an "end" node.');
  // reachability BFS from all starts
  const reach=new Set(); const q=[...starts.map(s=>s.id)];
  while(q.length){ const id=q.shift(); if(reach.has(id))continue; reach.add(id); out(edges,id).forEach(e=> q.push(e.to)); }
  nodes.forEach(n=>{ if(!reach.has(n.id) && n.type!=='start') issues.push(`"${n.label||n.type}" is not reachable from a start event.`); });
  nodes.forEach(n=>{ if(n.type!=='end' && out(edges,n.id).length===0) issues.push(`"${n.label||n.type}" has no outgoing flow (dead-end).`); });
  nodes.forEach(n=>{ if((n.type==='decision'||n.type==='gateway') && out(edges,n.id).length<2) issues.push(`Gateway "${n.label||n.type}" should have at least two outgoing branches.`); });
  nodes.forEach(n=>{ if(n.type!=='start' && inc(n.id).length===0 && reach.has(n.id)===false) {} });
  // trace one primary path (first outgoing at each step)
  const path=[]; let cur=starts[0]; const guard=new Set();
  while(cur && !guard.has(cur.id) && path.length<50){ path.push(cur); guard.add(cur.id); const e=out(edges,cur.id)[0]; if(!e)break; cur=nodes.find(n=>n.id===e.to); }
  return { issues, path, reachable:[...reach] };
}

function simulate(canvas, reopen){
  const r=validateFlow(canvas);
  const nodes=(canvas&&canvas.nodes)||[];
  H.modal({title:'Validate & simulate', size:'md',
    body:`<div class="doc-meta" style="margin-bottom:10px">
      <div class="row"><span class="k">Nodes</span><b>${nodes.length}</b></div>
      <div class="row"><span class="k">Reachable from start</span><b>${r.reachable.length}</b></div>
      <div class="row"><span class="k">Validation</span><span>${r.issues.length? `<span class="badge b-red">${r.issues.length} issue(s)</span>`:'<span class="badge b-green">Passed</span>'}</span></div>
    </div>
    ${r.issues.length?`<h4 style="margin:8px 0 4px">Issues</h4><ul class="jd-list">${r.issues.map(i=>`<li>${H.esc(i)}</li>`).join('')}</ul>`:''}
    <h4 style="margin:10px 0 4px">Simulated primary path</h4>
    ${r.path.length? `<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">${r.path.map((n,i)=>`${i?'<span class="muted">→</span>':''}<span class="tag">${H.esc(n.label||n.type)}</span>`).join('')}</div>` : '<span class="muted">No path — add a start event.</span>'}`,
    footer:`<button class="btn primary" id="cx">Close</button>`});
  document.getElementById('cx').onclick=()=>{ H.closeModal(); if(reopen) reopen(); };
}
