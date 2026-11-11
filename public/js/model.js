// Pure data helpers. No DOM access.
import { PARAM_NAMES, EDGE } from "./config.js";

export const uid = () => Math.random().toString(36).slice(2, 9);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const r4 = (v) => Math.round(v * 10000) / 10000;

export const RECT = ["box", "circle", "pen"];
export const isRect = (a) => RECT.indexOf(a.type) >= 0;

// Text size is stored in px relative to a 360px-wide page.
export const fsOf = (a) => a.fs || [0, 10, 12, 16][a.sz || 2];
export const fsCq = (a) => (fsOf(a) * 100) / 360;

// Marks go in steps of 0.5.
export const half = (n) => Math.abs(n * 2 - Math.round(n * 2)) < 1e-9;
export const r2 = (n) => Math.round(n * 100) / 100;
export const num = (v) => (v === "" || v == null ? NaN : Number(v));

// Page rotation (0, 90, 180, 270). Marks are stored against the page as it
// was opened; rotation is kept per page and applied only when showing/exporting.
export const rotOf = (S, i) => ((S.rot && S.rot[i]) || 0) % 360;

// Maps a point on the page as opened to the page as shown (clockwise rotation).
export function toShown(x, y, rot) {
  if (rot === 90) return [1 - y, x];
  if (rot === 180) return [1 - x, 1 - y];
  if (rot === 270) return [y, 1 - x];
  return [x, y];
}
// Maps a point on the page as shown back to the page as opened.
export function fromShown(u, v, rot) {
  if (rot === 90) return [v, 1 - u];
  if (rot === 180) return [1 - u, 1 - v];
  if (rot === 270) return [1 - v, u];
  return [u, v];
}

export const mkParams = () => PARAM_NAMES.map((name) => ({ name, marks: null, feedback: "" }));

export const mkQ = (id, max) => ({
  id, max: max || 10, type: "", comment: "", edgeNotes: {}, marks: null, attempted: true, objective: false,
  params: mkParams(), edge: [],
});

export function fresh(reviewer) {
  return {
    meta: { copyId: "", test: "", student: "", reviewer: reviewer || "", subject: "", board: "", klass: "", paperLink: "" },
    cohort: "",
    testTotal: null,
    setupDone: false,
    rot: {},
    questions: [],
    overall: "",
    anns: [],
    aiLoaded: false,
  };
}

// Makes a saved or imported state safe to use (older drafts lack the newer fields).
export function normalize(S) {
  S.meta = Object.assign({ copyId: "", test: "", student: "", reviewer: "", subject: "", board: "", klass: "", paperLink: "" }, S.meta || {});
  if (S.cohort !== "foundation" && S.cohort !== "upsc") S.cohort = "";
  if (S.testTotal === undefined) S.testTotal = null;
  if (S.setupDone === undefined) S.setupDone = false;
  S.rot = S.rot || {};
  S.inputErrors = S.inputErrors || [];
  S.overall = S.overall || "";
  S.anns = S.anns || [];
  S.questions = (S.questions || []).map((q) => {
    const old = {};
    (q.params || []).forEach((p) => { old[p.name] = p; });
    q.params = PARAM_NAMES.map((name) => ({ name, marks: old[name] && old[name].marks != null ? old[name].marks : null, feedback: (old[name] && old[name].feedback) || "" }));
    q.edge = q.edge || [];
    q.type = q.type || "";
    q.comment = q.comment || "";
    q.edgeNotes = q.edgeNotes || {};
    return q;
  });
  return S;
}

// UPSC papers have a test code, not a name. Files are saved as <test>_<student>.
export const testLabel = (S) => (S.cohort === "upsc" ? "Test code" : "Paper name");
export const fileSafe = (v) => String(v || "").trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
export const fileBase = (S, fallback) => [fileSafe(S.meta.test), fileSafe(S.meta.student)].filter(Boolean).join("_") || fallback || "copy";

// What to tell the SME when a marks value is not allowed, and what to enter instead.
export function marksProblem(raw, max, what) {
  const s = String(raw == null ? "" : raw).trim(); if (s === "") return "";
  const v = Number(s), unit = what === "parameter" ? "this parameter" : "this question", mk = max + " mark" + (max === 1 ? "" : "s");
  if (!isFinite(v)) return `\u201c${s}\u201d is not a number. Type a number from 0 to ${max}.`;
  if (v < 0) return `Marks cannot be below 0. Enter a number from 0 to ${max}.`;
  if (v > max) return `${s} is more than the ${mk} for ${unit}. Enter a number from 0 to ${max}.`;
  if (!half(v)) return `${s} is not allowed. Use steps of 0.5, for example 0.5, 1 or 1.5.`;
  return "";
}

// The total for the whole test written on the cover page of the copy (a circled mark that belongs to no question).
export function coverTotal(S) {
  const a = S.anns.find((x) => x.total && !x._draft) || null, t = totals(S), want = t.got + "/" + t.max;
  return { ann: a, want, state: !a ? "none" : String(a.value || "").replace(/\s/g, "") === want ? "ok" : "stale" };
}

// How many marks are on the copy (or on one question). Boxes are counted by colour.
export function countMarks(S, qid) {
  const c = { total: 0, box_red: 0, box_yellow: 0, box_green: 0, tick: 0, cross: 0, underline: 0, strike: 0, score: 0, stamp: 0, text: 0, circle: 0, pen: 0 };
  S.anns.forEach((a) => {
    if (a._draft || a.total) return;
    if (qid != null && a.q !== qid) return;
    c.total++;
    if (a.type === "box") c["box_" + (a.color === "yellow" || a.color === "green" ? a.color : "red")]++;
    else if (c[a.type] !== undefined) c[a.type]++;
  });
  return c;
}

// Box numbers: by page, then top to bottom, then left to right.
export function numbered(S) {
  const m = {};
  S.anns.filter((a) => a.type === "box" && !a._draft)
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
    .forEach((b, i) => (m[b.id] = i + 1));
  return m;
}

export function remark(p) {
  return p >= 90 ? "Excellent" : p >= 60 ? "Very Good" : p >= 40 ? "Good Effort" : "Keep Practicing";
}

export function totals(S) {
  let got = 0, sumMax = 0;
  S.questions.forEach((q) => { sumMax += +q.max || 0; got += q.attempted ? +q.marks || 0 : 0; });
  const max = S.testTotal != null && S.testTotal > 0 ? S.testTotal : sumMax;
  const pct = max ? (got / max) * 100 : 0;
  return { got: r2(got), max: r2(max), sumMax: r2(sumMax), pct, remark: remark(pct) };
}

// Fingerprint used to flag edits to an imported AI annotation.
export function core(a) {
  return JSON.stringify([a.type, a.page, r4(a.x), r4(a.y), r4(a.w || 0), r4(a.h || 0),
    a.color || "", a.text || "", a.value || "", a.stamp || "", a.q]);
}
export const isEdited = (a) => a.src === "ai" && a.orig && a.orig !== core(a);

/* ---------- checks before a download ---------- */

// Only a few things stop a download: details missing, a question not marked,
// marks out of range or not in steps of 0.5, a box without a comment.
// Everything else is a warning the SME can read and ignore.
//   blockers: [{ msg, q? | id? | setup? }]
//   warnings: [{ msg, kind: "marks" | "pages", q?, page?, setup? }]
//   byQ:      { questionId: [tags] }   tags: nofb, colour, na-marks, objective, score, order
//   byPage:   { pageIndex: [tags] }    tags: empty, turned, unseen
// opts.viewed is the set of page numbers (0-based) the SME has scrolled to.
export function check(S, pageCount, opts) {
  opts = opts || {};
  const blockers = [], warnings = [], byQ = {}, byPage = {}, nums = numbered(S);
  const B = (msg, extra) => blockers.push(Object.assign({ msg }, extra || {}));
  const W = (msg, kind, extra) => warnings.push(Object.assign({ msg, kind }, extra || {}));
  const tagQ = (q, t) => { (byQ[q] = byQ[q] || []).push(t); };
  const tagP = (p, t) => { (byPage[p] = byPage[p] || []).push(t); };

  if (!pageCount) B("Open an answer copy first.");
  const m = S.meta;
  if (!String(m.reviewer || "").trim()) B("Reviewer name is missing.", { setup: 1 });
  if (!S.cohort) B("Choose the team (Foundation or UPSC).", { setup: 1 });
  if (!String(m.subject || "").trim()) B("Subject is missing.", { setup: 1 });
  if (!String(m.test || "").trim()) B(`${testLabel(S)} is missing.`, { setup: 1 });
  if (!String(m.student || "").trim()) B("Student name is missing.", { setup: 1 });
  if (S.cohort === "foundation" && (!m.board || !m.klass)) B("Board and class are missing.", { setup: 1 });
  if (!S.questions.length) B("Enter the number of questions.", { setup: 1 });
  if (!(S.testTotal > 0)) B("Enter the total marks of the test.", { setup: 1 });

  S.questions.forEach((q) => {
    const mx = num(q.max);
    if (!(mx > 0) || !half(mx)) { B(`Q${q.id}: enter the maximum marks (steps of 0.5).`, { setup: 1 }); return; }
    if (S.cohort === "foundation" && !String(q.type || "").trim()) B(`Q${q.id}: choose the question type.`, { setup: 1 });
    if (!q.attempted) return;
    if (q.badMarks) { B(`Q${q.id}: ${marksProblem(q.badMarks, mx, "question")}`, { q: q.id }); return; }
    const g = num(q.marks);
    if (!isFinite(g)) B(`Q${q.id}: enter marks, or tick Not attempted.`, { q: q.id });
    else if (g < 0 || g > mx) B(`Q${q.id}: marks must be between 0 and ${mx}.`, { q: q.id });
    else if (!half(g)) B(`Q${q.id}: marks go in steps of 0.5.`, { q: q.id });
  });
  S.anns.filter((a) => a.type === "box" && !a._draft && !String(a.text || "").trim())
    .forEach((a) => B(`Q${a.q}: box #${nums[a.id]} needs a comment.`, { id: a.id }));
  // No bonus or extra marks: the total can never be more than the test total.
  { const tt = totals(S); if (S.testTotal > 0 && tt.got > S.testTotal + 1e-9) B(`The marks add up to ${tt.got}, which is more than the test total of ${S.testTotal}. Do not give extra marks.`, { setup: 1 }); }

  /* ----- warnings: marks and questions ----- */
  const t = totals(S);
  if (S.testTotal > 0 && S.questions.length && Math.abs(t.sumMax - S.testTotal) > 1e-6) {
    W(`The questions add up to ${t.sumMax} marks, but the test total is ${S.testTotal}.`, "marks", { setup: 1 });
  }
  if (S.questions.length && S.questions.every((q) => !q.attempted)) W("Every question is marked not attempted.", "marks");
  const noBox = [], firstPage = {};
  S.questions.forEach((q) => {
    const mine = S.anns.filter((a) => a.q === q.id && !a._draft);
    if (mine.length) firstPage[q.id] = Math.min.apply(null, mine.map((a) => a.page));
    // every ticked special case should say what it is about (its own comment, or a note on the question)
    const noNote = (q.edge || []).filter((k) => !String((q.edgeNotes || {})[k] || "").trim());
    if (noNote.length && !String(q.comment || "").trim()) { W(`Q${q.id}: add a comment for ${noNote.map((k) => "\u201c" + k + "\u201d").join(", ")}.`, "marks", { q: q.id }); tagQ(q.id, "nonote"); }
    if (!q.attempted) {
      if (mine.length) { W(`Q${q.id} is marked not attempted but has marks on the copy.`, "marks", { q: q.id }); tagQ(q.id, "na-marks"); }
      return;
    }
    const boxes = mine.filter((a) => a.type === "box");
    if (!boxes.length) { noBox.push(q.id); tagQ(q.id, "nofb"); }
    const g = num(q.marks), mx = num(q.max);
    if (boxes.length && isFinite(g) && mx > 0) {
      if (g >= mx && boxes.every((b) => b.color === "red")) { W(`Q${q.id} has full marks but only red boxes.`, "marks", { q: q.id }); tagQ(q.id, "colour"); }
      else if (g <= 0 && boxes.every((b) => b.color === "green")) { W(`Q${q.id} has 0 marks but only green boxes.`, "marks", { q: q.id }); tagQ(q.id, "colour"); }
    }
    if (q.objective && isFinite(g) && g !== 0 && g !== mx) { W(`Q${q.id} is objective, so the marks should be 0 or ${mx}.`, "marks", { q: q.id }); tagQ(q.id, "objective"); }
    const scores = mine.filter((a) => a.type === "score").map((a) => parseFloat(a.value)).filter((v) => isFinite(v));
    if (scores.length && isFinite(g)) {
      const sum = r2(scores.reduce((x, y) => x + y, 0));
      if (Math.abs(sum - g) > 1e-6) { W(`Q${q.id}: the circled ${scores.length > 1 ? "scores add up to" : "score is"} ${sum}, but the marks are ${g}.`, "marks", { q: q.id }); tagQ(q.id, "score"); }
    }
  });
  if (noBox.length) W(`No feedback box on ${noBox.map((i) => "Q" + i).join(", ")}.`, "marks", { q: noBox[0] });
  // Marks for a later question should not start on an earlier page than the question before it.
  let prev = null;
  S.questions.forEach((q) => {
    if (firstPage[q.id] === undefined) return;
    if (prev && firstPage[q.id] < firstPage[prev.id]) { W(`Q${q.id} starts on page ${firstPage[q.id] + 1}, before Q${prev.id} (page ${firstPage[prev.id] + 1}). Check the marks are on the right question.`, "marks", { q: q.id }); tagQ(q.id, "order"); }
    prev = q;
  });
  const used = Array.from(new Set(S.anns.filter((a) => !a._draft && !a.total).map((a) => a.q)));
  if (used.length === 1 && S.questions.filter((q) => q.attempted).length > 1) W(`All the marks on the copy are on Q${used[0]}. Check that each mark is on the right question.`, "marks", { q: used[0] });

  /* ----- warnings: pages ----- */
  if (pageCount) {
    const empty = [], unseen = [], turned = [];
    for (let i = 0; i < pageCount; i++) {
      if (!S.anns.some((a) => a.page === i && !a._draft && !a.total)) { empty.push(i); tagP(i, "empty"); }
      if (rotOf(S, i)) { turned.push(i); tagP(i, "turned"); }
      if (opts.viewed && !opts.viewed.has(i)) { unseen.push(i); tagP(i, "unseen"); }
    }
    if (empty.length && empty.length < pageCount) W(`No marks on page${empty.length > 1 ? "s" : ""} ${empty.map((i) => i + 1).join(", ")}.`, "pages", { page: empty[0] });
    if (unseen.length && unseen.length < pageCount) W(`You have not scrolled to page${unseen.length > 1 ? "s" : ""} ${unseen.map((i) => i + 1).join(", ")}.`, "pages", { page: unseen[0] });
  }
  return { blockers, warnings, byQ, byPage };
}

// How many questions carry a special case, and whether any needs Ops review.
export function edgeSummary(S) {
  let n = 0, ops = false;
  S.questions.forEach((q) => {
    const e = q.edge || [];
    if (e.length) n++;
    e.forEach((k) => { const x = EDGE.find((z) => z.k === k); if (x && x.ops) ops = true; });
  });
  return { n, ops };
}
