// JSON export/import, annotated PDF and HTML export.
import { PDFDocument } from "../vendor/pdf-lib.esm.min.js";
import { COLORS, RED, PENC, SPR, SPRIMG, TEAMS, PARAM_MAX, EDGE } from "./config.js";
import { buildResult } from "./result.js";
import { frontPages, feedbackPages } from "./pdfpages.js";
import { buildHtml } from "./resulthtml.js";
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
      if (a.param) o.parameter = a.param;
      if (a.ds) o.ds_ref = a.ds;
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
  const now = new Date();
  const m = S.meta;
  const meta = { copyId: m.copyId, test: m.test, student_name: m.student || "", reviewer: m.reviewer, subject: m.subject };
  if (S.cohort === "upsc") meta.test_code = m.test;
  meta.file_base = fileBase(S, "");
  if (S.cohort === "foundation") { meta.board = m.board; meta.class = m.klass; }
  if (m.paperLink) meta.question_paper_link = m.paperLink;
  if (m.contact) meta.contact = m.contact;
  if (m.testDate) meta.test_date = m.testDate;
  const started = S.startedAt ? new Date(S.startedAt) : null;
  const R = buildResult({ S, pages, fileName, qpName, now });
  return {
    schema: SCHEMA,
    schema_version: "1.2",
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
    pages: pages.map((p, i) => { const g = S.ds && S.ds.manifest && (S.ds.manifest.pageGeometry || []).find((x) => x.page === i + 1); return { width: Math.round(p.w), height: Math.round(p.h), rotation: rotOf(S, i), ...(g ? { source_rotation: g.rotation || 0 } : {}) }; }),
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
    // Canonical, cohort-aware result. The HTML and PDF are built from the same data. Original DS files are kept as they came.
    student: R.student, test: R.test, cohort_details: R.cohort_details,
    result: { marks_obtained: R.cover.marks_obtained, total_marks: R.cover.total_marks, percent: R.cover.percent, remark: R.cover.remark },
    parameters_config: R.parameters, overall: R.overall,
    feedback_index: R.feedback.map((f) => ({ id: f.id, order: f.order, number: f.number, label: f.label, question: f.question, page: f.page, color: f.color, polarity: f.polarity, parameter: f.parameter })),
    handwritten_index: R.handwritten.map((h) => ({ id: h.id, order: h.order, type: h.type, question: h.question, page: h.page })),
    evaluation: R.evaluation, model_answers: R.model_answers,
    feedback_interactions: R.feedback_interactions, overall_rating: R.overall_rating,
    data_gaps: R.data_gaps, warnings: R.warnings,
    ds_source: S.ds || null,
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
  if (json.ds_source) S.ds = json.ds_source;
  if (json.meta) { if (json.meta.contact) S.meta.contact = json.meta.contact; if (json.meta.test_date) S.meta.testDate = json.meta.test_date; }
  if (json.started_at) S.startedAt = json.started_at;
  S.anns = json.annotations.map((o) => {
    const a = { id: uid(), type: o.type, page: Math.max(0, (o.page || 1) - 1), q: o.scope === "test_total" ? 0 : (o.question || 1), x: o.x || 0, y: o.y || 0, src: asDraft ? "ai" : "reviewer" };
    if (["box", "underline", "strike", "circle", "pen", "text"].indexOf(o.type) >= 0) { a.w = o.width || 0.3; a.h = o.height || 0; }
    if (o.color) a.color = COLORS[o.color] || PENC[o.color] ? o.color : "red";
    if (o.type === "text") { a.value = o.text || ""; a.fs = o.font_size || 12; a.al = o.align || "left"; a.rot = o.rotation || 0; if (!a.color) a.color = "red"; }
    if (o.type === "pen") a.pts = o.points || [];
    if (o.type === "box" || o.type === "underline") { a.text = o.feedback || ""; if (!a.color) a.color = "red"; }
    if (o.type === "score") a.value = String(o.score == null ? "" : o.score);
    if (o.parameter) a.param = o.parameter;
    if (o.ds_ref) a.ds = o.ds_ref;
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

// Draws the marks on a page canvas that is already turned (W x H as shown). Marks are stored on the page as opened,
// so each point goes through toShown(). The marks themselves stay upright. Sizes follow the opened width, as on screen.
function drawAnns(ctx, W, H, pi, S, nums, skipBoxes, rot) {
  rot = rot || 0;
  const Wo = rot % 180 !== 0 ? H : W, u = Wo / 100;
  const P = (fx, fy) => { const s = toShown(fx, fy, rot); return [s[0] * W, s[1] * H]; };
  ctx.textBaseline = "middle"; ctx.textAlign = "center";
  S.anns.filter((a) => a.page === pi && !a._draft).forEach((a) => {
    const [x, y] = P(a.x, a.y), col = COLORS[a.color] || COLORS.red;
    if (a.type === "box" && skipBoxes) return;
    if (a.type === "box") {
      const c = col.hex, q = P(a.x + a.w, a.y + a.h), bx = Math.min(x, q[0]), by = Math.min(y, q[1]), bw = Math.abs(q[0] - x), bh = Math.abs(q[1] - y);
      ctx.fillStyle = hexA(c, 0.12); ctx.strokeStyle = c; ctx.lineWidth = u * 0.28;
      ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(bx, by, u * 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = `700 ${u * 1.9}px 'Reddit Sans',sans-serif`; ctx.fillText(String(nums[a.id] || ""), bx, by + u * 0.05);
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
      const fpx = u * fsCq(a), maxW = (a.w || 0.4) * Wo, al = a.al || "left";
      ctx.textBaseline = "top"; ctx.textAlign = al; ctx.fillStyle = PENC[a.color] || RED; ctx.font = `400 ${fpx}px Kalam,cursive`;
      const lines = [];
      String(a.value || "").split("\n").forEach((par) => { (par.trim() ? wrapLines(ctx, par, maxW) : [""]).forEach((l) => lines.push(l)); });
      // The box grows away from its corner on the answer, like on screen.
      const ox = rot === 90 || rot === 180 ? -maxW : 0, oy = rot === 180 || rot === 270 ? -lines.length * fpx : 0;
      ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(((a.rot || 0) * Math.PI) / 180);
      const tx = al === "left" ? 0 : al === "center" ? maxW / 2 : maxW;
      lines.forEach((l, k) => ctx.fillText(l, tx, k * fpx));
      ctx.restore(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    } else if (a.type === "circle") {
      const q = P(a.x + a.w, a.y + a.h);
      ctx.strokeStyle = PENC[a.color] || RED; ctx.lineWidth = u * 0.4; ctx.beginPath();
      ctx.ellipse((x + q[0]) / 2, (y + q[1]) / 2, Math.abs(q[0] - x) / 2, Math.abs(q[1] - y) / 2, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (a.type === "pen") {
      ctx.strokeStyle = PENC[a.color] || RED; ctx.lineWidth = u * 0.45; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
      (a.pts || []).forEach((q, k) => { const s = P(a.x + q[0] * a.w, a.y + q[1] * a.h); if (k === 0) ctx.moveTo(s[0], s[1]); else ctx.lineTo(s[0], s[1]); });
      ctx.stroke();
    } else if (a.type === "underline" || a.type === "strike") {
      const q = P(a.x + a.w, a.y);
      ctx.strokeStyle = a.type === "strike" ? RED : (PENC[a.color] || RED); ctx.lineWidth = u * (a.type === "strike" ? 0.4 : 0.36); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
  });
}

// Draws every page with its marks burned in, turned to the way the SME set it.
// Returns [{ canvas, w, h }] in the orientation shown on screen.
export async function renderPages({ S, pages, W, onPage, only, skipBoxes, split }) {
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
    // Turn the page first, then draw the marks on the turned page so they stay upright.
    const cx = cv.getContext("2d"); cx.setTransform(1, 0, 0, 1, 0, 0);
    let marks = null;
    if (split) {
      // The page stays clean and the marks go on a transparent layer, so "Hide feedback" can hide them.
      if (S.anns.some((a) => a.page === i && !a._draft && a.type !== "box")) {
        marks = document.createElement("canvas"); marks.width = cv.width; marks.height = cv.height;
        drawAnns(marks.getContext("2d"), cv.width, cv.height, i, S, nums, true, rot);
      }
    } else drawAnns(cx, cv.width, cv.height, i, S, nums, skipBoxes, rot);
    out.push({ canvas: cv, marks, w: cv.width, h: cv.height });
    if (onPage) onPage(cv, i);
  }
  return out;
}

/* ---------- PDF ---------- */

// Returns a PDF Blob: cover (and, for UPSC, parameter-wise marks and overall feedback), the copy with its marks burned in,
// then one consolidated feedback section whose numbers and colours match the highlights.
export async function exportPdf({ S, pages, fileName, qpName }) {
  const W = 1400, PT = 595, doc = await PDFDocument.create();
  await Promise.all([document.fonts.load("400 24px Kalam"), document.fonts.load("700 24px Kalam"), document.fonts.load("400 24px 'Reddit Sans'"), document.fonts.load("600 24px 'Reddit Sans'"), document.fonts.load("700 24px 'Reddit Sans'")]);
  const R = buildResult({ S, pages, fileName, qpName });
  const rendered = await renderPages({ S, pages, W });
  const embed = async (cv, q) => {
    const b64 = cv.toDataURL("image/jpeg", q).split(",")[1];
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    return doc.embedJpg(bytes);
  };
  const front = frontPages(R);
  for (const cv of front) { const img = await embed(cv, 0.92), pg = doc.addPage([PT, 842]); pg.drawImage(img, { x: 0, y: 0, width: PT, height: 842 }); }
  for (const r of rendered) {
    const img = await embed(r.canvas, 0.9), h = (PT * r.h) / r.w;
    const pg = doc.addPage([PT, h]);
    pg.drawImage(img, { x: 0, y: 0, width: PT, height: h });
  }
  for (const cv of feedbackPages(R, front.length + rendered.length)) { const img = await embed(cv, 0.92), pg = doc.addPage([PT, 842]); pg.drawImage(img, { x: 0, y: 0, width: PT, height: 842 }); }
  const out = await doc.save();
  return new Blob([out], { type: "application/pdf" });
}

/* ---------- HTML ---------- */

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nl = (s) => esc(s).replace(/\n/g, "<br>");

// Returns an HTML string: the student-facing Result Experience, built from the canonical result.
export async function exportHtml({ S, pages, fileName, qpName }) {
  const R = buildResult({ S, pages, fileName, qpName });
  const rendered = await renderPages({ S, pages, W: 1100, split: true });
  return buildHtml({ R, S, rendered });
}
