// The downloaded HTML: the student-facing Result Experience (cover, UPSC parameter and overall pages, the evaluated copy
// with numbered highlights and their feedback, Hide feedback, thumbs, report, rating).
// It is built from the canonical result (result.js) and the rendered pages. The file is self-contained.
import { toShown } from "./model.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nl = (s) => esc(s).replace(/\n/g, "<br>");
const pc = (v) => (Math.round(v * 10000) / 100) + "%";
const num = (v) => (v == null || v === "" ? "–" : String(Math.round(v * 100) / 100));

// Reasons from PRD 4.6 / 4.7, so they can be read back from the saved responses.
export const REPORT_REASONS = ["Feedback is wrong", "Feedback is too generic", "Hard to understand feedback", "Feedback is on the wrong point", "Highlight colour is wrong", "Highlight is misplaced", "Other"];
export const RATING_BANDS = [
  { max: 2, head: "Your feedback will help us improve. What should we fix first?", opts: ["Marks are not correct", "Feedback not helpful", "Model answer incorrect", "Uploading file issue", "Poor overall experience", "Other"] },
  { max: 3, head: "You're helping us get better. What can we improve?", opts: ["Marking more accurate", "Feedback more detailed", "Improve model answers", "Better overall experience", "Faster evaluation", "Other"] },
  { max: 5, head: "Glad it helped! What worked best for you?", opts: ["Accurate marking", "Quality of feedback", "Helpful model answers", "Great overall experience", "Fast evaluation", "Other"] },
];

function coverHtml(R) {
  const c = R.cover, name = R.student.name || "Student";
  const det = c.fields.filter((f) => f.label !== "Student name").map((f) => `<span><b>${esc(f.label)}</b> ${esc(f.value)}</span>`).join("");
  const hasNotes = R.questions.some((q) => q.notes && q.notes.length);
  const rows = R.questions.map((q) => `<tr><td>${q.number}</td><td>${esc(q.question_type || "–")}</td><td>${num(q.max_marks)}</td><td class="mk">${q.attempted ? num(q.marks_obtained) : "0"}</td><td>${q.marks_on_copy == null ? "–" : q.marks_on_copy}</td><td class="nt">${q.attempted ? "" : "<b>Not attempted</b>"}${(q.notes || []).map((n) => nl(n)).join("<br>")}${!q.attempted && !(q.notes || []).length ? "" : ""}</td></tr>`).join("");
  return `<section class="sheet cover" id="cover"><header class="brand"><span class="logo"></span>Result</header>
<div class="ctop"><div><h1>${esc(name)}</h1><p class="det">${det}</p></div>
<div class="score"><div class="ring"><span>${num(c.marks_obtained)}<i>/${num(c.total_marks)}</i></span></div><em class="rm ${c.remark.tone}">${esc(c.remark.text)}</em></div></div>
<h2 class="ctr">Question-wise Performance</h2>
<div class="tw"><table class="qt"><thead><tr><th>Ques no.</th><th>Question type</th><th>Max marks</th><th>Marks obtained</th><th>Marks on copy</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function paramsHtml(R) {
  if (!R.parameters) return "";
  const body = R.questions.filter((q) => q.attempted && q.parameters).map((q) => `<h3>Q${q.number} <small>${num(q.marks_obtained)} / ${num(q.max_marks)}</small></h3>
<table class="pt"><thead><tr><th>Parameter</th><th>Marks</th><th>Feedback</th></tr></thead><tbody>${q.parameters.map((p) => `<tr><td>${esc(p.name)}</td><td class="mk">${num(p.marks)} / ${p.max_marks}</td><td class="fbt">${nl(p.feedback)}</td></tr>`).join("")}</tbody></table>`).join("");
  return `<section class="sheet" id="params"><h2 class="ctr">Summary</h2><p class="sub">Parameter-wise marks (out of ${R.parameters.max_marks})</p>${body || "<p class='sub'>No attempted questions.</p>"}</section>`;
}
function overallHtml(R) {
  if (!R.overall) return "";
  const list = (t, a) => (a && a.length ? `<h3>${t}</h3><ul>${a.map((x) => `<li>${nl(x)}</li>`).join("")}</ul>` : "");
  const s = R.overall.summary ? `<p class="fbt">${nl(R.overall.summary)}</p>` : `<p class="sub">No overall feedback was written.</p>`;
  return `<section class="sheet" id="overall"><h2 class="ctr">Overall Feedback</h2>${s}${list("Strengths", R.overall.strengths)}${list("Improvements", R.overall.improvements)}</section>`;
}

function overlay(f, a, rot) {
  const isBox = f.kind === "box", w = a.w || 0, h = isBox ? a.h || 0 : 0;
  const p1 = toShown(a.x, a.y, rot), p2 = toShown(a.x + w, a.y + h, rot);
  const x0 = Math.min(p1[0], p2[0]), x1 = Math.max(p1[0], p2[0]), y0 = Math.min(p1[1], p2[1]), y1 = Math.max(p1[1], p2[1]);
  const box = `<div class="bx c-${f.color}${isBox ? "" : " ul"}" id="b${f.id}" data-bx="${f.id}" data-tg="${f.id}" data-n="${f.order}" style="left:${pc(x0)};top:${pc(y0)};width:${pc(x1 - x0)};height:${pc(y1 - y0)}"><button type="button" class="bd" data-tg="${f.id}" aria-label="Feedback ${esc(f.label)}">${esc(f.label)}</button></div>`;
  const card = `<div class="fbk c-${f.color}" data-for="${f.id}" role="region" aria-label="Feedback ${esc(f.label)}"><i class="ar"></i><span class="bar"></span><p><b class="chip">${esc(f.label)}</b>${nl(f.text)}</p>
<div class="act"><button type="button" class="th" data-r="up" data-fid="${f.id}" aria-label="Helpful"><svg viewBox="0 0 24 24"><path d="M7 11v9H4v-9h3zm0 0l4-8c1.5 0 2.5 1 2.5 2.5V9H19a2 2 0 012 2.3l-1.2 7A2 2 0 0117.800 20H7"/></svg></button><button type="button" class="th" data-r="down" data-fid="${f.id}" aria-label="Not helpful"><svg viewBox="0 0 24 24" style="transform:rotate(180deg)"><path d="M7 11v9H4v-9h3zm0 0l4-8c1.5 0 2.5 1 2.5 2.5V9H19a2 2 0 012 2.3l-1.2 7A2 2 0 0117.800 20H7"/></svg></button><button type="button" class="rp" data-rep="${f.id}">Report</button></div></div>`;
  return { box, card };
}

export function buildHtml({ R, S, rendered }) {
  const feedback = R.feedback, byId = {};
  S.anns.forEach((a) => (byId[a.id] = a));
  const cards = [];
  const pageHtml = rendered.map((r, i) => {
    const rot = (S.rot && S.rot[i]) || 0;
    const ov = feedback.filter((f) => f.page === i + 1 && byId[f.id]).map((f) => { const o = overlay(f, byId[f.id], rot); cards.push(o.card); return o.box; }).join("");
    const mk = r.marks ? `<img class="mk" alt="" src="${r.marks.toDataURL("image/png")}">` : "";
    return `<figure><figcaption>Page ${i + 1}</figcaption><div class="pg" style="aspect-ratio:${r.w}/${r.h}"><img class="base" alt="Page ${i + 1} of the answer copy" src="${r.canvas.toDataURL("image/jpeg", 0.82)}">${mk}${ov}</div></figure>`;
  }).join("");
  const t = R.cover, title = (R.test.name || R.test.code || "Result") + " · " + (R.student.name || "");
  const meta = { eval: R.evaluation.id || R.evaluation.file_base, cohort: R.cohort, student: R.student.name, testId: R.test.id, test: R.test.name || R.test.code, name: "redpen.result." + (R.evaluation.id || R.evaluation.file_base || "copy"), items: feedback.map((f) => ({ id: f.id, q: f.question, n: f.label, color: f.color, polarity: f.polarity, kind: f.kind, page: f.page, text: f.text })) };
  const eye = `<svg class="off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c5 0 8.5 3.5 10 6-.6 1-1.5 2.2-2.700 3.300M6.600 6.700C4.500 8 3 10 2 12c1.500 2.500 5 6 10 6 1.500 0 2.800-.3 4-.8M9.900 9.900a3 3 0 004.200 4.200"/></svg><svg class="on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c1.500-2.500 5-6 10-6s8.500 3.500 10 6c-1.500 2.500-5 6-10 6S3.500 14.500 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Reddit+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;background:#E9EBEF;color:#1B2124;font:14px/1.5 'Reddit Sans',system-ui,sans-serif;padding-bottom:24px}
main{max-width:760px;margin:0 auto}
.hd{position:sticky;top:0;z-index:30;background:#fff;border-bottom:1px solid #D9DCE1;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px}.hd b{font-size:15px}
.hd .r{display:flex;gap:8px}
.pill{display:inline-flex;align-items:center;gap:7px;border:1px solid #E1E6F5;background:#EEF2FF;color:#3F4A6B;font:500 13px 'Reddit Sans',sans-serif;border-radius:999px;padding:7px 13px;cursor:pointer}.pill svg{width:17px;height:17px}.pill .on{display:none}.hidefb .pill .on{display:block}.hidefb .pill .off{display:none}
.sheet{background:#fff;margin:12px 0;padding:18px 18px 22px}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:#5C6670;margin-bottom:10px}.logo{width:22px;height:22px;border-radius:6px;background:#BF2734;display:inline-block}
.ctop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}h1{font-size:22px;margin:0 0 6px;font-weight:700}
.det{display:flex;flex-wrap:wrap;gap:4px 14px;margin:0;color:#3A444C;font-size:13px}.det b{color:#5C6670;font-weight:500;margin-right:3px}
.score{text-align:center}.ring{border:3px solid #BF2734;border-radius:50%;padding:14px 20px;min-width:104px;transform:rotate(-6deg);font:700 30px/1 'Kalam',cursive;color:#BF2734}.ring i{font-style:normal;font-size:17px}
.rm{display:block;margin-top:6px;font:700 17px 'Kalam',cursive;color:#BF2734;transform:rotate(-4deg)}
h2.ctr{text-align:center;font-size:15px;margin:22px 0 10px;font-weight:600}h3{font-size:13px;margin:18px 0 6px}h3 small{color:#5C6670;font-weight:500}.sub{color:#5C6670;text-align:center;margin:0 0 8px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 10px;border:1px solid #E1E4E8;vertical-align:top}th{background:#F4F5F7;font-size:12px;color:#5C6670;font-weight:600}
.tw{overflow-x:auto}.qt td,.qt th{text-align:center}.qt td.nt{text-align:left;font-size:13px;min-width:140px}.mk{font:700 16px 'Kalam',cursive;color:#BF2734;white-space:nowrap}.fbt{font:400 15px/1.5 'Kalam',cursive;color:#BF2734;margin:0}.sheet ul{margin:0;padding-left:20px}.sheet li{font:400 15px/1.5 'Kalam',cursive;color:#BF2734;margin:3px 0}
figure{margin:12px 0}figcaption{font-size:12px;color:#5C6670;margin:0 14px 4px}
.pg{position:relative;width:100%;container-type:inline-size;background:#fff}.pg>img.base{width:100%;height:100%;display:block}.pg>img.mk{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.hidefb .pg>img.mk{display:none}
.bx{position:absolute;box-sizing:border-box;border:2px dotted var(--h);background:var(--t);border-radius:5px;z-index:2}.bx.ul{border:0;background:none}
.bx.c-red{--h:#F04438;--i:#D92D20;--t:rgba(240,68,56,.1);--g:rgba(240,68,56,.22)}.bx.c-yellow{--h:#EAAA2E;--i:#A15C07;--t:rgba(234,170,46,.12);--g:rgba(234,170,46,.28)}.bx.c-green{--h:#16B364;--i:#067647;--t:rgba(22,179,100,.1);--g:rgba(22,179,100,.24)}
.bx{cursor:pointer;-webkit-tap-highlight-color:transparent}.bx.act{box-shadow:0 0 0 2px var(--h)}
.bd{position:absolute;right:0;bottom:0;transform:translate(42%,42%);min-width:clamp(17px,3.8cqw,26px);height:clamp(17px,3.8cqw,26px);padding:0 4px;border:0;border-radius:6px;background:var(--h);color:#fff;font:700 clamp(10px,2.3cqw,15px)/1 'Reddit Sans',sans-serif;box-shadow:0 0 0 clamp(4px,1.1cqw,8px) var(--g);cursor:pointer;z-index:3}.c-green .bd{background:var(--i)}
#fbdock{position:fixed;right:12px;bottom:12px;z-index:50;width:min(calc(100vw - 24px),400px);pointer-events:none}
.fbk{position:relative;display:none;pointer-events:auto;max-height:46vh;overflow:auto;background:#fff;border-radius:10px;box-shadow:0 4px 16px rgba(16,24,40,.28);--ink:#D92D20;--h:#F04438}
.fbk.on{display:block}.fbk.c-yellow{--ink:#A15C07;--h:#EAAA2E}.fbk.c-green{--ink:#067647;--h:#16B364}
.fbk .bar{position:absolute;left:0;right:0;top:0;height:9px;border-radius:10px 10px 0 0;background:linear-gradient(var(--h) 0 5px,color-mix(in srgb,var(--h) 35%,#fff) 5px)}
.fbk .ar{display:none}
.fbk p{margin:0;padding:18px 16px 6px;font:400 16px/1.45 'Kalam',cursive;color:var(--ink);overflow-wrap:anywhere}
.fbk .chip{display:inline-block;margin-right:8px;min-width:18px;padding:0 5px;border-radius:5px;background:var(--h);color:#fff;font:700 11px/18px 'Reddit Sans',sans-serif;text-align:center;vertical-align:1px}
.fbk .act{display:flex;align-items:center;gap:6px;padding:0 16px 10px}
.th{width:30px;height:30px;border-radius:50%;border:1px solid #D9DCE1;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}.th svg{width:16px;height:16px;fill:none;stroke:#5C6670;stroke-width:1.8;stroke-linejoin:round}
.th.sel{background:#1B2124;border-color:#1B2124}.th.sel svg{stroke:#fff}
.rp{margin-left:auto;border:0;background:none;color:#5C6670;font:500 12px 'Reddit Sans',sans-serif;text-decoration:underline;cursor:pointer}
.hidefb .bx,.hidefb .fbk,.hidefb #fbdock{display:none!important}
.rate{background:#fff;margin:12px 0;padding:16px;text-align:center}.rate button{border:1px solid #D9DCE1;background:#fff;border-radius:999px;padding:8px 16px;font:500 13px 'Reddit Sans',sans-serif;cursor:pointer}
.foot{text-align:center;font-size:12px;color:#5C6670;padding:6px 14px 20px}.foot a{color:#3F4A6B;cursor:pointer;text-decoration:underline}
.sh{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.5);display:none;align-items:flex-end;justify-content:center}.sh.on{display:flex}
.sh .card{background:#fff;width:100%;max-width:520px;border-radius:16px 16px 0 0;padding:18px 18px 20px;max-height:86vh;overflow:auto}
.sh h4{margin:0 0 4px;font-size:16px}.sh .q{color:#5C6670;font-size:12.5px;margin:0 0 10px}
.sh label{display:flex;gap:8px;align-items:center;padding:8px 2px;font-size:14px}.sh textarea{width:100%;min-height:64px;border:1px solid #D9DCE1;border-radius:8px;padding:8px;font:inherit;margin-top:6px}
.sh .btns{display:flex;gap:8px;margin-top:12px}.sh .btns button{flex:1;border-radius:10px;padding:11px;font:600 14px 'Reddit Sans',sans-serif;border:1px solid #1B2124;background:#fff;cursor:pointer}.sh .btns .go{background:#1B2124;color:#fff}.sh .btns .go:disabled{opacity:.35;cursor:default}
.stars{display:flex;gap:6px;justify-content:center;margin:8px 0}.stars button{border:0;background:none;font-size:34px;line-height:1;color:#C9CED4;cursor:pointer;padding:0 2px}.stars button.on{color:#F5B301}
.err{color:#D92D20;font-size:12.5px;margin-top:4px}
@media print{body{background:#fff;padding:0}.hd,.rate,.foot,.sh{display:none}#fbdock{position:static;width:auto}.fbk{display:block!important;max-height:none;margin:4px 0}.fbk .act,.fbk .ar{display:none}figure{break-inside:avoid}}
</style></head><body>
<div class="hd"><b>${esc(R.test.name || R.test.code || "Result")}</b><div class="r"><button type="button" class="pill" id="repAll">Report</button>${feedback.length || R.handwritten.length ? `<button type="button" class="pill" id="tgAll"><span class="off">Hide Feedback</span><span class="on">Show Feedback</span>${eye}</button>` : ""}</div></div>
<main id="tabYour">${coverHtml(R)}${paramsHtml(R)}${overallHtml(R)}${pageHtml}
<div class="rate"><p style="margin:0 0 8px">How was this result?</p><button type="button" id="rateBtn">Rate this result</button></div></main>
<div class="foot">Your reactions and ratings stay on this device. <a id="saveResp">Save my responses (JSON)</a></div>
<div id="fbdock">${cards.join("")}</div>
<div class="sh" id="sheet"><div class="card" id="sheetBody"></div></div>
<script>
(function(){
var M=${JSON.stringify(meta).replace(/</g, "\\u003c")};
var root=document.documentElement,REASONS=${JSON.stringify(REPORT_REASONS)},BANDS=${JSON.stringify(RATING_BANDS)};
var KEY=M.name,st={reactions:{},ratings:null};
try{var sv=localStorage.getItem(KEY);if(sv)st=JSON.parse(sv);}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(st));}catch(e){}}
function $(s,r){return (r||document).querySelector(s);}function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
var items={};M.items.forEach(function(i){items[i.id]=i;});
/* one card open at a time */
var active=null,pinned=null;
function place(){}
function open(id){
  active=id;
  $$(".fbk").forEach(function(c){c.classList.toggle("on",c.getAttribute("data-for")===id);});
  $$(".bx").forEach(function(b){b.classList.toggle("act",b.getAttribute("data-bx")===id);});
  place();paintReactions();
}
function closeAll(){active=null;$$(".fbk.on").forEach(function(c){c.classList.remove("on");});$$(".bx.act").forEach(function(b){b.classList.remove("act");});}
/* the highlight nearest the reading line opens as the student scrolls (first from the top opens first) */
var boxes=$$(".bx").sort(function(a,b){return (+a.getAttribute("data-n"))-(+b.getAttribute("data-n"));});
function visible(b){var r=b.getBoundingClientRect(),vh=window.innerHeight;return r.bottom>70&&r.top<vh-60;}
function auto(){
  if(root.classList.contains("hidefb")||!boxes.length)return;
  if(pinned&&visible($('[data-bx="'+pinned+'"]')))return;pinned=null;
  var line=window.innerHeight*0.38,best=null,bd=1e9;
  boxes.forEach(function(b){var r=b.getBoundingClientRect();if(r.bottom<70||r.top>window.innerHeight-60)return;var d=Math.abs((r.top+r.bottom)/2-line);if(d<bd){bd=d;best=b;}});
  if(!best){return;}
  var id=best.getAttribute("data-bx");if(id!==active)open(id);
}
var raf=0;window.addEventListener("scroll",function(){cancelAnimationFrame(raf);raf=requestAnimationFrame(auto);},{passive:true});
window.addEventListener("resize",function(){place();});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){place();});
/* thumbs */
function paintReactions(){$$(".th").forEach(function(t){var r=st.reactions[t.getAttribute("data-fid")];t.classList.toggle("sel",!!r&&r.reaction===t.getAttribute("data-r"));});}
function rec(f){var i=items[f];return {feedback_id:f,question_id:i.q,test_id:M.testId||null,test:M.test||null,student_name:M.student,cohort:M.cohort,platform:"html",feedback:{number:i.n,color:i.color,polarity:i.polarity,type:i.kind,page:i.page,text:i.text},timestamp:new Date().toISOString()};}
function react(f,v,options,comment){var r=st.reactions[f]||rec(f);r.reaction=v;r.options=options||[];r.comment=comment||"";r.timestamp=new Date().toISOString();st.reactions[f]=r;save();paintReactions();}
/* sheets */
var sheet=$("#sheet"),body=$("#sheetBody");
function show(h){body.innerHTML=h;sheet.classList.add("on");}function hide(){sheet.classList.remove("on");}
sheet.addEventListener("click",function(e){if(e.target===sheet)hide();});
function reasonSheet(title,sub,opts,onSubmit,needOther){
  var h='<h4>'+title+'</h4><p class="q">'+sub+'</p>'+opts.map(function(o,i){return '<label><input type="checkbox" value="'+o+'"> '+o+'</label>';}).join("")+'<textarea id="rcm" placeholder="Add a comment (optional)"></textarea><div class="err" id="rer" hidden></div><div class="btns"><button type="button" id="rno">Cancel</button><button type="button" class="go" id="rgo" disabled>Submit</button></div>';
  show(h);var go=$("#rgo");
  function sync(){var sel=$$("input:checked",body).map(function(x){return x.value;});go.disabled=!sel.length;}
  body.onchange=sync;
  $("#rno").onclick=hide;
  go.onclick=function(){var sel=$$("input:checked",body).map(function(x){return x.value;}),cm=$("#rcm").value.trim();
    if(sel.indexOf("Other")>=0&&!cm){var e=$("#rer");e.textContent="Please add a comment when you choose Other.";e.hidden=false;return;}
    onSubmit(sel,cm);hide();};
}
function reportFb(f){reasonSheet("What can be improved?","Highlight "+items[f].n+" · Q"+items[f].q,REASONS,function(sel,cm){react(f,(st.reactions[f]&&st.reactions[f].reaction)||"down",sel,cm);});}
document.addEventListener("click",function(e){
  var t=e.target.closest&&e.target.closest("[data-tg]");
  if(t){var id=t.getAttribute("data-tg"),onBadge=!!e.target.closest(".bd");if(active===id&&onBadge){closeAll();pinned=null;}else{pinned=id;open(id);}return;}
  var th=e.target.closest&&e.target.closest(".th");
  if(th){var f=th.getAttribute("data-fid"),v=th.getAttribute("data-r");
    if(v==="up"){react(f,"up",[],"");}else{react(f,"down",[],"");reportFb(f);}return;}
  var rp=e.target.closest&&e.target.closest("[data-rep]");if(rp){reportFb(rp.getAttribute("data-rep"));return;}
  if(e.target.closest&&e.target.closest("#tgAll")){root.classList.toggle("hidefb");return;}
  if(e.target.closest&&e.target.closest("#repAll")){
    reasonSheet("Report on this evaluation","The whole result: "+(M.test||""),["Marks are not correct","Feedback not helpful","Highlights are misplaced","Model answer incorrect","Other"],function(sel,cm){st.complete_reports=(st.complete_reports||[]).concat([{scope:"complete_evaluation",test_id:M.testId||null,test:M.test||null,student_name:M.student,cohort:M.cohort,platform:"html",options:sel,comment:cm,timestamp:new Date().toISOString()}]);save();});return;}
  if(e.target.closest&&e.target.closest("#rateBtn")){rate();return;}
  if(e.target.closest&&e.target.closest("#saveResp")){var b=new Blob([JSON.stringify({reactions:Object.keys(st.reactions).map(function(k){return st.reactions[k];}),complete_reports:st.complete_reports||[],overall_rating:st.ratings},null,2)],{type:"application/json"});var a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=M.name+".responses.json";document.body.appendChild(a);a.click();a.remove();return;}
});
function rate(){
  var stars=0;
  show('<h4>Rate this result</h4><p class="q" id="rq">Pick 1 to 5 stars.</p><div class="stars">'+[1,2,3,4,5].map(function(n){return '<button type="button" data-s="'+n+'" aria-label="'+n+' stars">★</button>';}).join("")+'</div><div id="ropts"></div><textarea id="rcm" placeholder="Add a comment (optional)" hidden></textarea><div class="err" id="rer" hidden></div><div class="btns"><button type="button" id="rno">Not now</button><button type="button" class="go" id="rgo" disabled>Submit</button></div>');
  $("#rno").onclick=hide;
  body.onclick=function(e){var s=e.target.closest&&e.target.closest("[data-s]");if(!s)return;stars=+s.getAttribute("data-s");
    $$("[data-s]",body).forEach(function(b){b.classList.toggle("on",+b.getAttribute("data-s")<=stars);});
    var band=BANDS.filter(function(b){return stars<=b.max;})[0];$("#rq").textContent=band.head;
    $("#ropts").innerHTML=band.opts.map(function(o){return '<label><input type="checkbox" value="'+o+'"> '+o+'</label>';}).join("");$("#rcm").hidden=false;$("#rgo").disabled=false;};
  $("#rgo").onclick=function(){var sel=$$("#ropts input:checked").map(function(x){return x.value;}),cm=$("#rcm").value.trim();
    if(sel.indexOf("Other")>=0&&!cm){var e=$("#rer");e.textContent="Please add a comment when you choose Other.";e.hidden=false;return;}
    st.ratings={stars:stars,options:sel,comment:cm,test_id:M.testId||null,test:M.test||null,student_name:M.student,cohort:M.cohort,platform:"html",timestamp:new Date().toISOString()};save();body.onclick=null;hide();};
}
paintReactions();
})();
</script></body></html>`;
}
