// Redpen — answer copy annotation tool.
import * as pdfjsLib from "../vendor/pdfjs/pdf.min.mjs";
import { CONFIG, TOOLS, STAMPS, COLORS, SPR, SPRIMG, RED, PENC, TEAMS, BOARDS, CLASSES, SUBJECTS, OTHER_SUBJECT, QTYPES, OTHER_TYPE, SUBJECTIVE, PARAM_MAX, EDGE } from "./config.js";
import { uid, clamp, r4, isRect, fsOf, fsCq, mkQ, fresh, normalize, check, half, num, toShown, fromShown, countMarks, marksProblem, coverTotal, fileBase, fileSafe, testLabel, numbered as numberedOf, totals as totalsOf, core, isEdited } from "./model.js";
import { buildExport, applyImport, exportPdf, exportHtml, renderPages, downloadFile } from "./export.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function setElText(e, v) { const n = e.firstChild; if (n && n.nodeType === 3) n.nodeValue = v; else e.insertBefore(document.createTextNode(v), e.firstChild); }

const LS = "redpen:";
const lsGet = (k) => { try { return localStorage.getItem(LS + k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(LS + k, v); } catch (e) {} };

const base = new URL("../vendor/pdfjs/", import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.mjs";
const PDF_OPTS = { cMapUrl: base + "cmaps/", cMapPacked: true, standardFontDataUrl: base + "standard_fonts/", wasmUrl: base + "wasm/", iccUrl: base + "iccs/" };


/* ---------------- state ---------------- */
const freshS = () => fresh(lsGet("reviewer") || "");
let S = freshS();
let tool = "select", color = "red", stampSel = "Good", activeQ = 1, selId = null, zoom = 1, fbOn = true, tab = "marks", fbAll = false;
let pages = [], fileName = "", fileKey = "", curPage = 0, focusPop = false, drag = null, saveT = null, dirty = false, jsonMode = "resume";
let hist = [], hp = -1;

const curQ = () => S.questions.find((q) => q.id === activeQ) || S.questions[0];
const find = (id) => S.anns.find((a) => a.id === id);
const numbered = () => numberedOf(S);
const totals = () => totalsOf(S);
const baseName = () => (fileName || "copy").replace(/\.[^.]+$/, "");

const rotOf = (i) => ((S.rot && S.rot[i]) || 0) % 360;
let reviewed = false;
function setReviewed(v) { reviewed = v; if (!v) S.review = null; $("#expWrap").hidden = !v; if (!v) $("#menu").hidden = true; }

function snap() {
  return JSON.stringify({ meta: S.meta, cohort: S.cohort, testTotal: S.testTotal, setupDone: S.setupDone, rot: S.rot, evalId: S.evalId, startedAt: S.startedAt, inputErrors: S.inputErrors,
    questions: S.questions, overall: S.overall, aiLoaded: S.aiLoaded,
    anns: S.anns.filter((a) => !a._new && !a._draft) });
}
function commit() {
  hist.splice(hp + 1); hist.push(snap()); if (hist.length > 120) hist.shift(); hp = hist.length - 1;
  saveSoon(); updateUndo();
}
function resetHist() { hist = [snap()]; hp = 0; updateUndo(); }
function updateUndo() { $("#btnUndo").disabled = hp <= 0; $("#btnRedo").disabled = hp >= hist.length - 1; }
function restore(str) {
  S = normalize(JSON.parse(str)); selId = null;
  if (S.questions.length && !S.questions.find((q) => q.id === activeQ)) activeQ = S.questions[0].id;
  geomAll(); renderAll(); saveSoon();
}
function undo() { finalizeSel(true); if (hp > 0) { hp--; restore(hist[hp]); updateUndo(); } }
function redo() { if (hp < hist.length - 1) { hp++; restore(hist[hp]); updateUndo(); } }
function flushSave() { if (fileKey) lsSet("draft:" + fileKey, snap()); }
function saveSoon() { if (reviewed) setReviewed(false); dirty = true; clearTimeout(saveT); saveT = setTimeout(flushSave, 350); }

let toastT = null;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200); }
function qHasWork(q) { return S.anns.some((a) => a.q === q.id) || (q.marks !== null && q.marks !== ""); }

/* ---------------- rail + options ---------------- */
function buildRail(){
  $("#rail").innerHTML=TOOLS.map(t=>`<button class="tl ${t.id===tool?"on":""}" data-tool="${t.id}" title="${esc(t.label)}"><span class="ic">${t.ic}</span>${t.label}</button>`).join("");
  $$(".tl").forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
}
function setTool(t){
  finalizeSel(); tool=t; selId=null;
  if(["underline","text","circle","pen"].indexOf(t)>=0&&color==="yellow") color="red";
  $("#pages").dataset.tool=t; buildRail(); renderOpts(); renderOverlays();
}
const qDone=q=>!q.attempted||(q.marks!==null&&q.marks!==""&&isFinite(+q.marks));
// The top strip is where the SME works on one question: pick it, give marks, then go to the next.
function renderOpts(){
  const o=$("#opts"), q=S.questions.find(x=>x.id===activeQ)||S.questions[0];
  const idx=q?S.questions.indexOf(q):-1, last=idx>=S.questions.length-1;
  let h=`<div class="orow"><div class="grp"><span class="lbl">Question</span>`;
  S.questions.forEach(x=>{ const st=!x.attempted?"na":(qHasWork(x)?"has":""), n=countMarks(S,x.id).total;
    h+=`<button class="qchip ${x===q?"on":""}" data-q="${x.id}" title="${x.attempted?"":"Not attempted. "}${n?n+" drawn on the copy":""}">Q${x.id}${n?`<b class="cnt">${n}</b>`:""}<i class="${st}"></i></button>`; });
  h+=`</div>`;
  if(q) h+=`<div class="grp right"><button type="button" class="btn" data-qprev ${idx<=0?"disabled":""}>‹ Previous</button><button type="button" class="btn ${qDone(q)?"primary":""}" data-qnext>${last?"Finish and check":"Next question ›"}</button></div>`;
  h+=`</div>`;
  let tl="";
  if(["box","underline","text","circle","pen"].indexOf(tool)>=0){
    tl+=`<div class="grp"><span class="lbl">Colour</span>`;
    ["red","yellow","green"].forEach(c=>{ if(tool!=="box"&&c==="yellow") return;
      const lab=(tool==="box"||tool==="underline")?COLORS[c].label:(c==="red"?"Red":"Green");
      tl+=`<button class="cchip ${color===c?"on":""}" data-c="${c}"><i class="i-${c}" ${tool!=="box"?`style="background:${PENC[c]}"`:""}></i>${lab}</button>`; });
    tl+=`</div>`;
  }
  if(tool==="stamp"){
    tl+=`<div class="grp"><span class="lbl">Stamp</span>`+STAMPS.map(x=>`<button class="schip ${stampSel===x?"on":""}" data-s="${esc(x)}">${esc(x)}</button>`).join("")+`</div>`;
  }
  if(q){
    const n=countMarks(S,q.id).total;
    h+=`<div class="orow qnow"><div class="grp"><b class="qt">Q${q.id}</b><span class="qsub">max ${q.max}${q.type?" · "+esc(q.type):""}${q.objective?" · objective":""} · ${n} mark${n===1?"":"s"} on the copy</span></div>
      <label class="topmk">Marks <input type="text" inputmode="decimal" data-topmk class="${q.badMarks?"bad":""}" value="${q.attempted?(q.marks===null?esc(q.badMarks||""):q.marks):0}" ${q.attempted?"":"disabled"} placeholder="–"> <span>/ ${q.max}</span></label>
      <label class="topna"><input type="checkbox" data-topna ${q.attempted?"":"checked"}> Not attempted</label>${tl}<div class="mkerr" id="mkErr" role="alert" ${q.badMarks?"":"hidden"}>${esc(q.badMarks?marksProblem(q.badMarks,q.max,"question"):"")}</div></div>`;
  } else if(tl) h+=`<div class="orow">${tl}</div>`;
  o.innerHTML=h;
  $$(".qchip[data-q]",o).forEach(b=>b.onclick=()=>setActiveQ(+b.dataset.q));
  const mk=$("[data-topmk]",o); if(mk){
    mk.oninput=()=>markInput(mk,q); mk.onchange=()=>markChange(mk,q);
    mk.onkeydown=e=>{ if(e.key==="Enter"){ e.preventDefault(); mk.blur(); goNext(); } };
  }
  const na=$("[data-topna]",o); if(na) na.onchange=()=>setNA(q,na.checked);
  const pv=$("[data-qprev]",o); if(pv) pv.onclick=()=>stepQ(-1);
  const nx=$("[data-qnext]",o); if(nx) nx.onclick=goNext;
  $$(".cchip",o).forEach(b=>b.onclick=()=>{ color=b.dataset.c; renderOpts(); });
  $$(".schip",o).forEach(b=>b.onclick=()=>{ stampSel=b.dataset.s; renderOpts(); });
  const t=TOOLS.find(x=>x.id===tool);
  $("#hint").textContent=fbOn?t.hint:"Annotations are hidden.";
}
function markInput(t,q){
  t.value=t.value.replace(/[^0-9.]/g,"");
  const err=marksProblem(t.value,q.max,"question"), box=$("#mkErr");
  if(t.value===""){ t.classList.remove("bad"); q.marks=null; delete q.badMarks; }
  else if(err){ t.classList.add("bad"); q.marks=null; q.badMarks=t.value; }
  else { t.classList.remove("bad"); q.marks=parseFloat(t.value); delete q.badMarks; }
  if(box){ box.hidden=!q.badMarks; box.textContent=q.badMarks?err:""; }
  updateTotals(); saveSoon();
  const nx=$("[data-qnext]"); if(nx) nx.classList.toggle("primary",qDone(q));
}
function markChange(t,q){
  // a wrong value stays in the box with its message, so the SME can fix it. It is also kept for the record.
  if(q.badMarks){ S.inputErrors=S.inputErrors||[]; S.inputErrors.push({ question:q.id, typed:q.badMarks, problem:marksProblem(q.badMarks,q.max,"question"), at:new Date().toISOString() }); }
  commit(); refreshChips(); renderSide();   // the strip is not redrawn, so a click on the next question is not lost
}
function refreshChips(){ $$(".qchip[data-q]").forEach(b=>{ const x=S.questions.find(y=>y.id===+b.dataset.q), i=$("i",b); if(x&&i) i.className=!x.attempted?"na":(qHasWork(x)?"has":""); }); }
function setNA(q,checked){
  q.attempted=!checked; delete q.badMarks;
  if(!q.attempted){ q.marks=0; const had=S.anns.filter(a=>a.type==="stamp"&&a.q===q.id).length;
    S.anns=S.anns.filter(a=>!(a.type==="stamp"&&a.q===q.id)); if(had) toast("Stamp removed."); }
  else q.marks=null;
  commit(); renderOpts(); renderOverlays(); renderSide();
}
// Next question, or the final check after the last one.
function goNext(){
  const cur=S.questions.find(x=>x.id===activeQ);
  if(cur&&cur.badMarks){ const m=$("[data-topmk]"); if(m) m.focus(); toast("Fix the marks for Q"+cur.id+" first."); return; }
  const i=S.questions.findIndex(x=>x.id===activeQ), t=S.questions[i+1];
  if(t){ setActiveQ(t.id); toast("Now marking Q"+t.id); } else submitReview();
}
function setActiveQ(id){
  if(!S.questions.find(q=>q.id===id)) return;
  finalizeSel(); activeQ=id; selId=null; renderOpts(); renderOverlays(); renderSide();
}
function stepQ(d){ const i=S.questions.findIndex(q=>q.id===activeQ), t=S.questions[i+d]; if(t){ setActiveQ(t.id); toast("Now marking Q"+t.id); } }
/* ---------------- pages ---------------- */
const stage=$("#stage"),pagesEl=$("#pages");
let io=null, seenIO=null, viewed=new Set();
function pageWidth(){ const base=Math.min(Math.max(stage.clientWidth-44,260),900); return Math.round(base*zoom); }
function layout(){
  const pw=pageWidth(); document.documentElement.style.setProperty("--pw",pw+"px");
  $("#zLbl").textContent=Math.round(zoom*100)+"%";
  pages.forEach(p=>p.rw=0);
  geomAll();
  if(io){ io.disconnect(); $$(".pg").forEach(el=>io.observe(el)); }
}
// Size of the page box as opened (W0 x H0) and as shown. A page turned 90 or 270 degrees swaps them.
function pageGeom(i){
  const p=pages[i], rot=rotOf(i), odd=rot%180!==0, pw=pageWidth();
  const W0=odd?pw*p.w/p.h:pw, H0=odd?pw:pw*p.h/p.w;
  return {rot,odd,pw,W0,H0,dispW:pw,dispH:odd?W0:H0};
}
function geom1(i){
  const p=pages[i], el=$(`.pg[data-i="${i}"]`); if(!p||!el) return;
  const g=pageGeom(i), rt=$(".rot",el);
  el.style.aspectRatio=g.dispW+" / "+g.dispH;
  rt.style.width=g.W0+"px"; rt.style.height=g.H0+"px";
  rt.style.left=((g.dispW-g.W0)/2)+"px"; rt.style.top=((g.dispH-g.H0)/2)+"px";
  rt.style.transform=g.rot?`rotate(${g.rot}deg)`:"";
}
function geomAll(){ pages.forEach((_,i)=>geom1(i)); }
// Turn one page (inverted or sideways copies). Marks stay on the same part of the answer.
function rotatePage(i,delta){
  finalizeSel(); selId=null;
  const r=(((rotOf(i)+delta)%360)+360)%360;
  if(!S.rot) S.rot={};
  if(r) S.rot[i]=r; else delete S.rot[i];
  pages[i].rw=0; geom1(i); paintPage(i); renderOverlays(i); renderSide(); commit();
}
function buildPages(){
  pagesEl.innerHTML=""; $("#pager").hidden=pages.length===0||wizOn; viewed=new Set();
  if(io) io.disconnect(); if(seenIO) seenIO.disconnect();
  seenIO=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting&&(e.intersectionRatio>=.2||e.intersectionRect.height>=stage.clientHeight*.4)) viewed.add(+e.target.dataset.i); }),{root:stage,threshold:[.2,.5]});
  io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting) paintPage(+e.target.dataset.i); }),{root:stage,rootMargin:"700px 0px"});
  pages.forEach((p,i)=>{
    const el=document.createElement("div"); el.className="pg"; el.dataset.i=i; el.style.aspectRatio=p.w+" / "+p.h;
    el.innerHTML=`<span class="pn">${i+1}</span><span class="prot"><button type="button" data-pr="-90" title="Turn this page left">⟲ Left</button><button type="button" data-pr="90" title="Turn this page right">Right ⟳</button><button type="button" data-pr="180" title="Turn this page upside down">⇅ 180°</button></span><div class="rot"><canvas></canvas><div class="ov"></div></div><div class="pov"></div>`;
    pagesEl.appendChild(el); io.observe(el); seenIO.observe(el);
  });
  layout(); updatePager();
}
async function paintPage(i){
  const p=pages[i],el=$(`.pg[data-i="${i}"]`); if(!p||!el) return;
  const g=pageGeom(i), key=g.pw+":"+g.rot; if(p.rw===key) return; p.rw=key;
  const c=$("canvas",el),dpr=Math.min(window.devicePixelRatio||1,2);
  const W=Math.round(g.W0*dpr),H=Math.round(g.H0*dpr);
  try{
    if(p.kind==="img"){ c.width=W;c.height=H; c.getContext("2d").drawImage(p.img,0,0,W,H); }
    else{
      if(p.task){ try{p.task.cancel();}catch(e){} }
      const vp=p.page.getViewport({scale:W/p.w}); c.width=Math.round(vp.width); c.height=Math.round(vp.height);
      p.task=p.page.render({canvasContext:c.getContext("2d"),canvas:c,viewport:vp}); await p.task.promise;
    }
  }catch(e){ if(!(e&&e.name==="RenderingCancelledException")) p.rw=0; }
}
function updatePager(){ $("#pLbl").textContent=(curPage+1)+" / "+Math.max(pages.length,1); }
let scrollRaf=0;
stage.addEventListener("scroll",()=>{ cancelAnimationFrame(scrollRaf); scrollRaf=requestAnimationFrame(()=>{
  const st=stage.getBoundingClientRect(); let cur=0;
  $$(".pg").forEach((p,i)=>{ if(p.getBoundingClientRect().top-st.top<st.height*.4) cur=i; });
  if(cur!==curPage){curPage=cur;updatePager();}
}); });
function goPage(n){ n=clamp(n,0,pages.length-1); const el=$$(".pg")[n]; if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); }
function setZoom(z){ zoom=clamp(z,.5,2.6); layout(); renderOverlays(); }
let rsT=null; window.addEventListener("resize",()=>{ clearTimeout(rsT); rsT=setTimeout(()=>{ if(!$("#qpPane").hidden) applyQpWidth(); if(pages.length) layout(); },200); });
/* ---------------- annotation rendering ---------------- */
function pc(v){ return (v*100)+"%"; }
function geom(el,a){
  if(isRect(a)){ el.style.left=pc(a.x); el.style.top=pc(a.y); el.style.width=pc(a.w); el.style.height=pc(a.h); }
  else if(a.type==="underline"||a.type==="strike"||a.type==="text"){ el.style.left=pc(a.x); el.style.top=pc(a.y); el.style.width=pc(a.w); }
  else { el.style.left=pc(a.x); el.style.top=pc(a.y); }
}
function penSvg(a){
  const pts=(a.pts||[]).map(q=>(q[0]*100).toFixed(2)+","+(q[1]*100).toFixed(2)).join(" ");
  const sw=Math.max(1.6,pageWidth()*.0042);
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;overflow:visible"><polyline points="${pts}" fill="none" stroke="${PENC[a.color]||RED}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function setSpr(el,key,a){ const sp=SPR[key]; el.style.width=(sp.cq*(a.sc||1))+"cqw"; el.innerHTML='<img src="'+sp.src+'" alt="" draggable="false">'; }
// Ticks, crosses, stamps and circled scores are resized by dragging their corner.
const isScalable=a=>a.type==="tick"||a.type==="cross"||a.type==="score"||(a.type==="stamp"&&!!SPR[a.stamp]);
function annEl(a,num){
  const el=document.createElement("div"); el.className="an "+a.type; el.dataset.id=a.id; geom(el,a);
  if(a.id===selId) el.classList.add("sel");
  if(a.type==="box"){
    el.classList.add("c-"+a.color); if(!a.text.trim()) el.classList.add("nofb");
    el.title=a.text||"";
    el.innerHTML=`<span class="num">${num||""}<em>Q${a.q}</em></span>`;
  } else if(a.type==="tick"||a.type==="cross"){ setSpr(el,a.type,a); }
  else if(a.type==="score"){ el.textContent=a.value||"0"; if(a.sc) el.style.setProperty("--k",a.sc); }
  else if(a.type==="stamp"){ if(SPR[a.stamp]){ el.classList.add("simg"); setSpr(el,a.stamp,a); } else el.textContent=a.stamp; }
  else if(a.type==="underline"){ el.classList.add("c-"+a.color); el.innerHTML=`<span class="ln"></span>`+(a.text?`<span class="cm">💬</span>`:""); el.title=a.text||""; }
  else if(a.type==="strike"){ el.innerHTML=`<span class="ln"></span>`; }
  else if(a.type==="text"){ el.classList.add("c-"+a.color); el.textContent=a.value||""; el.style.fontSize=fsCq(a)+"cqw"; el.style.textAlign=a.al||"left"; el.style.transform="rotate("+(a.rot||0)+"deg)"; }
  else if(a.type==="circle"){ el.classList.add("c-"+a.color); }
  else if(a.type==="pen"){ el.classList.add("c-"+a.color); el.innerHTML=penSvg(a); }
  if(S.aiLoaded && !a._new){
    if(a.src==="ai"&&isEdited(a)) el.insertAdjacentHTML("beforeend",`<span class="bdg" title="Edited from AI draft">edited</span>`);
    else if(a.src!=="ai") el.insertAdjacentHTML("beforeend",`<span class="bdg" title="Added">new</span>`);
  }
  if(a.id===selId){
    const hs=isRect(a)?["nw","ne","sw","se"]:(a.type==="underline"||a.type==="strike"||a.type==="text")?["w","e"]:isScalable(a)?["se"]:[];
    hs.forEach(h=>el.insertAdjacentHTML("beforeend",`<span class="h ${h}" data-h="${h}"></span>`));
  }
  return el;
}
function renderOverlays(only){
  const nums=numbered();
  $$(".pg").forEach(pg=>{
    const i=+pg.dataset.i; if(only!=null&&i!==only) return;
    const ov=$(".ov",pg), pov=$(".pov",pg); ov.innerHTML=""; pov.innerHTML=""; if(!fbOn) return;
    S.anns.filter(a=>a.page===i).forEach(a=>ov.appendChild(annEl(a,nums[a.id])));
    const s=S.anns.find(a=>a.id===selId&&a.page===i&&!a._draft);
    if(s&&(tool==="select"||s._new)) pov.appendChild(popEl(s,nums[s.id]));
  });
  if(focusPop){ focusPop=false; const f=$(".pop textarea, .pop input[type=text]"); if(f){ f.focus(); if(f.tagName==="INPUT") f.select(); } }
}

/* ---------------- popover ---------------- */
function popEl(a,num){
  const d=document.createElement("div"); d.className="pop";
  // Place the popover from where the mark appears on screen (the page may be turned).
  const rot=rotOf(a.page), p0=toShown(a.x,a.y,rot), p1=toShown(a.x+(a.w||0),a.y+(a.h||0),rot);
  const dx0=Math.min(p0[0],p1[0]), dx1=Math.max(p0[0],p1[0]), dy0=Math.min(p0[1],p1[1]), dy1=Math.max(p0[1],p1[1]);
  const right=dx0>.5, above=dy0>.72;
  const anchorX=right?dx1:dx0;
  if(right) d.classList.add("r");
  d.style.left=pc(clamp(anchorX,0,1));
  const bottom=dy1;
  if(above||(a.type==="text"&&dy0>.2)){ d.style.bottom="calc("+pc(1-dy0)+" + 22px)"; } else { d.style.top="calc("+pc(bottom)+" + "+(isRect(a)?10:22)+"px)"; }
  let h=""; const SC='<div class="trow"><span class="lbl">Size</span><button class="sm" data-sc="-1">−</button><button class="sm" data-sc="1">+</button></div>';
  const dots=cs=>`<div class="dots">`+cs.map(c=>`<button class="dot i-${c} ${a.color===c?"on":""}" data-c="${c}" ${a.type==="box"?"":`style="background:${PENC[c]}"`} title="${COLORS[c].label}"></button>`).join("")+`</div><span class="cl">${a.color&&(a.type==="box"||a.type==="underline")?COLORS[a.color].label:""}</span>`;
  if(a.type==="box"){
    h+=`<div class="ph">Box #${num||""} · Q${a.q} ${dots(["red","yellow","green"])}</div>
      <textarea data-ann="${a.id}" class="${a.text.trim()?"":"req"}" placeholder="Feedback (required)">${esc(a.text)}</textarea>`;
  } else if(a.type==="underline"){
    h+=`<div class="ph">Underline ${dots(["red","green"])}</div>
      <textarea data-ann="${a.id}" placeholder="Comment (optional)">${esc(a.text)}</textarea>`;
  } else if(a.type==="tick"||a.type==="cross"){
    h+=`<div class="ph">${a.type==="tick"?"Tick":"Cross"}</div><div class="row" style="margin-top:0;justify-content:flex-start"><button class="sm" data-do="flip">Change to ${a.type==="tick"?"✕ cross":"✓ tick"}</button></div>${SC}`;
  } else if(a.type==="score"){
    h+=`<div class="ph">${a.total?"Total for the test (cover page)":"Score"}</div><input type="text" inputmode="decimal" data-ann="${a.id}" value="${esc(a.value)}" placeholder="${a.total?"e.g. 12/20":"e.g. 6.5"}" maxlength="${a.total?9:6}">${SC}`;
  } else if(a.type==="stamp"){
    h+=`<div class="ph">Stamp</div><div class="chips">`+STAMPS.map(s=>`<button class="chip ${a.stamp===s?"on":""}" data-st="${esc(s)}">${esc(s)}</button>`).join("")+`</div>`+SC;
  } else if(a.type==="text"){
    const AL={left:"M0 1h14M0 5h9M0 9h12",center:"M0 1h14M2.5 5h9M1 9h12",right:"M0 1h14M5 5h9M2 9h12"};
    h+=`<div class="ph">Text ${dots(["red","green"])}</div><textarea class="wt" data-ann="${a.id}" placeholder="Type here">${esc(a.value)}</textarea>
      <div class="trow"><span class="lbl">Size</span><button class="sm" data-fs="-1">−</button><input type="number" class="fsin" min="6" max="60" value="${fsOf(a)}" data-fsin><button class="sm" data-fs="1">+</button>
      <span class="lbl" style="margin-left:6px">Align</span>`+["left","center","right"].map(k=>`<button class="sm ${(a.al||"left")===k?"pri":""}" data-al="${k}" title="Align ${k}"><svg width="14" height="10" viewBox="0 0 14 10"><path d="${AL[k]}" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></button>`).join("")+`</div>
      <div class="trow"><span class="lbl">Rotate</span><button class="sm" data-rot="-5">−</button><input type="number" class="fsin" min="-180" max="180" value="${a.rot||0}" data-rotin><span style="font-size:12px;color:var(--sub)">°</span><button class="sm" data-rot="5">+</button><button class="sm" data-rot0="1">Straight</button></div>`;
  } else if(a.type==="circle"){ h+=`<div class="ph">Circle ${dots(["red","green"])}</div>`;
  } else if(a.type==="pen"){ h+=`<div class="ph">Pen ${dots(["red","green"])}</div>`;
  } else { h+=`<div class="ph">Strike-through</div>`; }
  if(!a.total) h+=`<div class="qrow2"><span class="lbl">Question</span><select data-qsel>${S.questions.map(q=>`<option value="${q.id}" ${q.id===a.q?"selected":""}>Q${q.id}</option>`).join("")}</select></div>`;
  h+=`<div class="row">`;
  if(a.src==="ai"&&isEdited(a)) h+=`<button class="sm" data-do="restore">Restore AI version</button>`;
  h+=`<button class="sm danger" data-do="del">Delete</button><button class="sm pri" data-do="done">Done</button></div>`;
  d.innerHTML=h;
  const qs=$("[data-qsel]",d); if(qs) qs.onchange=()=>{ a.q=+qs.value; activeQ=a.q; touch(a); renderOpts(); renderSide(); renderOverlays(a.page); };
  $$("[data-c]",d).forEach(b=>b.onclick=()=>{ a.color=b.dataset.c; touch(a); focusPop=true; renderOverlays(a.page); renderSide(); });
  const setFs=v=>{ v=clamp(Math.round(v)||12,6,60); a.fs=v; const te=$(`.an[data-id="${a.id}"]`); if(te) te.style.fontSize=fsCq(a)+"cqw"; const fi=$("[data-fsin]",d); if(fi) fi.value=v; touch(a); };
  $$("[data-fs]",d).forEach(b=>b.onclick=()=>setFs(fsOf(a)+(+b.dataset.fs)));
  const fin=$("[data-fsin]",d); if(fin) fin.onchange=()=>setFs(parseFloat(fin.value));
  const setRot=v=>{ v=clamp(Math.round(v)||0,-180,180); a.rot=v; const te=$(`.an[data-id="${a.id}"]`); if(te) te.style.transform="rotate("+v+"deg)"; const ri=$("[data-rotin]",d); if(ri) ri.value=v; touch(a); };
  $$("[data-rot]",d).forEach(b=>b.onclick=()=>setRot((a.rot||0)+(+b.dataset.rot)));
  const rin=$("[data-rotin]",d); if(rin) rin.onchange=()=>setRot(parseFloat(rin.value));
  const r0=$("[data-rot0]",d); if(r0) r0.onclick=()=>setRot(0);
  $$("[data-al]",d).forEach(b=>b.onclick=()=>{ a.al=b.dataset.al; const te=$(`.an[data-id="${a.id}"]`); if(te) te.style.textAlign=a.al; $$("[data-al]",d).forEach(x=>x.classList.toggle("pri",x===b)); touch(a); });
  $$("[data-sc]",d).forEach(b=>b.onclick=()=>{ a.sc=clamp(Math.round(((a.sc||1)+(+b.dataset.sc)*.15)*100)/100,.5,3); const te=$(`.an[data-id="${a.id}"]`), key=a.type==="stamp"?a.stamp:a.type; if(te&&SPR[key]) te.style.width=(SPR[key].cq*a.sc)+"cqw"; if(te&&a.type==="score") te.style.setProperty("--k",a.sc); touch(a); });
  $$("[data-st]",d).forEach(b=>b.onclick=()=>{ a.stamp=b.dataset.st; touch(a); renderOverlays(a.page); });
  const ta=$("textarea",d);
  if(ta){ ta.oninput=()=>{ if(a.type==="text"){ a.value=ta.value; const te=$(`.an[data-id="${a.id}"]`); if(te) setElText(te,a.value); saveSoon(); return; } a.text=ta.value; ta.classList.toggle("req",a.type==="box"&&!a.text.trim()); syncText(a.id,ta.value,ta); updateBoxTitle(a); saveSoon(); };
          ta.onchange=()=>touch(a);
          ta.onkeydown=e=>{ if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); done(a); return; } if(e.key==="Escape"){ e.stopPropagation(); finalizeSel(); renderOverlays(); renderSide(); } }; }
  const inp=$("input[type=text]",d);
  if(inp){ inp.oninput=()=>{ if(a.type==="score") inp.value=inp.value.replace(a.total?/[^0-9./]/g:/[^0-9.]/g,""); a.value=inp.value; const e=$(`.an[data-id="${a.id}"]`); if(e) e.textContent=a.value||(a.type==="score"?"0":""); saveSoon(); };
           inp.onchange=()=>touch(a);
           inp.onkeydown=e=>{ if(e.key==="Enter") done(a); if(e.key==="Escape"){ e.stopPropagation(); finalizeSel(); renderOverlays(); } }; }
  $$("[data-do]",d).forEach(b=>b.onclick=()=>{
    const k=b.dataset.do;
    if(k==="flip"){ a.type=a.type==="tick"?"cross":"tick"; touch(a); renderOverlays(a.page); }
    else if(k==="del"){ removeAnn(a.id,!a._new); }
    else if(k==="restore"){ const o=JSON.parse(a.orig); [a.type,a.page,a.x,a.y,a.w,a.h,a.color,a.text,a.value,a.stamp,a.q]=o; touch(a); renderAll(); }
    else done(a);
  });
  return d;
}
function updateBoxTitle(a){ const e=$(`.an[data-id="${a.id}"]`); if(e){ e.title=a.text||""; if(a.type==="box") e.classList.toggle("nofb",!a.text.trim()); } }
function syncText(id,val,src){ $$(`textarea[data-ann="${id}"]`).forEach(t=>{ if(t!==src){ t.value=val; t.classList.toggle("req",!val.trim()); } }); updateFbBadge(); }
function touch(a){ if(!a._new) commit(); else saveSoon(); }
function done(a){
  if(a.type==="box"&&!a.text.trim()){ toast("Feedback is required."); focusPop=true; renderOverlays(a.page); return; }
  if(a.type==="score"&&!String(a.value).trim()){ toast("Enter the marks."); return; }
  if(a.type==="text"&&!String(a.value).trim()){ toast("Enter some text."); return; }
  select(null);
}

/* ---------------- selection ---------------- */
function finalizeSel(silent){
  const a=selId?find(selId):null; if(!a) return;
  let remove=false;
  if(a.type==="box"&&!a.text.trim()){ remove=true; if(!silent) toast("Box removed. Feedback is required."); }
  if((a.type==="score"||a.type==="text")&&!String(a.value).trim()) remove=true;
  if(remove){ S.anns=S.anns.filter(x=>x.id!==a.id); selId=null; return; }
  if(a._new){ delete a._new; commit(); }
}
function select(id){
  const prev=selId; finalizeSel(); selId=id;
  if(id){ const a=find(id); if(a&&a.q) activeQ=a.q; }
  renderOpts(); renderOverlays(); renderSide();
  if(id&&prev!==id) $$(".fbi").forEach(e=>e.classList.toggle("on",e.dataset.id===id));
}
function removeAnn(id,doCommit){
  S.anns=S.anns.filter(a=>a.id!==id); if(selId===id) selId=null;
  if(doCommit) commit(); renderOpts(); renderOverlays(); renderSide();
}
function add(props){ const a=Object.assign({id:uid(),q:activeQ,src:"reviewer",t:Date.now()},props); S.anns.push(a); return a; }

/* ---------------- pointer interactions ---------------- */
// Pointer position on the page as opened. r is the box shown on screen; rot is how far the page is turned.
function pt(e,r,rot){
  const u=clamp((e.clientX-r.left)/r.width,0,1), v=clamp((e.clientY-r.top)/r.height,0,1), o=fromShown(u,v,rot||0);
  return {x:o[0],y:o[1]};
}
pagesEl.addEventListener("pointerdown",e=>{
  if(e.target.closest(".pop")||e.target.closest(".prot")) return;
  if(e.pointerType==="mouse"&&e.button!==0) return;
  const pgEl=e.target.closest(".pg"); if(!pgEl) return;
  const i=+pgEl.dataset.i, anEl=e.target.closest(".an"), hEl=e.target.closest(".h");
  if(!fbOn){ toast("Annotations are hidden."); return; }
  if(hEl&&anEl){ e.preventDefault(); const a=find(anEl.dataset.id);
    if(isScalable(a)){ const r=pgEl.getBoundingClientRect(), p=pt(e,r,rotOf(i)), g=pageGeom(i);
      drag={mode:"scale",id:a.id,rot:rotOf(i),r:r,g:g,o:{sc:a.sc||1,d0:Math.hypot((p.x-a.x)*g.W0,(p.y-a.y)*g.H0)||1},moved:false}; return; }
    drag={mode:"resize",id:a.id,h:hEl.dataset.h,rot:rotOf(i),r:pgEl.getBoundingClientRect(),o:{x:a.x,y:a.y,w:a.w||0,hh:a.h||0},moved:false}; return; }
  if(anEl&&tool==="select"){ e.preventDefault(); const id=anEl.dataset.id; if(selId!==id) select(id);
    const a=find(id), r=pgEl.getBoundingClientRect(), p=pt(e,r,rotOf(i));
    drag={mode:"move",id:id,rot:rotOf(i),r:r,ox:p.x-a.x,oy:p.y-a.y,moved:false}; return; }
  if(anEl&&tool==="eraser"){ e.preventDefault(); removeAnn(anEl.dataset.id,true); return; }
  if(tool==="select"||tool==="eraser"){ if(selId){ select(null); } return; }
  e.preventDefault(); startDraw(e,i,pgEl);
});
function startDraw(e,i,pgEl){
  finalizeSel(); selId=null;
  const r=pgEl.getBoundingClientRect(), p=pt(e,r,rotOf(i));
  if(tool==="tick"||tool==="cross"){ add({type:tool,page:i,x:r4(p.x),y:r4(p.y)}); commit(); renderOpts(); renderOverlays(i); renderSide(); return; }
  if(tool==="score"){
    const q=curQ(); const a=add({type:"score",page:i,x:r4(p.x),y:r4(p.y),value:(q.attempted&&q.marks!==null&&q.marks!=="")?String(q.marks):"",_new:true});
    selId=a.id; focusPop=true; renderOverlays(); return;
  }
  if(tool==="text"){
    const tw=Math.max(.15,Math.min(.4,1-p.x)); const a=add({type:"text",page:i,x:r4(Math.min(p.x,1-tw)),y:r4(p.y),w:r4(tw),fs:12,al:"left",value:"",color:color==="green"?"green":"red",_new:true});
    selId=a.id; focusPop=true; renderOverlays(); return;
  }
  if(tool==="stamp"){
    const q=curQ();
    if(!q.attempted){ toast("Q"+q.id+" is not attempted."); renderOverlays(); return; }
    if(q.objective){ toast("Q"+q.id+" is objective. No stamp."); renderOverlays(); return; }
    const ex=S.anns.find(a=>a.type==="stamp"&&a.q===q.id);
    if(ex){ toast("Q"+q.id+" already has a stamp."); setTool("select"); select(ex.id); return; }
    add({type:"stamp",page:i,x:r4(p.x),y:r4(p.y),stamp:stampSel}); commit(); renderOpts(); renderOverlays(i); renderSide(); return;
  }
  if(["box","underline","strike","circle","pen"].indexOf(tool)>=0){
    const col=tool==="strike"?"red":(tool!=="box"&&color==="yellow"?"red":color);
    const a=add({type:tool,page:i,x:p.x,y:p.y,w:0,h:0,color:col,text:"",_draft:true});
    if(tool==="pen"){ a.raw=[[p.x,p.y]]; a.pts=[]; }
    drag={mode:"draw",id:a.id,r:r,rot:rotOf(i),sx:p.x,sy:p.y,page:i};
    renderOverlays(i);
  }
}
window.addEventListener("pointermove",e=>{
  if(!drag) return; const a=find(drag.id); if(!a) return; const p=pt(e,drag.r,drag.rot); drag.moved=true;
  if(drag.mode==="scale"){
    const d=Math.hypot((p.x-a.x)*drag.g.W0,(p.y-a.y)*drag.g.H0); a.sc=clamp(Math.round(drag.o.sc*d/drag.o.d0*100)/100,.5,3);
    const te=$(`.an[data-id="${a.id}"]`), key=a.type==="stamp"?a.stamp:a.type;
    if(te){ if(SPR[key]) te.style.width=(SPR[key].cq*a.sc)+"cqw"; if(a.type==="score") te.style.setProperty("--k",a.sc); }
    return;
  }
  if(drag.mode==="draw"){
    if(a.type==="pen"){
      a.raw.push([p.x,p.y]); const xs=a.raw.map(q=>q[0]),ys=a.raw.map(q=>q[1]);
      a.x=Math.min.apply(null,xs); a.y=Math.min.apply(null,ys); a.w=Math.max(.001,Math.max.apply(null,xs)-a.x); a.h=Math.max(.001,Math.max.apply(null,ys)-a.y);
      a.pts=a.raw.map(q=>[(q[0]-a.x)/a.w,(q[1]-a.y)/a.h]);
    }
    else if(a.type==="box"||a.type==="circle"){ a.x=Math.min(drag.sx,p.x); a.y=Math.min(drag.sy,p.y); a.w=Math.abs(p.x-drag.sx); a.h=Math.abs(p.y-drag.sy); }
    else { a.x=Math.min(drag.sx,p.x); a.y=drag.sy; a.w=Math.abs(p.x-drag.sx); a.h=0; }
  } else if(drag.mode==="move"){
    const w=a.w||0,h=a.h||0;
    if(isRect(a)){ a.x=clamp(p.x-drag.ox,0,1-w); a.y=clamp(p.y-drag.oy,0,1-h); }
    else if(a.type==="underline"||a.type==="strike"||a.type==="text"){ a.x=clamp(p.x-drag.ox,0,1-w); a.y=clamp(p.y-drag.oy,0,1); }
    else { a.x=clamp(p.x-drag.ox,0,1); a.y=clamp(p.y-drag.oy,0,1); }
  } else if(drag.mode==="resize"){
    const o=drag.o,h=drag.h;
    if(isRect(a)){
      let x1=o.x,y1=o.y,x2=o.x+o.w,y2=o.y+o.hh;
      if(h.indexOf("w")>=0) x1=p.x; if(h.indexOf("e")>=0) x2=p.x; if(h.indexOf("n")>=0) y1=p.y; if(h.indexOf("s")>=0) y2=p.y;
      a.x=Math.min(x1,x2); a.y=Math.min(y1,y2); a.w=Math.max(.015,Math.abs(x2-x1)); a.h=Math.max(.012,Math.abs(y2-y1));
    } else {
      let x1=o.x,x2=o.x+o.w; if(h==="w") x1=p.x; else x2=p.x;
      a.x=Math.min(x1,x2); a.w=Math.max(.02,Math.abs(x2-x1));
    }
  }
  const el=$(`.an[data-id="${a.id}"]`);
  if(el){ geom(el,a); if(drag.mode==="draw"&&a.type==="pen") el.innerHTML=penSvg(a); const pg=el.closest(".pg"), pop=pg&&pg.querySelector(".pov .pop"); if(pop) pop.style.display="none"; }
  else if(drag.mode==="draw") renderOverlays(drag.page);
});
window.addEventListener("pointerup",()=>{
  if(!drag) return; const d=drag; drag=null; const a=find(d.id); if(!a) return;
  if(d.mode==="draw"){
    delete a._draft;
    const tooSmall=a.type==="pen"?(a.raw.length<3||(a.w<.006&&a.h<.006)):(a.type==="box"||a.type==="circle")?(a.w<.012||a.h<.01):(a.w<.02);
    if(a.type==="pen"){ const st=Math.ceil(a.pts.length/250); a.pts=a.pts.filter((_,k)=>k%st===0||k===a.pts.length-1).map(q=>[r4(q[0]),r4(q[1])]); delete a.raw; }
    if(tooSmall){ S.anns=S.anns.filter(x=>x.id!==a.id); renderOverlays(d.page); return; }
    a.x=r4(a.x);a.y=r4(a.y);a.w=r4(a.w);a.h=r4(a.h);
    if(a.type==="box"){ a._new=true; selId=a.id; focusPop=true; renderOpts(); renderOverlays(); renderSide(); }
    else { commit(); renderOpts(); renderOverlays(a.page); renderSide(); }
  } else {
    a.x=r4(a.x);a.y=r4(a.y); if(a.w!=null) a.w=r4(a.w); if(a.h!=null) a.h=r4(a.h);
    if(d.moved) touch(a);
    renderOverlays(a.page); renderSide();
  }
});
document.addEventListener("keydown",e=>{
  const tg=e.target, typing=tg&&(tg.tagName==="INPUT"||tg.tagName==="TEXTAREA"||tg.tagName==="SELECT");
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==="z"&&!typing){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if(mod&&e.key.toLowerCase()==="y"&&!typing){ e.preventDefault(); redo(); return; }
  if(typing) return;
  if(!mod&&S.questions.length&&pages.length){
    if(e.key==="]"){ e.preventDefault(); stepQ(1); return; }
    if(e.key==="["){ e.preventDefault(); stepQ(-1); return; }
    if(/^[1-9]$/.test(e.key)&&S.questions.find(q=>q.id===+e.key)){ e.preventDefault(); setActiveQ(+e.key); toast("Now marking Q"+e.key); return; }
  }
  if((e.key==="Delete"||e.key==="Backspace")&&selId){ e.preventDefault(); const a=find(selId); removeAnn(selId,!(a&&a._new)); }
  if(e.key==="Escape"){ if(!$("#mw").hidden) closeModal(); else { finalizeSel(); selId=null; renderOverlays(); renderSide(); } }
});

/* ---------------- side panel ---------------- */
function renderSide(){ if(tab==="marks") renderMarks(); else renderFb(); updateTotals(); updateFbBadge(); $$(".tabs button").forEach(b=>b.classList.toggle("on",b.dataset.tab===tab)); }
function updateFbBadge(){
  const n=S.anns.filter(a=>(a.type==="box"&&a.text.trim())||(a.type==="underline"&&a.text.trim())).length;
  $("#fbCount").textContent=n?"("+n+")":"";
}
function updateTotals(){
  const t=totals();
  $("#totalBar").innerHTML=`<div><div class="n">${t.got}<span style="font-size:16px"> / ${t.max}</span></div><div style="font-size:11px;color:var(--sub);margin-top:2px">Total</div></div>
    <div class="r">${t.pct.toFixed(0)}%<b>${t.remark}</b></div>`;
}
function renderMarks(){
  const w=$("#sideBody"), up=S.cohort==="upsc", q=S.questions.find(x=>x.id===activeQ)||S.questions[0];
  const bits=[TEAMS[S.cohort]||"No team", S.meta.subject||"No subject"];
  if(S.meta.test) bits.push(S.meta.test);
  if(S.meta.student) bits.unshift(S.meta.student);
  if(S.cohort==="foundation"&&S.meta.board) bits.push(S.meta.board+" class "+S.meta.klass);
  let h=`<div class="sidehead"><b>${esc(bits.join(" · "))}</b><button type="button" id="editSetup">Edit</button></div>`;
  if(!S.questions.length){ w.innerHTML=h+`<div class="empty-s">Add the copy details to start.</div>`; return; }
  h+=`<div class="qlist">`+S.questions.map(x=>{
    const n=countMarks(S,x.id).total, sc=!x.attempted?"Not attempted":(qDone(x)?x.marks+" / "+x.max:"–");
    return `<button type="button" class="qli ${x.id===q.id?"act":""} ${qDone(x)?"done":""}" data-q="${x.id}"><i></i><b>Q${x.id}</b><span class="sc">${esc(sc)}</span><span class="nm" title="Marks drawn on the copy for this question">${n} on copy</span></button>`;
  }).join("")+`</div>`;
  h+=`<div class="qcard act" data-q="${q.id}"><div class="qhead"><b>Q${q.id}</b><span>special cases and notes</span></div>`;
  if(q.attempted){
    if(up){
      q.params.forEach((p,pi)=>{ h+=`<div class="prmwrap"><div class="prm"><span>${esc(p.name)}</span><input type="text" inputmode="decimal" data-pm="${pi}" value="${p.marks===null?"":p.marks}" placeholder="–"><span style="flex:0">/ ${PARAM_MAX}</span></div><div class="pmerr" data-pmerr="${pi}" hidden></div><textarea class="prmfb" data-pf="${pi}" placeholder="Feedback on ${esc(p.name.toLowerCase())} (optional)">${esc(p.feedback)}</textarea></div>`; });
    }
    h+=`<details class="edgebox"${q.edge.length?" open":""}><summary>Special case${q.edge.length?" ("+q.edge.length+")":""}</summary>`+
      EDGE.map((x,ei)=>[x,ei]).sort((A,B)=>(q.edge.indexOf(B[0].k)>=0)-(q.edge.indexOf(A[0].k)>=0)||A[1]-B[1]).map(([x,ei])=>{ const on=q.edge.indexOf(x.k)>=0;
        return `<label><input type="checkbox" data-edge="${ei}" ${on?"checked":""}> ${esc(x.k)}</label><span class="rule">${esc(x.rule)}</span>`+
          (on?`<textarea class="prmfb" data-edgenote="${ei}" placeholder="${x.k==="Other"?"Describe the special case":"Add a comment: what exactly, and where on the copy?"}">${esc((q.edgeNotes||{})[x.k]||"")}</textarea>`:""); }).join("")+`</details>`;
  }
  h+=`<label class="qnote">Note for this question<textarea class="prmfb" data-qnote placeholder="Anything unusual? Write it here, for example: handwriting hard to read, or why you gave these marks.">${esc(q.comment||"")}</textarea></label></div>`;
  if(up) h+=`<div class="sumBox"><h3>Overall summary</h3><textarea id="overall" placeholder="Overall feedback on the copy">${esc(S.overall)}</textarea></div>`;
  w.innerHTML=h;
}
function renderFb(){
  const w=$("#sideBody"), nums=numbered();
  const list=S.anns.filter(a=>(a.type==="box"||(a.type==="underline"&&a.text.trim()))&&(fbAll||a.q===activeQ)&&!a._draft)
    .sort((a,b)=>a.page-b.page||a.y-b.y||a.x-b.x);
  let h=`<div class="seg"><button data-fa="0" class="${fbAll?"":"on"}">Q${activeQ} only</button><button data-fa="1" class="${fbAll?"on":""}">All questions</button></div>`;
  if(!list.length) h+=`<div class="empty-s">No feedback yet.</div>`;
  list.forEach(a=>{
    const bad=a.type==="box"&&!a.text.trim();
    h+=`<div class="fbi ${a.color} ${a.id===selId?"on":""}" data-id="${a.id}"><div class="t"><span class="b">${a.type==="box"?(nums[a.id]||""):"U"}</span>${a.type==="box"?"Box":"Underline"} · Q${a.q} · Page ${a.page+1} · ${COLORS[a.color].label}${bad?` <span class="need">· feedback needed</span>`:""}</div>
      <textarea data-ann="${a.id}" class="${bad?"req":""}" placeholder="Feedback (required)">${esc(a.text)}</textarea></div>`;
  });
  w.innerHTML=h;
}
$("#sideBody").addEventListener("click",e=>{
  if(e.target.closest("#editSetup")){ openSetup(); return; }
  const fa=e.target.closest("[data-fa]"); if(fa){ fbAll=fa.dataset.fa==="1"; renderFb(); return; }
  const ql=e.target.closest(".qli"); if(ql){ setActiveQ(+ql.dataset.q); return; }
  const fi=e.target.closest(".fbi"); if(fi&&e.target.tagName!=="TEXTAREA"){
    const a=find(fi.dataset.id); if(!a) return; if(tool!=="select") setTool("select");
    select(a.id); const el=$(`.an[data-id="${a.id}"]`); if(el) el.scrollIntoView({behavior:"smooth",block:"center"}); }
});
$("#sideBody").addEventListener("input",e=>{
  const t=e.target, qc=t.closest(".qcard"), q=qc?S.questions.find(x=>x.id===+qc.dataset.q):null;
  if(t.matches("[data-pm]")&&q){
    t.value=t.value.replace(/[^0-9.]/g,"");
    const err=marksProblem(t.value,PARAM_MAX,"parameter"), box=$(`[data-pmerr="${t.dataset.pm}"]`);
    if(box){ box.hidden=!err; box.textContent=err; }
    if(t.value===""){ t.classList.remove("bad"); q.params[+t.dataset.pm].marks=null; }
    else if(err){ t.classList.add("bad"); return; }
    else { t.classList.remove("bad"); q.params[+t.dataset.pm].marks=parseFloat(t.value); }
    saveSoon();
  } else if(t.matches("[data-edgenote]")&&q){ q.edgeNotes=q.edgeNotes||{}; q.edgeNotes[EDGE[+t.dataset.edgenote].k]=t.value; saveSoon();
  } else if(t.matches("[data-qnote]")&&q){ q.comment=t.value; saveSoon();
  } else if(t.matches("[data-pf]")&&q){ q.params[+t.dataset.pf].feedback=t.value; saveSoon();
  } else if(t.id==="overall"){ S.overall=t.value; saveSoon(); }
  else if(t.matches("textarea[data-ann]")){
    const a=find(t.dataset.ann); if(!a) return; a.text=t.value; t.classList.toggle("req",a.type==="box"&&!a.text.trim());
    syncText(a.id,t.value,t); updateBoxTitle(a); saveSoon();
  }
});
$("#sideBody").addEventListener("change",e=>{
  const t=e.target, qc=t.closest(".qcard"), q=qc?S.questions.find(x=>x.id===+qc.dataset.q):null;
  if(t.matches("[data-pm]")&&q){
    if(t.classList.contains("bad")){ toast(marksProblem(t.value,PARAM_MAX,"parameter")); const v=q.params[+t.dataset.pm].marks; t.value=v===null?"":v; t.classList.remove("bad"); const box=$(`[data-pmerr="${t.dataset.pm}"]`); if(box) box.hidden=true; }
    commit(); return;
  }
  if(t.matches("[data-edge]")&&q){ const k=EDGE[+t.dataset.edge].k, ix=q.edge.indexOf(k); if(t.checked&&ix<0) q.edge.push(k); if(!t.checked&&ix>=0){ q.edge.splice(ix,1); if(q.edgeNotes) delete q.edgeNotes[k]; } commit(); renderSide();
    if(t.checked){ const ta=$(`[data-edgenote="${t.dataset.edge}"]`); if(ta){ ta.focus(); ta.scrollIntoView({block:"nearest"}); } } return; }
  if(t.matches("[data-pf]")||t.matches("[data-qnote]")||t.matches("[data-edgenote]")){ commit(); return; }
  if(t.id==="overall"||t.matches("textarea[data-ann]")){ commit(); renderOverlays(); if(t.matches("textarea[data-ann]")) renderOpts(); }
});
$$(".tabs button").forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; renderSide(); });



function renderAll() { buildRail(); renderOpts(); renderOverlays(); renderSide(); updateFbBtn(); }
function updateFbBtn() { $("#btnFb").textContent = fbOn ? "Hide annotations" : "Show annotations"; }

/* ---------------- modal ---------------- */
function openModal(html,mount){
  $("#modal").innerHTML=`<button class="x" id="mx" title="Close">✕</button>`+html; $("#mw").hidden=false;
  $("#mx").onclick=closeModal; if(mount) mount();
}
function closeModal(){ if(lockModal) return; $("#mw").hidden=true; $("#modal").innerHTML=""; $("#modal").classList.remove("wide","xl"); }
$("#mw").addEventListener("pointerdown",e=>{ if(e.target.id==="mw") closeModal(); });


/* ---------------- copy details ---------------- */
let lockModal=false;
const cleanName = (v) => String(v || "").trim().replace(/\s+/g, " ");
function safeUrl(u){ try{ const x=new URL(String(u||"").trim()); return /^https?:$/.test(x.protocol)?x.href:""; }catch(e){ return ""; } }
function optsHtml(list,sel,ph){ return `<option value="">${ph}</option>`+list.map(v=>`<option value="${esc(v)}" ${String(sel)===String(v)?"selected":""}>${esc(v)}</option>`).join(""); }

// The test details. In the setup page (wizard) they come after the question paper; later they open as a window.
function detailsForm(wizard) {
  // Going Back in the setup page keeps what was typed (wiz.draft).
  const d = wizard && wiz.draft ? wiz.draft : null;
  const rowOf = (q) => {
    const known = QTYPES.some((t) => t.k === q.type);
    return { max: q.max, type: known ? q.type : (q.type && q.type !== SUBJECTIVE ? OTHER_TYPE : ""), other: known || q.type === SUBJECTIVE || !q.type ? "" : q.type, obj: q.objective };
  };
  const rows = d ? d.rows.map((r) => ({ ...r })) : S.questions.map(rowOf);
  const m = d ? { ...S.meta, reviewer: d.rev, test: d.test, board: d.board, klass: d.klass, subject: d.sub } : S.meta;
  let team = d ? d.team : S.cohort;
  const nVal = d ? d.n : (rows.length || ""), totVal = d ? d.tot : (S.testTotal == null ? "" : S.testTotal);
  const html = `<h2>${wizard ? "Test details" : "Copy details"}</h2>
    <p class="hintline">${wizard ? "Fill this once for the test. The question paper stays open on the left." : "Only what we need. You decide the marks and the feedback."}</p>
    <div id="serr"></div>
    <div class="fgrid">
      ${wizard ? "" : `<label class="f full">Student name<input id="s_student" value="${esc(m.student)}" placeholder="e.g. Siddharth Jain" autocomplete="off"></label>`}
      <label class="f">Reviewer name<input id="s_rev" value="${esc(m.reviewer)}" autocomplete="name"></label>
      <label class="f">Team<select id="s_team"><option value="">Choose</option><option value="foundation" ${team==="foundation"?"selected":""}>Foundation</option><option value="upsc" ${team==="upsc"?"selected":""}>UPSC</option></select></label>
      <label class="f">Subject<select id="s_sub"></select></label>
      <label class="f"><span id="s_testlbl">${testLabel({ cohort: team })}</span><input id="s_test" value="${esc(m.test)}" placeholder="${team === "upsc" ? "e.g. SD2630" : "Half Yearly Test 02"}"></label>
      <label class="f full" id="s_subo_wrap" hidden>Subject name<input id="s_subo" placeholder="Type the subject"></label>
      <div class="full fgrid" id="s_fnd">
        <label class="f">Board<select id="s_board">${optsHtml(BOARDS,m.board,"Choose")}</select></label>
        <label class="f">Class<select id="s_class">${optsHtml(CLASSES,m.klass,"Choose")}</select></label>
      </div>
      <label class="f">Number of questions<input id="s_n" type="number" min="1" max="60" step="1" value="${nVal}" inputmode="numeric"></label>
      <label class="f">Total marks of the test<input id="s_tot" type="number" min="0.5" step="0.5" value="${totVal}" inputmode="decimal"></label>
    </div>
    <div class="sumnote" id="s_sum"></div>
    <div class="qrows" id="qrows"></div>
    ${wizard ? "" : `<h3>Question paper (optional)</h3>
    <div class="fgrid">
      <label class="f full">Link<input id="s_link" type="url" value="${esc(m.paperLink)}" placeholder="https://…"></label>
      <div class="full"><button type="button" class="btn" id="s_qpf">Upload the question paper PDF</button> <span class="note" id="s_qpn">${qp.has&&qp.name?esc(qp.name):""}</span></div>
    </div>`}
    <div class="mfoot">${wizard ? '<button class="btn" id="sBack">‹ Back</button>' : '<button class="btn" id="sCancel">Cancel</button>'}<button class="btn primary" id="sApply">${wizard ? "Next: answer copy ›" : "Save"}</button></div>`;
  const mount = () => {
    const root = wizard ? $("#wizBody") : $("#modal");
    if (!wizard) $("#modal").classList.add("wide");
    lockModal = false;
    const isF = () => $("#s_team").value === "foundation";
    const typeOpts = (sel) => `<option value="">Choose type</option>` + QTYPES.map((t) => `<option value="${esc(t.k)}" ${sel === t.k ? "selected" : ""}>${esc(t.k)}</option>`).join("") + `<option value="${OTHER_TYPE}" ${sel === OTHER_TYPE ? "selected" : ""}>Others</option>`;
    const objOf = (k) => !!(QTYPES.find((t) => t.k === k) || {}).obj;
    const drawRows = () => {
      const all = isF() && rows.length ? `<div class="qall"><span class="lbl">Same type for all</span><select id="s_all">${typeOpts("")}</select></div>` : "";
      $("#qrows").innerHTML = rows.length ? all + rows.map((r, i) => `<div class="qrow"><b>Q${i + 1}</b><input type="number" min="0.5" step="0.5" value="${r.max===""||r.max==null?"":r.max}" placeholder="Max" data-rm="${i}" inputmode="decimal"> marks
        ${isF() ? `<select data-rt="${i}">${typeOpts(r.type)}</select>` + (r.type === OTHER_TYPE ? `<input class="rto" data-rto="${i}" value="${esc(r.other)}" placeholder="Type name"><label><input type="checkbox" data-ro="${i}" ${r.obj ? "checked" : ""}> Objective</label>` : "") : ""}</div>`).join("") : '<div class="note">Enter the number of questions.</div>';
      $$("[data-rm]").forEach((x) => (x.oninput = () => { rows[+x.dataset.rm].max = x.value === "" ? "" : parseFloat(x.value); x.classList.remove("bad"); sum(); }));
      $$("[data-rt]").forEach((x) => (x.onchange = () => { const r = rows[+x.dataset.rt]; r.type = x.value; if (x.value !== OTHER_TYPE) { r.obj = objOf(x.value); r.other = ""; } drawRows(); }));
      $$("[data-rto]").forEach((x) => (x.oninput = () => { rows[+x.dataset.rto].other = x.value; x.classList.remove("bad"); }));
      $$("[data-ro]").forEach((x) => (x.onchange = () => { rows[+x.dataset.ro].obj = x.checked; }));
      const all2 = $("#s_all"); if (all2) all2.onchange = () => { if (!all2.value || all2.value === OTHER_TYPE) return; rows.forEach((r) => { r.type = all2.value; r.obj = objOf(all2.value); r.other = ""; }); drawRows(); };
      sum();
    };
    const sum = () => {
      const tot = parseFloat($("#s_tot").value), add = rows.reduce((a, r) => a + (+r.max || 0), 0), ok = rows.length && isFinite(tot) && Math.abs(add - tot) < 1e-6;
      const el = $("#s_sum"); el.className = "sumnote" + (rows.length && isFinite(tot) && !ok ? " warn" : "");
      el.textContent = rows.length ? (ok ? "Questions add up to " + add + " marks. Matches the test total." : "Questions add up to " + add + " marks" + (isFinite(tot) ? ", the test total is " + tot + ". You can still continue." : ".")) : "";
    };
    const fnd = () => { $("#s_fnd").hidden = $("#s_team").value !== "foundation"; };
    const fillSubjects = (keep) => {
      const t = $("#s_team").value, list = SUBJECTS[t] || [], sel = $("#s_sub");
      sel.disabled = !t;
      sel.innerHTML = `<option value="">${t ? "Choose" : "Choose the team first"}</option>` + list.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join("") + (t ? `<option value="${OTHER_SUBJECT}">Others</option>` : "");
      if (t && keep) { if (list.indexOf(keep) >= 0) sel.value = keep; else { sel.value = OTHER_SUBJECT; $("#s_subo").value = keep; } }
      $("#s_subo_wrap").hidden = sel.value !== OTHER_SUBJECT;
    };
    const subNow = () => ($("#s_sub").value === OTHER_SUBJECT ? $("#s_subo").value.trim() : $("#s_sub").value);
    const testLbl = () => { const up = $("#s_team").value === "upsc"; $("#s_testlbl").textContent = up ? "Test code" : "Paper name"; $("#s_test").placeholder = up ? "e.g. SD2630" : "Half Yearly Test 02"; };
    $("#s_team").onchange = () => { team = $("#s_team").value; testLbl(); const was = $("#s_sub").value === OTHER_SUBJECT ? subNow() : ""; fillSubjects(was); fnd(); drawRows(); };
    $("#s_sub").onchange = () => { $("#s_subo_wrap").hidden = $("#s_sub").value !== OTHER_SUBJECT; $("#s_sub").classList.remove("bad"); };
    fillSubjects(m.subject);
    $("#s_n").oninput = () => {
      const n = parseInt($("#s_n").value, 10);
      if (isFinite(n) && n >= 1 && n <= 60) { while (rows.length < n) rows.push({ max: "", type: "", other: "", obj: false }); rows.length = n; drawRows(); }
    };
    $("#s_tot").oninput = sum;
    if ($("#s_qpf")) $("#s_qpf").onclick = () => $("#fileQp").click();
    if ($("#sCancel")) $("#sCancel").onclick = closeModal;
    if ($("#sBack")) $("#sBack").onclick = () => {
      wiz.draft = { rev: $("#s_rev").value, team: $("#s_team").value, sub: subNow(), test: $("#s_test").value, board: $("#s_board").value, klass: $("#s_class").value, n: $("#s_n").value, tot: $("#s_tot").value, rows: rows.map((r) => ({ ...r })) };
      wiz.step = 1; renderWizard();
    };
    fnd(); drawRows();
    // the 'Please fill' message goes away as soon as the SME changes something
    const clearErr = () => { const e = $("#serr"); if (e) e.innerHTML = ""; };
    root.addEventListener("input", clearErr); root.addEventListener("change", clearErr);
    $("#sApply").onclick = () => {
      const g = (id) => $(id).value.trim(), bad = [], mark = (id) => { $(id).classList.add("bad"); };
      $$(".bad", root).forEach((x) => x.classList.remove("bad"));
      const rev = g("#s_rev"), tm = $("#s_team").value, subSel = $("#s_sub").value, sub = subSel === OTHER_SUBJECT ? g("#s_subo") : subSel, test = g("#s_test"), board = $("#s_board").value, klass = $("#s_class").value;
      const n = parseInt($("#s_n").value, 10), tot = parseFloat($("#s_tot").value);
      if (!rev) { bad.push("Reviewer name"); mark("#s_rev"); }
      if (!tm) { bad.push("Team"); mark("#s_team"); }
      if (!sub) { bad.push("Subject"); mark(subSel === OTHER_SUBJECT ? "#s_subo" : "#s_sub"); }
      if (!test) { bad.push(tm === "upsc" ? "Test code" : "Paper name"); mark("#s_test"); }
      const stuEl = $("#s_student"), stu = stuEl ? cleanName(stuEl.value) : S.meta.student;
      if (stuEl && !stu) { bad.push("Student name"); mark("#s_student"); }
      if (tm === "foundation" && !board) { bad.push("Board"); mark("#s_board"); }
      if (tm === "foundation" && !klass) { bad.push("Class"); mark("#s_class"); }
      if (!(n >= 1 && n <= 60)) { bad.push("Number of questions (1 to 60)"); mark("#s_n"); }
      if (!(tot > 0) || !half(tot)) { bad.push("Total marks (steps of 0.5)"); mark("#s_tot"); }
      rows.forEach((r, i) => {
        if (!(r.max > 0) || !half(+r.max)) { bad.push("Max marks of Q" + (i + 1) + " (steps of 0.5)"); const x = $(`[data-rm="${i}"]`); if (x) x.classList.add("bad"); }
        if (tm === "foundation") {
          if (!r.type) { bad.push("Type of Q" + (i + 1)); const x = $(`[data-rt="${i}"]`); if (x) x.classList.add("bad"); }
          else if (r.type === OTHER_TYPE && !String(r.other || "").trim()) { bad.push("Type name of Q" + (i + 1)); const x = $(`[data-rto="${i}"]`); if (x) x.classList.add("bad"); }
        }
      });
      if (bad.length) { $("#serr").innerHTML = `<div class="errbox">Please fill: ${esc(bad.slice(0, 6).join(", "))}${bad.length > 6 ? " and " + (bad.length - 6) + " more" : ""}.</div>`; root.scrollTop = 0; return; }
      const gone = S.questions.filter((q) => q.id > rows.length && qHasWork(q));
      if (gone.length && !window.confirm("Q" + gone.map((q) => q.id).join(", Q") + " will be removed. Their marks on the copy move to Q" + rows.length + ". Continue?")) return;
      const linkEl = $("#s_link"), link = linkEl ? safeUrl(linkEl.value) : S.meta.paperLink;
      S.meta = Object.assign({}, S.meta, { student: stu, reviewer: rev, subject: sub, test, board: tm === "foundation" ? board : "", klass: tm === "foundation" ? klass : "", paperLink: link });
      lsSet("reviewer", rev);
      S.cohort = tm; S.testTotal = tot;
      const old = S.questions;
      S.questions = rows.map((r, i) => {
        const q = old.find((x) => x.id === i + 1) || mkQ(i + 1, r.max);
        q.max = +r.max; delete q.badMarks;
        if (tm === "upsc") { q.type = SUBJECTIVE; q.objective = false; }
        else if (r.type === OTHER_TYPE) { q.type = String(r.other).trim(); q.objective = !!r.obj; }
        else { q.type = r.type; q.objective = objOf(r.type); }
        if (q.attempted && q.marks !== null && q.marks !== "" && q.marks > q.max) q.marks = q.max;
        return q;
      });
      S.anns.forEach((a) => { if (a.q > rows.length) a.q = rows.length; });
      if (!S.questions.find((q) => q.id === activeQ)) activeQ = 1;
      S.setupDone = true;
      if (wizard) { wiz.draft = null; wiz.step = 3; renderWizard(); return; }
      commit(); closeModal(); renderAll(); updateQpBtn();
      if (link && !qp.has) qpTryLink(link);
    };
  };
  return { html, mount };
}
function openSetup() {
  finalizeSel(); selId = null; renderOverlays();
  const f = detailsForm(false);
  openModal(f.html, f.mount);
}

/* ---------------- question paper (shown beside the copy) ---------------- */
const qp = { doc: null, img: null, name: "", has: false };
function updateQpBtn() { $("#qpLink").hidden = !S.meta.paperLink; }
const QPW = "qpw";
const qpFrac = () => { const v = parseFloat(lsGet(QPW)); return isFinite(v) ? clamp(v, 0.2, 0.75) : 0.42; };
function applyQpWidth() { const sp = $(".split"); if (sp) $("#qpPane").style.width = Math.round(sp.clientWidth * qpFrac()) + "px"; }
let qpT = null;
function qpResized() { clearTimeout(qpT); qpT = setTimeout(() => { layout(); renderOverlays(); if (!$("#qpPane").hidden) qpRender(); }, 150); }
function showQp(on) {
  $("#qpPane").hidden = !on; $("#btnQp").classList.toggle("primary", on);
  if (on) { updateQpBtn(); applyQpWidth(); layout(); renderOverlays(); }
  else { layout(); renderOverlays(); }
}
// Zoom for the question paper. One panel is used in every step, so these buttons work everywhere.
let qpZoom = (() => { const v = parseFloat(lsGet("qpz")); return isFinite(v) ? clamp(v, 0.5, 3) : 1; })();
function qpSetZoom(z) {
  qpZoom = clamp(Math.round(z * 100) / 100, 0.5, 3); lsSet("qpz", String(qpZoom)); $("#qpZl").textContent = Math.round(qpZoom * 100) + "%";
  clearTimeout(qpZT); qpZT = setTimeout(() => { if (!$("#qpPane").hidden) qpRender(true); }, 120);
}
let qpZT = null, qpRenderId = 0;
async function qpRender(keepScroll) {
  const body = $("#qpBody"), id = ++qpRenderId, frac = keepScroll && body.scrollHeight > body.clientHeight ? body.scrollTop / body.scrollHeight : 0;
  $("#qpZl").textContent = Math.round(qpZoom * 100) + "%";
  body.innerHTML = "";
  const w = Math.max(260, ($("#qpPane").clientWidth || 420) - 22) * qpZoom, dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (qp.doc) {
    for (let n = 1; n <= qp.doc.numPages; n++) {
      const pg = await qp.doc.getPage(n), v0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: (w * dpr) / v0.width });
      if (id !== qpRenderId) return;
      const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height); c.style.width = qpZoom * 100 + "%"; body.appendChild(c);
      await pg.render({ canvasContext: c.getContext("2d"), canvas: c, viewport: vp }).promise;
    }
    if (id === qpRenderId && frac) body.scrollTop = frac * body.scrollHeight;
  } else if (qp.img) {
    const c = document.createElement("canvas"), r = qp.img.naturalHeight / qp.img.naturalWidth;
    c.width = Math.round(w * dpr); c.height = Math.round(w * dpr * r); c.style.width = qpZoom * 100 + "%"; c.getContext("2d").drawImage(qp.img, 0, 0, c.width, c.height); body.appendChild(c);
    if (frac) body.scrollTop = frac * body.scrollHeight;
  }
}
async function qpLoad(file) {
  busy(true, "Opening question paper…");
  try {
    if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)) { qp.doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), ...PDF_OPTS }).promise; qp.img = null; }
    else if (/^image\//.test(file.type)) { qp.img = await loadImg(await readURL(file)); qp.doc = null; }
    else throw new Error("type");
    qp.name = file.name; qp.has = true; showQp(true); await qpRender();
    const n = $("#s_qpn"); if (n) n.textContent = file.name;
    if (wizOn && wiz.step === 1) { wiz.step = 2; renderWizard(); }
  } catch (e) { console.error(e); toast("Could not open the question paper. Choose a PDF or an image."); }
  busy(false);
}
async function qpTryLink(url) {
  showQp(true);
  // Many links (Drive, web pages) cannot be read by the browser. Then the SME opens the link in a new tab.
  try {
    const r = await fetch(url, { mode: "cors" });
    const b = await r.blob();
    if (!r.ok || !/pdf/i.test(b.type)) throw new Error("not a pdf");
    await qpLoad(new File([b], "question-paper.pdf", { type: "application/pdf" }));
  } catch (e) {
    $("#qpBody").innerHTML = '<div class="note">This link cannot be shown here. Use <b>Open link</b> to read it in a new tab, or upload the PDF in Copy details.</div>';
    updateQpBtn(); toast("Question paper link saved. Use Question paper → Open link.");
  }
}

/* ---------------- checks before a download ---------------- */
function showIssues(list, title, then) {
  openModal(`<h2>${esc(title)}</h2><p class="hintline">Tap a line to go there.</p>` + list.map((x, i) => `<button type="button" class="issue" data-i="${i}">${esc(x.msg)}<span>Go ›</span></button>`).join("") + `<div class="mfoot"><button class="btn" id="ic">Close</button></div>`, () => {
    $("#ic").onclick = closeModal;
    $$(".issue").forEach((el) => (el.onclick = () => {
      const x = list[+el.dataset.i]; closeModal();
      if (x.id) { setTool("select"); select(x.id); const e = $(`.an[data-id="${x.id}"]`); if (e) e.scrollIntoView({ behavior: "smooth", block: "center" }); }
      else if (x.q) { tab = "marks"; setActiveQ(x.q); const m = $("[data-topmk]"); if (m) m.focus(); }
      else if (x.setup) openSetup();
      else if (x.cover) submitReview();
    }));
  });
}
// Export is only offered after the final check. Blockers still stop a download if something changed.
function exportGuard(run) {
  if (!pages.length) { toast("Open a copy first."); return; }
  finalizeSel(); selId = null;
  const r = check(S, pages.length);
  if (r.blockers.length) { setReviewed(false); showIssues(r.blockers, "Fix before downloading", null); return; }
  const cv = coverTotal(S);
  if (cv.state !== "ok") { setReviewed(false); showIssues([{ msg: "Write the total (" + cv.want + ") on the cover page of the copy.", cover: 1 }], "One more thing", null); return; }
  run();
}
// Puts (or updates) the total for the whole test on the cover page, as a circled mark that belongs to no question.
function addCoverTotal() {
  const c = coverTotal(S);
  if (c.ann) c.ann.value = c.want;
  else add({ type: "score", q: 0, total: true, page: 0, x: 0.82, y: 0.1, value: c.want, sc: 1.3 });
  commit(); renderOverlays(0);
}
const data = () => buildExport({ S, pages, fileName, qpName: qp.has ? qp.name : "" });
function saveJson() { downloadFile(fileBase(S, baseName()) + ".redpen.json", JSON.stringify(data(), null, 2), "application/json"); dirty = false; }
async function savePdf() {
  busy(true, "Building PDF…");
  try { downloadFile(fileBase(S, baseName()) + ".annotated.pdf", await exportPdf({ S, pages }), "application/pdf"); dirty = false; }
  catch (e) { console.error(e); toast("Could not build the PDF."); }
  busy(false);
}
async function saveHtml() {
  busy(true, "Building HTML…");
  try { downloadFile(fileBase(S, baseName()) + ".evaluated.html", await exportHtml({ S, pages, fileName }), "text/html"); dirty = false; }
  catch (e) { console.error(e); toast("Could not build the HTML."); }
  busy(false);
}
const GUIDE3 = [
  "Marks follow the marking scheme. A different but correct method or wording still gets marks. Give no bonus or extra marks: this data is used to train AI models.",
  "Every question has marks and feedback. A question the student did not attempt is marked Not attempted. Blank, copied or fully wrong answers get 0, and objective questions are full marks or 0.",
  "Anything unusual (poor handwriting, an unclear answer, a missing diagram or unit): tick the special case and write a note on that question.",
  "Look at the total for the whole test (for example 12 out of 20) and ask yourself: is this a fair total for this answer copy?",
];
const TAGTXT = { nofb: "No feedback box", colour: "Marks and colours differ", "na-marks": "Not attempted, but has marks", nonote: "Special case: add a comment", objective: "Objective: use 0 or full marks", score: "Circled score differs", order: "Out of order" };
const rv = { step: 1, t: [false, false, false], thumbs: [], res: null };

function submitReview() {
  if (!pages.length) { toast("Open a copy first."); return; }
  finalizeSel(); selId = null; renderOverlays(); renderSide();
  const r = check(S, pages.length, { viewed });
  if (r.blockers.length) { setReviewed(false); showIssues(r.blockers, "Fix these first", null); return; }
  openReview(r);
}
// Three short steps: marks, pages, guidelines. Export appears after all three are ticked.
function openReview(res) {
  rv.step = 1; rv.t = [false, false, false]; rv.thumbs = []; rv.res = res; setReviewed(false);
  openModal('<div id="rvRoot"></div>', () => {
    $("#modal").classList.add("wide", "xl");
    renderPages({ S, pages, W: 420, onPage: (cv, i) => { rv.thumbs[i] = cv; const slot = $("#rvTh" + i); if (slot) { slot.innerHTML = ""; slot.appendChild(cv); } } })
      .catch((e) => console.error(e));
    renderReview();
  });
}
function renderReview() {
  const root = $("#rvRoot"); if (!root) return;
  const res = rv.res, st = rv.step, all = rv.t.every(Boolean);
  const tick = (i, text) => `<label class="rvchk ${rv.t[i] ? "on" : ""}"><input type="checkbox" data-rvt="${i}" ${rv.t[i] ? "checked" : ""}><span>${esc(text)}</span></label>`;
  let h = `<ol class="rvsteps">` + ["Marks", "Pages", "Guidelines"].map((l, i) => `<li class="${i + 1 === st ? "on" : ""} ${rv.t[i] ? "done" : ""}"><b>${rv.t[i] ? "✓" : i + 1}</b>${l}</li>`).join("") + `</ol>`;
  if (st === 1) {
    const t = totals(), notes = res.warnings.filter((w) => w.kind === "marks" && !w.q);
    const cv = coverTotal(S);
    const cvMsg = cv.state === "ok" ? `\u2713 Written on the cover page: <b>${esc(cv.ann.value)}</b>` : cv.state === "stale" ? `The cover page says <b>${esc(cv.ann.value)}</b>, but the total is now <b>${esc(cv.want)}</b>.` : `Write the total for the whole test (<b>${esc(cv.want)}</b>) on the cover page of the copy.`;
    h += `<h2>Check the marks</h2><p class="hintline" style="margin-top:-6px">Student: <b>${esc(S.meta.student)}</b> · ${esc(testLabel(S))}: <b>${esc(S.meta.test)}</b></p><div class="rvcover ${cv.state}"><span>${cvMsg}</span><span class="sp"></span>${cv.state === "ok" ? "" : `<button class="btn primary" id="rvCover">${cv.state === "stale" ? "Update the cover page" : "Add " + esc(cv.want) + " to the cover page"}</button>`}<button class="btn" id="rvShow" ${cv.ann ? "" : "hidden"}>Show it on the copy</button></div><p class="rvbig"><b>${t.got}</b> out of ${t.max} · ${t.pct.toFixed(0)}% · ${esc(t.remark)}</p><p class="hintline" style="margin-top:-2px">This is the total for the whole test. Is it a fair total for this answer copy?</p>`;
    h += notes.map((x) => `<div class="warnitem">${esc(x.msg)}</div>`).join("");
    h += `<div class="rvscroll"><table class="rvtable"><tr><th>Question</th><th>Max</th><th>Marks</th><th>On copy</th><th>Check</th></tr>` + S.questions.map((q) => {
      const tags = res.byQ[q.id] || [], n = countMarks(S, q.id).total;
      const sp = (q.edge || []).map((x) => `<span class="tagc ok" title="${esc((q.edgeNotes || {})[x] || "")}">${esc(x)}</span>`).join("");
      const chk = (tags.length ? tags.map((x) => `<span class="tagc">${esc(TAGTXT[x] || x)}</span>`).join("") : (q.attempted ? '<span class="tagok">OK</span>' : '<span class="tagc ok">Not attempted</span>')) + sp;
      return `<tr class="${tags.length ? "flag" : ""}" data-gq="${q.id}"><td><b>Q${q.id}</b></td><td>${esc(q.max)}</td><td class="m">${q.attempted ? esc(q.marks) : 0}</td><td>${n}</td><td>${chk}</td></tr>`;
    }).join("") + `</table></div><p class="hintline">Tap a question to go back and fix it.</p>`;
    h += tick(0, `I checked every question. The total ${t.got} out of ${t.max} is fair for this copy, and the marks, the answer and the feedback agree.`);
  } else if (st === 2) {
    const pw = res.warnings.filter((w) => w.kind === "pages");
    h += `<h2>Check the pages</h2><p class="hintline">Pages are shown the way they will be saved. Tap a page to go to it.</p>` + pw.map((x) => `<div class="warnitem">${esc(x.msg)}</div>`).join("");
    h += `<div class="rvpages">` + pages.map((_, i) => {
      const tags = res.byPage[i] || [], n = S.anns.filter((a) => a.page === i && !a._draft).length;
      const b = [tags.indexOf("turned") >= 0 ? "Turned " + rotOf(i) + "°" : "", tags.indexOf("empty") >= 0 ? "No marks" : "", tags.indexOf("unseen") >= 0 ? "Not viewed" : ""].filter(Boolean).map((x) => `<span class="tagc">${x}</span>`).join("");
      return `<button type="button" class="rvth" data-gp="${i}"><span class="slot" id="rvTh${i}">…</span><span class="cap">Page ${i + 1} · ${n} mark${n === 1 ? "" : "s"}</span>${b}</button>`;
    }).join("") + `</div>`;
    h += tick(1, "Every page is the right way up, and the marks are on the right pages.");
  } else {
    h += `<h2>Guidelines</h2><ul class="rvguide">${GUIDE3.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` + tick(2, "I followed these guidelines. I gave no bonus or extra marks.");
    if (all) h += `<div class="rvexp"><p class="rvdone">✓ All checks done. Save the files for the admin.</p><p class="hintline">They will be saved as <b>${esc(fileBase(S, "copy"))}</b>.redpen.json, .annotated.pdf and .evaluated.html</p><div class="rvbtns"><button class="btn" id="rvHtml">Save HTML</button><button class="btn" id="rvPdf">Save PDF</button><button class="btn primary" id="rvJson">Save JSON</button>${CONFIG.submitUrl ? '<button class="btn primary" id="rvSend">Send</button>' : ""}</div></div>`;
  }
  h += `<div class="rvfoot"><button class="btn" id="rvBack">${st === 1 ? "Back to the copy" : "‹ Back"}</button><span class="sp"></span>`;
  if (st < 3) h += `<button class="btn primary" id="rvNext" ${rv.t[st - 1] && (st !== 1 || coverTotal(S).state === "ok") ? "" : "disabled"}>Continue ›</button>`;
  else if (all) h += `<button class="btn" id="rvNew">Start next copy ›</button>`;
  h += `</div>`;
  root.innerHTML = h;
  pages.forEach((_, i) => { const slot = $("#rvTh" + i); if (slot && rv.thumbs[i]) { slot.innerHTML = ""; slot.appendChild(rv.thumbs[i]); } });
  $$("[data-rvt]", root).forEach((x) => (x.onchange = () => {
    rv.t[+x.dataset.rvt] = x.checked;
    const ok = rv.t.every(Boolean) && coverTotal(S).state === "ok";
    if (ok) {
      const tt = totals(), r2 = check(S, pages.length, { viewed }), cv = coverTotal(S);
      // Everything the SME was shown and confirmed, saved with the JSON.
      S.review = {
        completed_at: new Date().toISOString(), checks: ["marks", "pages", "guidelines"],
        total_confirmed: tt.got + " out of " + tt.max, cover_total_written: cv.ann.value, no_bonus_marks_confirmed: true,
        warnings_shown: r2.warnings.map((w) => w.msg),
        warnings: r2.warnings.map((w) => ({ message: w.msg, kind: w.kind, question: w.q || null, page: w.page == null ? null : w.page + 1 })),
        question_flags: Object.keys(r2.byQ).map((k) => ({ question: +k, flags: r2.byQ[k].map((x) => TAGTXT[x] || x) })),
        page_flags: Object.keys(r2.byPage).map((k) => ({ page: +k + 1, flags: r2.byPage[k] })),
        pages_viewed: pages.map((_, i) => i).filter((i) => viewed.has(i)).map((i) => i + 1),
        pages_not_viewed: pages.map((_, i) => i).filter((i) => !viewed.has(i)).map((i) => i + 1),
        input_errors: (S.inputErrors || []).slice(),
      };
    }
    setReviewed(ok); renderReview();
  }));
  $$("[data-gq]", root).forEach((r) => (r.onclick = () => { closeModal(); tab = "marks"; setActiveQ(+r.dataset.gq); }));
  $$("[data-gp]", root).forEach((r) => (r.onclick = () => { closeModal(); goPage(+r.dataset.gp); }));
  const cvb = $("#rvCover");
  if (cvb) cvb.onclick = () => {
    addCoverTotal(); rv.t = [false, false, false]; rv.res = check(S, pages.length, { viewed }); delete rv.thumbs[0]; renderReview();
    renderPages({ S, pages, W: 420, only: [0], onPage: (cv, i) => { rv.thumbs[i] = cv; const slot = $("#rvTh" + i); if (slot) { slot.innerHTML = ""; slot.appendChild(cv); } } }).catch((e) => console.error(e));
  };
  const shw = $("#rvShow");
  if (shw) shw.onclick = () => { const a = coverTotal(S).ann; closeModal(); goPage(0); if (a) { setTool("select"); select(a.id); const el = $(`.an[data-id="${a.id}"]`); if (el) setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250); } };
  const nx = $("#rvNext"); if (nx) nx.onclick = () => { rv.step++; renderReview(); $("#modal").scrollTop = 0; };
  $("#rvBack").onclick = () => { if (rv.step === 1) closeModal(); else { rv.step--; renderReview(); $("#modal").scrollTop = 0; } };
  if ($("#rvJson")) { $("#rvJson").onclick = saveJson; $("#rvPdf").onclick = savePdf; $("#rvHtml").onclick = saveHtml; }
  if ($("#rvSend")) $("#rvSend").onclick = sendToServer;
  if ($("#rvNew")) $("#rvNew").onclick = () => { closeModal(); openWizard(); };
}
async function sendToServer() {
  busy(true, "Sending…");
  try {
    const r = await fetch(CONFIG.submitUrl, { method: "POST", headers: { "Content-Type": "application/json", ...CONFIG.submitHeaders }, body: JSON.stringify(data()) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    dirty = false; busy(false); toast("Sent.");
  } catch (e) { busy(false); toast("Could not send. Save the JSON and try again later."); }
}

/* ---------------- opening files ---------------- */
function busy(on, txt) { $("#busy").hidden = !on; if (txt) $("#busyTxt").textContent = txt; }
const readURL = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// Reads the student's answer copy (a PDF, or photos) into pages. Does not start the evaluation.
async function readCopy(list) {
  const files = Array.from(list || []); if (!files.length) return null;
  const pdf = files.find((f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name));
  const np = []; let key = "", name = "";
  if (pdf) {
    const buf = await pdf.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf, ...PDF_OPTS }).promise;
    for (let p = 1; p <= doc.numPages; p++) { const pg = await doc.getPage(p); const vp = pg.getViewport({ scale: 1 }); np.push({ kind: "pdf", page: pg, w: vp.width, h: vp.height }); }
    key = pdf.name + "|" + pdf.size + "|" + doc.numPages; name = pdf.name;
  } else {
    const imgs = files.filter((f) => /^image\//.test(f.type)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!imgs.length) throw new Error("type");
    for (const f of imgs) { const im = await loadImg(await readURL(f)); np.push({ kind: "img", img: im, w: im.naturalWidth, h: im.naturalHeight }); }
    key = imgs.map((f) => f.name + f.size).join("|").slice(0, 160); name = imgs.length > 1 ? imgs[0].name + " (+" + (imgs.length - 1) + ")" : imgs[0].name;
  }
  return { np, name, key };
}
async function chooseCopy(list) {
  busy(true, "Opening…");
  try { const r = await readCopy(list); if (r) { wiz.pending = r; if (wizOn) renderWizard(); } }
  catch (e) { console.error(e); toast(e && e.message === "type" ? "Choose a PDF or images." : "Could not open this file."); }
  busy(false);
}

/* ---------------- setup page: question paper, test details, answer copy, start ---------------- */
let wizOn = false;
const wiz = { step: 1, pending: null, draft: null, student: "" };
const fnamePreview = () => { const b = [fileSafe(S.meta.test), fileSafe(wiz.student)].filter(Boolean).join("_"); return b ? "Files will be saved as " + b + ".redpen.json, .annotated.pdf and .evaluated.html" : ""; };
function openWizard(initial) {
  if (!initial && dirty && S.anns.length && !window.confirm("Leave this copy? Marks you have not exported will be lost.")) return;
  wiz.pending = null; wiz.draft = null; wiz.student = ""; wiz.step = S.setupDone ? 3 : 1;
  wizOn = true; $(".app").classList.add("setup"); $("#wizard").hidden = false; $("#pages").hidden = true; $("#pager").hidden = true;
  renderWizard(); stage.scrollTop = 0;
}
function closeWizard() { wizOn = false; $(".app").classList.remove("setup"); $("#wizard").hidden = true; $("#pages").hidden = false; $("#pager").hidden = pages.length === 0; }
function renderWizard() {
  const steps = ["Question paper", "Test details", "Answer copy"];
  $("#wsteps").innerHTML = steps.map((t, i) => `<li class="${i + 1 === wiz.step ? "on" : ""} ${i + 1 < wiz.step ? "done" : ""}"><b>${i + 1 < wiz.step ? "✓" : i + 1}</b>${t}</li>`).join("");
  const body = $("#wizBody");
  if (wiz.step === 1) {
    const have = qp.has || S.meta.paperLink;
    body.innerHTML = `<h2>Upload the question paper</h2><p class="hintline">It stays open next to the answer copy while you evaluate.</p>
      <div class="drop" data-drop="qp"><strong>Choose the question paper</strong><span>PDF or photo, or drop it here</span></div>
      <div class="wrow"><input id="wizLink" type="url" placeholder="Or paste a link  https://…" value="${esc(S.meta.paperLink)}"><button class="btn" id="wizLinkGo">Use link</button></div>
      <div class="wrow">${have ? `<button class="btn primary" id="wizKeep">Keep ${esc(qp.has && qp.name ? qp.name : "the link")} and continue ›</button>` : ""}<button class="btn" id="wizSkip">I don’t have it. Skip</button><span class="sp"></span><button class="btn plain" id="btnDemo">Try the demo</button></div>`;
  } else if (wiz.step === 2) {
    const f = detailsForm(true); body.innerHTML = f.html; f.mount();
  } else {
    const m = S.meta, pq = qp.has && qp.name ? qp.name : (m.paperLink ? "Link" : "Not added");
    const det = [TEAMS[S.cohort], m.subject, m.test, S.cohort === "foundation" ? m.board + " class " + m.klass : "", S.questions.length + " questions", S.testTotal + " marks"].filter(Boolean).join(" · ");
    const p = wiz.pending;
    body.innerHTML = `<h2>Upload the student’s answer copy</h2>
      <div class="wsum"><div><span><b>Test</b> ${esc(det)}</span><button data-wgo="2">Change</button></div><div><span><b>Question paper</b> ${esc(pq)}</span><button data-wgo="1">Change</button></div></div>
      <label class="f wstu">Student name<input id="wizStudent" value="${esc(wiz.student)}" placeholder="e.g. Siddharth Jain" autocomplete="off"></label>
      <p class="hintline" id="wizFname">${esc(fnamePreview())}</p>
      <div class="drop ${p ? "has" : ""}" data-drop="copy"><strong>${p ? "✓ " + esc(p.name) : "Choose the answer copy"}</strong><span>${p ? p.np.length + " page" + (p.np.length === 1 ? "" : "s") + ". Choose another file to replace it." : "One PDF, or several photos. You can also drop it here."}</span></div>
      <div class="wrow"><button class="btn primary big" id="wizStart" ${p && wiz.student.trim() ? "" : "disabled"}>Start evaluation</button>${pages.length ? '<button class="btn plain" id="wizCancel">Back to the copy I was marking</button>' : ""}</div>`;
  }
}
function startPending() { const p = wiz.pending; if (!p || !wiz.student.trim()) return; wiz.pending = null; startSession(p.np, p.name, p.key, false, cleanName(wiz.student)); }

function startSession(np, name, key, demo, student) {
  pages = np; fileName = name; fileKey = key; curPage = 0;
  let restored = false;
  const d = lsGet("draft:" + key);
  if (d) { try { S = normalize(JSON.parse(d)); restored = true; } catch (e) {} }
  if (!restored) {
    // The next copy of the same test has the same details, so carry them over. Marks start clean.
    const keep = S; S = freshS();
    S.meta = { ...S.meta, ...keep.meta, copyId: baseName(), student: "" };
    S.cohort = keep.cohort; S.testTotal = keep.testTotal;
    S.questions = keep.questions.map((q) => { const n = mkQ(q.id, q.max); n.objective = q.objective; n.type = q.type; return n; });
    S.setupDone = !!demo || !!keep.setupDone;
  }
  if (student) S.meta.student = student;
  closeWizard();
  if (!S.evalId) { const d0 = new Date(), p2 = (n) => (n < 10 ? "0" : "") + n; S.evalId = "RP-" + d0.getFullYear() + p2(d0.getMonth() + 1) + p2(d0.getDate()) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  if (!S.startedAt) S.startedAt = new Date().toISOString();
  setReviewed(false);
  activeQ = S.questions.length ? S.questions[0].id : 1;
  selId = null; dirty = false; $("#fname").textContent = name; $("#fname").title = name;
  buildPages(); resetHist(); renderAll(); stage.scrollTop = 0;
  showQp(!!(qp.has || S.meta.paperLink)); updateQpBtn();
  if (restored) toast("Restored your saved work.");
  if (!S.setupDone) openSetup();
}
async function makeDemo() {
  busy(true, "Preparing…");
  try {
    await document.fonts.load("34px Kalam");
    const mk = (lines) => {
      const c = document.createElement("canvas"); c.width = 1000; c.height = 1414; const x = c.getContext("2d");
      x.fillStyle = "#FFFEFA"; x.fillRect(0, 0, 1000, 1414); x.strokeStyle = "#CFD8EA"; x.lineWidth = 2;
      for (let y = 130; y < 1380; y += 52) { x.beginPath(); x.moveTo(60, y); x.lineTo(940, y); x.stroke(); }
      x.strokeStyle = "#E6A3A3"; x.beginPath(); x.moveTo(110, 0); x.lineTo(110, 1414); x.stroke();
      x.fillStyle = "#1F2F6B"; x.font = "34px Kalam"; lines.forEach((t, i) => { if (t) x.fillText(t, 130, 122 + i * 52); });
      return c.toDataURL("image/jpeg", 0.9);
    };
    const p1 = ["Q1. Explain the Coriolis force. (10 marks)", "", "Coriolis force is an apparent force that acts on", "objects moving over the rotating Earth. It is caused", "by the rotation of the Earth from west to east.", "It is maximum at the equator and zero at the poles.", "The force deflects winds to the right in the", "northern hemisphere and to the left in the southern", "hemisphere. This deflection shapes cyclones.", "", "Q2. State two causes of ocean tides. (5 marks)", "", "1) Gravitational pull of the Moon on the oceans.", "2) Gravitational pull of the Sun on the oceans."];
    const p2 = ["Q3. What is the demographic dividend? (10 marks)", "", "It is the growth benefit when the working-age", "population is larger than the dependent population.", "India’s window runs from about 2005 to 2041.", "Skilling and jobs are needed to use it well.", "", "Conclusion: policy must focus on education,", "health and employment for the youth."];
    const imgs = [await loadImg(mk(p1)), await loadImg(mk(p2))];
    S = freshS(); S.questions = [mkQ(1, 10), mkQ(2, 5), mkQ(3, 10)]; S.questions.forEach((q) => (q.type = "Short Answer"));
    S.cohort = "foundation"; S.testTotal = 25; S.setupDone = true;
    S.meta = { ...S.meta, reviewer: S.meta.reviewer || "Demo", subject: "Physics", test: "Demo test", board: "CBSE", klass: "10", paperLink: "" };
    startSession(imgs.map((im) => ({ kind: "img", img: im, w: im.naturalWidth, h: im.naturalHeight })), "demo.png", "demo", true, "Demo student");
  } catch (e) { toast("Could not prepare the demo."); }
  busy(false);
}
function openJson(txt) {
  let j; try { j = JSON.parse(txt); } catch (e) { toast("Not a valid JSON file."); return; }
  const r = applyImport(S, j, jsonMode === "draft", pages.length);
  if (r.error) { toast(r.error); return; }
  if (r.pageMismatch) toast("File has " + r.pageMismatch + " pages; this copy has " + pages.length + ".");
  normalize(S);
  if (S.questions.length) activeQ = S.questions[0].id;
  selId = null; geomAll(); pages.forEach((p) => (p.rw = 0)); $$(".pg").forEach((el) => paintPage(+el.dataset.i));
  commit(); renderAll(); updateQpBtn();
  if (!S.setupDone) openSetup();
}

/* ---------------- wiring ---------------- */
$("#btnOpen").onclick = () => openWizard();
$("#file").onchange = (e) => { const f = e.target.files; chooseCopy(f).then(() => {}); e.target.value = ""; };
$("#wizard").addEventListener("input", (e) => {
  if (e.target.id !== "wizStudent") return;
  wiz.student = e.target.value;
  const b = $("#wizStart"); if (b) b.disabled = !(wiz.pending && wiz.student.trim());
  const h = $("#wizFname"); if (h) h.textContent = fnamePreview();
});
$("#wizard").addEventListener("click", (e) => {
  const t = e.target.closest("button,[data-drop]"); if (!t) return;
  if (t.dataset.wgo) { wiz.step = +t.dataset.wgo; renderWizard(); }
  else if (t.id === "wizSkip" || t.id === "wizKeep") { wiz.step = 2; renderWizard(); }
  else if (t.id === "wizLinkGo") {
    const u = safeUrl($("#wizLink").value); if (!u) { toast("Paste a link that starts with https://"); return; }
    S.meta.paperLink = u; wiz.step = 2; renderWizard(); qpTryLink(u);
  }
  else if (t.id === "btnDemo") makeDemo();
  else if (t.id === "wizStart") startPending();
  else if (t.id === "wizCancel") closeWizard();
  else if (t.dataset.drop === "qp") $("#fileQp").click();
  else if (t.dataset.drop === "copy") $("#file").click();
});
$("#fileJson").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) f.text().then(openJson); };
$("#btnSetup").onclick = openSetup;
$("#btnQp").onclick = () => {
  if (!pages.length) { toast("Open a copy first."); return; }
  if (!$("#qpPane").hidden) { showQp(false); return; }
  if (qp.doc || qp.img) { showQp(true); qpRender(); }
  else if (S.meta.paperLink) qpTryLink(S.meta.paperLink);
  else $("#fileQp").click();
};
// drag the edge of the question paper to change how much of it shows
(function () {
  const grip = $("#qpGrip"), split = $(".split");
  let on = false;
  grip.addEventListener("pointerdown", (e) => { e.preventDefault(); on = true; try { grip.setPointerCapture(e.pointerId); } catch (err) {} grip.classList.add("on"); split.classList.add("resizing"); });
  grip.addEventListener("pointermove", (e) => {
    if (!on) return;
    const r = split.getBoundingClientRect(), f = clamp((e.clientX - r.left) / r.width, 0.2, 0.75);
    lsSet(QPW, String(f)); $("#qpPane").style.width = Math.round(r.width * f) + "px";
  });
  const end = () => { if (!on) return; on = false; grip.classList.remove("on"); split.classList.remove("resizing"); qpResized(); };
  grip.addEventListener("pointerup", end); grip.addEventListener("pointercancel", end);
  grip.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault(); lsSet(QPW, String(clamp(qpFrac() + (e.key === "ArrowRight" ? 0.03 : -0.03), 0.2, 0.75))); applyQpWidth(); qpResized();
  });
})();
$("#qpClose").onclick = () => showQp(false);
$("#qpZin").onclick = () => qpSetZoom(qpZoom + 0.25);
$("#qpZout").onclick = () => qpSetZoom(qpZoom - 0.25);
$("#qpZl").onclick = () => qpSetZoom(1);
// pinch or Ctrl/Cmd + scroll over the question paper zooms it
$("#qpBody").addEventListener("wheel", (e) => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); qpSetZoom(qpZoom + (e.deltaY < 0 ? 0.1 : -0.1)); }, { passive: false });
$("#qpLink").onclick = () => { const u = safeUrl(S.meta.paperLink); if (u) window.open(u, "_blank", "noopener,noreferrer"); };
$("#fileQp").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) qpLoad(f); };
pagesEl.addEventListener("click", (e) => { const b = e.target.closest("[data-pr]"); if (!b) return; const pg = b.closest(".pg"); if (pg) rotatePage(+pg.dataset.i, +b.dataset.pr); });
$("#btnSubmit").onclick = submitReview;
$("#btnUndo").onclick = undo; $("#btnRedo").onclick = redo;
$("#btnFb").onclick = () => { finalizeSel(); selId = null; fbOn = !fbOn; updateFbBtn(); renderOpts(); renderOverlays(); };
$("#btnExport").onclick = (e) => { e.stopPropagation(); $("#moreMenu").hidden = true; $("#menu").hidden = !$("#menu").hidden; };
$("#btnMore").onclick = (e) => { e.stopPropagation(); $("#menu").hidden = true; $("#moreMenu").hidden = !$("#moreMenu").hidden; };
document.addEventListener("click", (e) => { if (!e.target.closest(".menuWrap")) { $("#menu").hidden = true; $("#moreMenu").hidden = true; } });
$$("#menu button, #moreMenu button").forEach((b) => (b.onclick = () => {
  $("#menu").hidden = true; $("#moreMenu").hidden = true; const k = b.dataset.act;
  if (k === "json") exportGuard(saveJson);
  else if (k === "pdf") exportGuard(savePdf);
  else if (k === "html") exportGuard(saveHtml);
  else if (k === "resume" || k === "draft") { if (!pages.length) { toast("Open a copy first."); return; } jsonMode = k; $("#fileJson").click(); }
  else if (k === "reset") {
    openModal(`<h2>Clear all?</h2><p>Removes every annotation and mark on this copy.</p><div class="mfoot"><button class="btn" id="rc">Cancel</button><button class="btn primary" id="rok">Clear</button></div>`, () => {
      $("#rc").onclick = closeModal;
      $("#rok").onclick = () => { S.anns = []; S.overall = ""; S.aiLoaded = false; S.questions.forEach((q) => { q.marks = null; q.attempted = true; q.edge = []; q.params.forEach((p) => { p.marks = null; p.feedback = ""; }); }); selId = null; commit(); closeModal(); renderAll(); };
    });
  }
}));
$("#pPrev").onclick = () => goPage(curPage - 1); $("#pNext").onclick = () => goPage(curPage + 1);
$("#zIn").onclick = () => setZoom(zoom + 0.15); $("#zOut").onclick = () => setZoom(zoom - 0.15);
["dragenter", "dragover"].forEach((ev) => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.remove("drag"); }));
stage.addEventListener("drop", (e) => {
  const fs = e.dataTransfer && e.dataTransfer.files; if (!fs || !fs.length) return;
  if (!wizOn) { toast("Press New copy to open another copy."); return; }
  if (wiz.step === 1) qpLoad(fs[0]); else if (wiz.step === 3) chooseCopy(fs);
});
window.addEventListener("beforeunload", (e) => { flushSave(); if (dirty && S.anns.length) { e.preventDefault(); e.returnValue = ""; } });

buildRail(); renderAll(); resetHist(); updatePager(); openWizard(true);
// start-up: one screen (logo animation, headline, tagline, Get started); "Get started" opens the question paper page
{ const sp = $("#splash"); if (sp) { let gone = false;
  const bye = () => { if (gone) return; gone = true; sp.classList.add("out"); setTimeout(() => sp.remove(), 700); };
  sp.addEventListener("click", (e) => { if (e.target.closest("#spGo")) bye(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && !gone) bye(); }); } }
