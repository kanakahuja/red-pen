// JSON export/import, annotated PDF and HTML export.
import { PDFDocument } from "../vendor/pdf-lib.esm.min.js";
import { COLORS, RED, PENC, SPR, SPRIMG, TEAMS, PARAM_MAX, EDGE } from "./config.js";
import { uid, r4, isRect, fsOf, fsCq, mkQ, mkParams, numbered, totals, core, isEdited, rotOf, toShown, edgeSummary, countMarks, coverTotal, fileBase, testLabel } from "./model.js";

export const SCHEMA = "redpen/v1";

export function downloadFile(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: type || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- JSON ---------- */

export function buildExport({ S, pages, fileName, qpName }) {
  const nums = numbered(S), t = totals(S), es = edgeSummary(S), upsc = S.cohort === "upsc";
  const seq = new Map(S.anns.filter((a) => !a._draft).map((a, i) => [a.id, i + 1]));
  const r1 = (v) => Math.round(v * 10) / 10;
  const annotations = S.anns.filter((a) => !a._draft)
    .slice().sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
    .map((a) => {
      const o = { id: a.id, type: a.type, page: a.page + 1, question: a.total ? null : a.q, x: r4(a.x), y: r4(a.y) };
      if (a.total) o.scope = "test_total";
      if (isRect(a) || a.type === "underline" || a.type === "strike" || a.type === "text") {
        o.width = r4(a.w); if (isRect(a)) o.height = r4(a.h);
      }
      if (a.type === "text") { o.text = a.value; o.font_size = fsOf(a); o.align = a.al || "left"; o.rotation = a.rot || 0; }
      if (a.type === "pen") o.points = a.pts;
      if (a.color) { o.color = a.color; if (a.type === "box" || a.type === "underline") o.polarity = (COLORS[a.color] || COLORS.red).pol; }
      if (a.type === "box") o.number = nums[a.id];
      if (a.type === "box" || a.type === "underline") o.feedback = a.text;
      if (a.type === "score") o.score = a.value;
      if (a.type === "stamp") o.stamp = a.stamp;
      if (a.sc && a.sc !== 1) o.scale = a.sc;
      o.source = a.src === "ai" ? (isEdited(a) ? "ai_edited" : "ai") : "reviewer";
      // Where the mark is. Fractions of the page as opened (origin top-left), the same in the page's own units,
      // and, when the SME turned the page, where it appears on the turned page.
      const rect = isRect(a) || a.type === "underline" || a.type === "strike";
      const pos = rect ? { x: r4(a.x), y: r4(a.y), width: r4(a.w || 0), height: r4(isRect(a) ? a.h || 0 : 0) } : { x: r4(a.x), y: r4(a.y) };
      o.position = pos;
      const pg = pages[a.page];
      if (pg) {
        o.position_px = { x: r1(pos.x * pg.w), y: r1(pos.y * pg.h) };
        if (rect) { o.position_px.width = r1(pos.width * pg.w); o.position_px.height = r1(pos.height * pg.h); }
      }
      const rot = rotOf(S, a.page);
      if (rot) {
        o.page_rotation = rot;
        const p0 = toShown(pos.x, pos.y, rot), p1 = toShown(pos.x + (pos.width || 0), pos.y + (pos.height || 0), rot);
        o.position_as_shown = rect
          ? { x: r4(Math.min(p0[0], p1[0])), y: r4(Math.min(p0[1], p1[1])), width: r4(Math.abs(p1[0] - p0[0])), height: r4(Math.abs(p1[1] - p0[1])) }
          : { x: r4(p0[0]), y: r4(p0[1]) };
      }
      o.sequence = seq.get(a.id);
      if (a.t) o.created_at = new Date(a.t).toISOString();
      return o;
    });
  const m = S.meta;
  const meta = { copyId: m.copyId, test: m.test, student_name: m.student || "", reviewer: m.reviewer, subject: m.subject };
  if (S.cohort === "upsc") meta.test_code = m.test;
  meta.file_base = fileBase(S, "");
  if (S.cohort === "foundation") { meta.board = m.board; meta.class = m.klass; }
  if (m.paperLink) meta.question_paper_link = m.paperLink;
  const now = new Date(), started = S.startedAt ? new Date(S.startedAt) : null;
  return {
    schema: SCHEMA,
    schema_version: "1.1",
    evaluation_id: S.evalId || "",
    file: fileName,
    started_at: S.startedAt || "",
    exported_at: now.toISOString(),
    minutes_spent: started ? Math.max(1, Math.round((now - started) / 60000)) : null,
    cohort: S.cohort,
    meta,
    copy: { file: fileName, page_count: pages.length },
    question_paper: { name: qpName || "", link: m.paperLink || "" },
    position_units: "position = fractions (0 to 1) of the page as opened, origin top-left; position_px = the same in that page's own units (PDF points, or image pixels); position_as_shown = after the page was turned (see page_rotation)",
    test_total_marks: S.testTotal,
    pages: pages.map((p, i) => ({ width: Math.round(p.w), height: Math.round(p.h), rotation: rotOf(S, i) })),
    questions: S.questions.map((q) => {
      const o = { id: q.id, max_marks: q.max, question_type: upsc ? "Subjective" : (q.type || ""), marks_obtained: q.attempted ? q.marks : 0, attempted: q.attempted, objective: upsc ? false : q.objective };
      o.annotation_counts = countMarks(S, q.id);
      const mine = S.anns.filter((a) => a.q === q.id && !a._draft);
      o.pages_marked = Array.from(new Set(mine.map((a) => a.page + 1))).sort((a, b) => a - b);
      o.feedback_count = mine.filter((a) => a.type === "box" || (a.type === "underline" && String(a.text || "").trim())).length;
      o.comment = q.comment || "";
      if ((q.edge || []).length) {
        o.special_cases = q.edge.slice();
        o.special_case_details = q.edge.map((k) => ({ case: k, comment: (q.edgeNotes || {})[k] || "", needs_ops_review: !!(EDGE.find((x) => x.k === k) || {}).ops }));
      }
      if (upsc) o.parameters = q.params.map((p) => ({ name: p.name, marks: p.marks, max_marks: PARAM_MAX, feedback: p.feedback || "" }));
      return o;
    }),
    overall_summary: upsc ? S.overall : undefined,
    totals: {
      marks_obtained: t.got, total_marks: t.max, percent: +t.pct.toFixed(1), remark: t.remark,
      questions_attempted: S.questions.filter((q) => q.attempted).length,
      questions_not_attempted: S.questions.filter((q) => !q.attempted).map((q) => q.id),
    },
    needs_ops_review: es.ops,
    cover_total: (() => { const c = coverTotal(S); return c.ann ? { written: true, value: c.ann.value, matches_total: c.state === "ok", page: c.ann.page + 1, position: { x: r4(c.ann.x), y: r4(c.ann.y) } } : { written: false, expected: c.want }; })(),
    final_check: S.review || null,
    annotation_counts: countMarks(S),
    annotations,
  };
}

const TYPES = ["box", "tick", "cross", "underline", "strike", "score", "stamp", "text", "circle", "pen"];

// Loads a JSON file into S. asDraft=true marks everything as an AI draft
// (so edits are tracked); false resumes a saved review.
export function applyImport(S, json, asDraft, pageCount) {
  if (!json || !Array.isArray(json.annotations)) return { error: "No annotations in this file." };
  if (Array.isArray(json.questions) && json.questions.length) {
    S.questions = json.questions.map((q, i) => {
      const b = mkQ(q.id || i + 1, q.max_marks || 10);
      b.marks = q.marks_obtained == null ? null : q.marks_obtained;
      b.attempted = q.attempted !== false; b.objective = !!q.objective;
      b.edge = Array.isArray(q.special_cases) ? q.special_cases.slice() : [];
      b.edgeNotes = {}; (Array.isArray(q.special_case_details) ? q.special_case_details : []).forEach((d) => { if (d && d.case && d.comment) b.edgeNotes[d.case] = d.comment; });
      b.type = q.question_type || "";
      b.comment = q.comment || "";
      if (Array.isArray(q.parameters)) {
        b.params = mkParams().map((p) => {
          const f = q.parameters.find((x) => x.name === p.name);
          return f ? { name: p.name, marks: f.marks == null ? null : f.marks, feedback: f.feedback || "" } : p;
        });
      }
      return b;
    });
  }
  if (json.cohort === "foundation" || json.cohort === "upsc") S.cohort = json.cohort;
  if (json.meta) {
    ["copyId", "test", "reviewer", "subject", "board"].forEach((k) => { if (json.meta[k]) S.meta[k] = json.meta[k]; });
    if (json.meta.student_name) S.meta.student = json.meta.student_name;
    if (json.meta.class) S.meta.klass = String(json.meta.class);
    if (json.meta.question_paper_link) S.meta.paperLink = json.meta.question_paper_link;
  }
  if (json.test_total_marks > 0) S.testTotal = json.test_total_marks;
  else if (json.totals && json.totals.total_marks > 0) S.testTotal = json.totals.total_marks;
  if (Array.isArray(json.pages)) {
    json.pages.forEach((p, i) => { const r = ((+p.rotation || 0) % 360 + 360) % 360; if (r && r % 90 === 0) S.rot[i] = r; else delete S.rot[i]; });
  }
  if (json.overall_summary) S.overall = json.overall_summary;
  if (json.evaluation_id) S.evalId = json.evaluation_id;
  if (json.started_at) S.startedAt = json.started_at;
  S.anns = json.annotations.map((o) => {
    const a = { id: uid(), type: o.type, page: Math.max(0, (o.page || 1) - 1), q: o.scope === "test_total" ? 0 : (o.question || 1), x: o.x || 0, y: o.y || 0, src: asDraft ? "ai" : "reviewer" };
    if (["box", "underline", "strike", "circle", "pen", "text"].indexOf(o.type) >= 0) { a.w = o.width || 0.3; a.h = o.height || 0; }
    if (o.color) a.color = COLORS[o.color] || PENC[o.color] ? o.color : "red";
    if (o.type === "text") { a.value = o.text || ""; a.fs = o.font_size || 12; a.al = o.align || "left"; a.rot = o.rotation || 0; if (!a.color) a.color = "red"; }
    if (o.type === "pen") a.pts = o.points || [];
    if (o.type === "box" || o.type === "underline") { a.text = o.feedback || ""; if (!a.color) a.color = "red"; }
    if (o.type === "score") a.value = String(o.score == null ? "" : o.score);
    if (o.scope === "test_total") a.total = true;
    if (o.type === "stamp") a.stamp = o.stamp || "Good";
    if (o.scale) a.sc = o.scale;
    if (asDraft) a.orig = core(a);
    return a;
  }).filter((a) => TYPES.indexOf(a.type) >= 0);
  S.aiLoaded = !!asDraft;
  return { pageMismatch: json.pages && pageCount && json.pages.length !== pageCount ? json.pages.length : 0 };
}

/* ---------- drawing the marks on a page ---------- */

function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

function drawSpr(ctx, key, a, x, y, u) {
  const sp = SPR[key], im = SPRIMG[key];
  if (!sp || !im || !im.complete) return;
  const w = sp.cq * (a.sc || 1) * u, h = (w * sp.h) / sp.w;
  ctx.drawImage(im, x - w / 2, y - h / 2, w, h);
}

function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/), lines = []; let cur = "";
  words.forEach((w) => { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur);
  return lines;
}

function drawAnns(ctx, W, H, pi, S, nums) {
  const u = W / 100;
  ctx.textBaseline = "middle"; ctx.textAlign = "center";
  S.anns.filter((a) => a.page === pi && !a._draft).forEach((a) => {
    const x = a.x * W, y = a.y * H, col = COLORS[a.color] || COLORS.red;
    if (a.type === "box") {
      const c = col.hex;
      ctx.fillStyle = hexA(c, 0.12); ctx.strokeStyle = c; ctx.lineWidth = u * 0.28;
      ctx.fillRect(x, y, a.w * W, a.h * H); ctx.strokeRect(x, y, a.w * W, a.h * H);
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, u * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = `700 ${u * 1.9}px 'Reddit Sans',sans-serif`; ctx.fillText(String(nums[a.id] || ""), x, y + u * 0.05);
    } else if (a.type === "tick" || a.type === "cross") { drawSpr(ctx, a.type, a, x, y, u); }
    else if (a.type === "score") {
      const k = a.sc || 1;
      ctx.font = `700 ${u * 3.4 * k}px Kalam,cursive`;
      const txt = a.value || "0", tw = ctx.measureText(txt).width;
      ctx.strokeStyle = RED; ctx.lineWidth = u * 0.45 * k; ctx.beginPath();
      ctx.ellipse(x, y, Math.max(tw / 2 + u * 1.6 * k, u * 3.2 * k), u * 2.4 * k, -0.14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = RED; ctx.fillText(txt, x, y);
    } else if (a.type === "stamp" && SPRIMG[a.stamp]) { drawSpr(ctx, a.stamp, a, x, y, u); }
    else if (a.type === "stamp") {
      ctx.font = `400 ${u * 3.5}px Kalam,cursive`; ctx.fillStyle = RED; ctx.fillText(a.stamp, x, y);
      const tw = ctx.measureText(a.stamp).width;
      ctx.strokeStyle = RED; ctx.lineWidth = u * 0.25; ctx.beginPath(); ctx.moveTo(x - tw / 2, y + u * 2.1); ctx.lineTo(x + tw / 2, y + u * 2.1); ctx.stroke();
    } else if (a.type === "text") {
      const fpx = u * fsCq(a), maxW = (a.w || 0.4) * W, al = a.al || "left";
      ctx.save(); ctx.translate(x, y); ctx.rotate(((a.rot || 0) * Math.PI) / 180);
      ctx.textBaseline = "top"; ctx.textAlign = al; ctx.fillStyle = PENC[a.color] || RED; ctx.font = `400 ${fpx}px Kalam,cursive`;
      const tx = al === "left" ? 0 : al === "center" ? maxW / 2 : maxW; let ty = 0;
      String(a.value || "").split("\n").forEach((par) => {
        const ls = par.trim() ? wrapLines(ctx, par, maxW) : [""];
        ls.forEach((l) => { ctx.fillText(l, tx, ty); ty += fpx; });
      });
      ctx.restore(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    } else if (a.type === "circle") {
      ctx.strokeStyle = PENC[a.color] || RED; ctx.lineWidth = u * 0.4; ctx.beginPath();
      ctx.ellipse(x + (a.w * W) / 2, y + (a.h * H) / 2, (a.w * W) / 2, (a.h * H) / 2, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (a.type === "pen") {
      ctx.strokeStyle = PENC[a.color] || RED; ctx.lineWidth = u * 0.45; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
      (a.pts || []).forEach((q, k) => { const px = (a.x + q[0] * a.w) * W, py = (a.y + q[1] * a.h) * H; if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
      ctx.stroke();
    } else if (a.type === "underline" || a.type === "strike") {
      ctx.strokeStyle = a.type === "strike" ? RED : (PENC[a.color] || RED); ctx.lineWidth = u * (a.type === "strike" ? 0.4 : 0.36); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + a.w * W, y); ctx.stroke();
    }
  });
}

// Draws every page with its marks burned in, turned to the way the SME set it.
// Returns [{ canvas, w, h }] in the orientation shown on screen.
export async function renderPages({ S, pages, W, onPage, only }) {
  await Promise.all([document.fonts.load("400 24px Kalam"), document.fonts.load("700 24px Kalam"), document.fonts.load("700 24px 'Reddit Sans'")]);
  await Promise.all(Object.values(SPRIMG).map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
  const nums = numbered(S), out = [];
  for (let i = 0; i < pages.length; i++) {
    if (only && only.indexOf(i) < 0) continue;
    const p = pages[i], H = Math.round((W * p.h) / p.w);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    if (p.kind === "img") ctx.drawImage(p.img, 0, 0, W, H);
    else { const vp = p.page.getViewport({ scale: W / p.w }); await p.page.render({ canvasContext: ctx, canvas: c, viewport: vp }).promise; }
    drawAnns(ctx, W, H, i, S, nums);
    const rot = rotOf(S, i);
    let cv = c;
    if (rot) {
      const odd = rot % 180 !== 0, c2 = document.createElement("canvas");
      c2.width = odd ? H : W; c2.height = odd ? W : H;
      const x2 = c2.getContext("2d");
      if (rot === 90) x2.translate(H, 0); else if (rot === 180) x2.translate(W, H); else x2.translate(0, W);
      x2.rotate((rot * Math.PI) / 180); x2.drawImage(c, 0, 0);
      cv = c2;
    }
    out.push({ canvas: cv, w: cv.width, h: cv.height });
    if (onPage) onPage(cv, i);
  }
  return out;
}

/* ---------- PDF ---------- */

// Returns a PDF Blob: the original pages with all annotations burned in.
export async function exportPdf({ S, pages }) {
  const W = 1400, PT = 595, doc = await PDFDocument.create();
  const rendered = await renderPages({ S, pages, W });
  for (const r of rendered) {
    const b64 = r.canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    const img = await doc.embedJpg(bytes), h = (PT * r.h) / r.w;
    const pg = doc.addPage([PT, h]);
    pg.drawImage(img, { x: 0, y: 0, width: PT, height: h });
  }
  const out = await doc.save();
  return new Blob([out], { type: "application/pdf" });
}

/* ---------- HTML ---------- */

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nl = (s) => esc(s).replace(/\n/g, "<br>");

// Returns an HTML string: one self-contained page with the details, marks,
// feedback and every page of the evaluated copy.
export async function exportHtml({ S, pages, fileName }) {
  const rendered = await renderPages({ S, pages, W: 1100 });
  const nums = numbered(S), t = totals(S), upsc = S.cohort === "upsc", m = S.meta, es = edgeSummary(S);
  const date = new Date().toISOString().slice(0, 10), cnt = countMarks(S);
  const det = [["Student", m.student], ["Reviewer", m.reviewer], ["Team", TEAMS[S.cohort] || ""], ["Subject", m.subject], [testLabel(S), m.test]];
  if (S.cohort === "foundation") det.push(["Board and class", [m.board, m.klass && "Class " + m.klass].filter(Boolean).join(" · ")]);
  det.push(["Date", date], ["Copy", fileName || ""], ["Marks on the copy", String(cnt.total)]);

  const rows = S.questions.map((q) => {
    const got = q.attempted ? (q.marks == null ? "" : q.marks) : 0;
    const notes = [!q.attempted ? "Not attempted" : "", q.objective ? "Objective" : "", ...(q.edge || []).map((k) => k + ((q.edgeNotes || {})[k] ? ": " + q.edgeNotes[k] : ""))].filter(Boolean).join(" · ");
    return `<tr><td>Q${q.id}</td><td>${esc(upsc ? "Subjective" : q.type)}</td><td>${esc(q.max)}</td><td class="mk">${esc(got)}</td><td>${countMarks(S, q.id).total}</td><td>${esc(notes)}${q.comment ? `<br><i>${nl(q.comment)}</i>` : ""}</td></tr>`;
  }).join("");

  let params = "";
  if (upsc) {
    params = "<h2>Parameters</h2>" + S.questions.filter((q) => q.attempted).map((q) =>
      `<h3>Q${q.id}</h3><table><tr><th>Parameter</th><th>Marks</th><th>Feedback</th></tr>` +
      q.params.map((p) => `<tr><td>${esc(p.name)}</td><td class="mk">${esc(p.marks == null ? "" : p.marks)} / ${PARAM_MAX}</td><td class="fb">${nl(p.feedback)}</td></tr>`).join("") + "</table>").join("");
    if (S.overall && S.overall.trim()) params += `<h2>Overall summary</h2><p class="fb">${nl(S.overall)}</p>`;
  }

  const list = S.anns.filter((a) => !a._draft && (a.type === "box" || (a.type === "underline" && String(a.text || "").trim())))
    .sort((a, b) => a.q - b.q || a.page - b.page || a.y - b.y || a.x - b.x);
  const fbHtml = list.length ? "<h2>Feedback</h2>" + list.map((a) => {
    const c = (COLORS[a.color] || COLORS.red), lab = a.type === "box" ? "#" + nums[a.id] : "Underline";
    return `<div class="item" style="border-left-color:${c.hex}"><b>${lab}</b> <span class="meta">Q${a.q} · Page ${a.page + 1} · ${c.label}</span><p class="fb">${nl(a.text)}</p></div>`;
  }).join("") : "";

  const pageHtml = rendered.map((r, i) =>
    `<figure><figcaption>Page ${i + 1}</figcaption><img alt="Page ${i + 1} with marks" src="${r.canvas.toDataURL("image/jpeg", 0.82)}"></figure>`).join("");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(m.test || "Evaluation")} · ${esc(m.student)} · ${esc(m.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Reddit+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
body{margin:0;background:#F4F5F7;color:#1B2124;font:14px/1.5 'Reddit Sans',system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 60px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px}h3{font-size:13px;margin:14px 0 6px;color:#5C6670}
.card{background:#fff;border:1px solid #D9DCE1;border-radius:12px;padding:16px 18px}
dl{display:grid;grid-template-columns:130px 1fr;gap:4px 12px;margin:0}dt{color:#5C6670}dd{margin:0;font-weight:600}
.score{font:700 34px 'Kalam',cursive;color:#BF2734;line-height:1.1;margin-top:12px}.score small{font-size:15px;color:#5C6670;font-family:'Reddit Sans',sans-serif;font-weight:400}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #D9DCE1;border-radius:8px;overflow:hidden}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #E4E7EA;vertical-align:top}th{background:#F4F5F7;font-size:12px;color:#5C6670}
.mk{font-family:'Kalam',cursive;font-weight:700;color:#BF2734;font-size:16px;white-space:nowrap}
.fb{font-family:'Kalam',cursive;font-size:14px;line-height:18px}
.item{background:#fff;border:1px solid #D9DCE1;border-left:5px solid;border-radius:8px;padding:8px 12px;margin-bottom:8px}.item p{margin:4px 0 0}.meta{color:#5C6670;font-size:12px}
figure{margin:18px 0}figcaption{font-size:12px;color:#5C6670;margin-bottom:4px}img{width:100%;height:auto;display:block;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.25)}
@media print{body{background:#fff}figure{break-inside:avoid}}
</style></head><body><main>
<h1>${esc(m.test || "Evaluation")}</h1>
<div class="card"><dl>${det.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
<div class="score">${esc(t.got)} <small>out of ${esc(t.max)} · ${t.pct.toFixed(0)}% · ${esc(t.remark)}</small></div>${es.ops ? '<p class="meta">Flagged for Ops review.</p>' : ""}</div>
<h2>Marks</h2><table><tr><th>Question</th><th>Type</th><th>Max</th><th>Marks</th><th>Marks on copy</th><th>Notes</th></tr>${rows}</table>
${params}${fbHtml}
<h2>Evaluated copy</h2>${pageHtml}
</main></body></html>`;
}
