// Import of a saved evaluation: a Redpen JSON together with the PDF of the same answer copy.
// Pure data (no DOM). validateJson() checks and cleans the JSON, matchCopy() checks that the PDF is the one the JSON was made on.
// Nothing is dropped silently: whatever is changed or left out is listed in `warnings`.
import { IMPORT_LIMITS as L, PARAM_MAX } from "./config.js";

const TYPES = ["box", "tick", "cross", "underline", "strike", "score", "stamp", "text", "circle", "pen"];
const RECT = ["box", "circle", "pen"];              // have a width and a height
const LINE = ["underline", "strike", "text"];       // have a width
const isNum = (v) => typeof v === "number" && isFinite(v);
const isStr = (v) => typeof v === "string";
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const half = (v) => Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Control characters other than new line and tab are removed. Everything else (Hindi, symbols, quotes, emoji) is kept as written.
const text = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

class Report {
  constructor() { this.errors = []; this.warnings = []; this.counts = {}; }
  err(m) { this.errors.push(m); }
  warn(m) { this.warnings.push(m); }
  // Many alike problems become one line ("12 marks were moved inside the page") instead of 12 lines.
  note(key, fmt) { const c = (this.counts[key] = this.counts[key] || { n: 0, fmt }); c.n++; }
  flush() { Object.keys(this.counts).forEach((k) => this.warn(this.counts[k].fmt(this.counts[k].n))); this.counts = {}; }
}

export function parseJsonText(txt) {
  if (!isStr(txt) || !txt.trim()) return { error: "The JSON file is empty." };
  if (txt.length > L.jsonBytes) return { error: "The JSON file is too large (" + Math.round(txt.length / 1048576) + " MB). The limit is " + Math.round(L.jsonBytes / 1048576) + " MB." };
  try { return { json: JSON.parse(txt.charCodeAt(0) === 0xFEFF ? txt.slice(1) : txt) }; }
  catch (e) { return { error: "This is not a valid JSON file. Choose the .redpen.json file saved from Redpen." }; }
}

// Returns { ok, errors[], warnings[], clean, summary }. `clean` is what applyImport() is given.
export function validateJson(raw) {
  const R = new Report();
  if (!isObj(raw)) { R.err("The file does not hold a Redpen evaluation (it must be a JSON object)."); return done(R, null); }
  if (!Object.keys(raw).length) { R.err("The JSON file is empty."); return done(R, null); }
  if (raw.schema !== "redpen/v1") {
    const ds = raw.subjectivequestionsResult || raw.pageGeometry || raw.annotationIndex;
    R.err(ds ? "This looks like a Data Science grader file, not a saved Redpen file. Open the copy first, then use More > Load AI draft." : "This is not a Redpen JSON file (the \"schema\" field should be \"redpen/v1\"). Choose the .redpen.json file saved from Redpen.");
    return done(R, null);
  }
  if (raw.schema_version != null && !/^1(\.\d+)?$/.test(String(raw.schema_version))) R.err("This file is version " + String(raw.schema_version).slice(0, 12) + ", which this Redpen cannot read.");
  const clean = { schema: "redpen/v1" };

  // ----- cohort
  if (raw.cohort !== "foundation" && raw.cohort !== "upsc") R.err("The team is missing or unknown (it must be \"foundation\" or \"upsc\").");
  else clean.cohort = raw.cohort;
  const upsc = raw.cohort === "upsc";

  // ----- pages (the shape of the copy the marks were made on)
  if (!Array.isArray(raw.pages) || !raw.pages.length) R.err("The file does not list its pages, so the marks cannot be placed. It may be damaged.");
  else if (raw.pages.length > L.pdfPages) R.err("The file lists " + raw.pages.length + " pages. The limit is " + L.pdfPages + ".");
  else {
    clean.pages = raw.pages.map((p, i) => {
      if (!isObj(p) || !isNum(p.width) || !isNum(p.height) || p.width <= 0 || p.height <= 0) { R.err("Page " + (i + 1) + " has no valid size in the file."); return { width: 0, height: 0, rotation: 0 }; }
      const rot = isNum(p.rotation) ? ((Math.round(p.rotation) % 360) + 360) % 360 : 0;
      if (isNum(p.rotation) && rot % 90 !== 0) R.note("rot", (n) => n + " page turn" + (n > 1 ? "s were" : " was") + " not a multiple of 90° and was ignored.");
      return { width: p.width, height: p.height, rotation: rot % 90 === 0 ? rot : 0 };
    });
  }
  const nPages = clean.pages ? clean.pages.length : 0;
  if (isObj(raw.copy) && isNum(raw.copy.page_count) && nPages && raw.copy.page_count !== nPages) R.err("The file says the copy has " + raw.copy.page_count + " pages but lists " + nPages + ". It may be damaged.");
  clean.copy = isObj(raw.copy) ? { file: isStr(raw.copy.file) ? text(raw.copy.file).slice(0, 300) : "", page_count: nPages, sha256: isStr(raw.copy.sha256) && /^[0-9a-f]{64}$/i.test(raw.copy.sha256) ? raw.copy.sha256.toLowerCase() : null, size_bytes: isNum(raw.copy.size_bytes) ? raw.copy.size_bytes : null } : { file: isStr(raw.file) ? text(raw.file).slice(0, 300) : "", page_count: nPages, sha256: null, size_bytes: null };
  if (isObj(raw.copy) && isStr(raw.copy.sha256) && !clean.copy.sha256) R.warn("The PDF fingerprint in the file is not valid, so it was not used.");

  // ----- meta
  const m = isObj(raw.meta) ? raw.meta : {};
  clean.meta = {};
  ["copyId", "test", "student_name", "reviewer", "subject", "board", "class", "question_paper_link", "contact", "test_date"].forEach((k) => {
    if (m[k] == null || m[k] === "") return;
    if (!isStr(m[k]) && !isNum(m[k])) { R.warn("The detail \"" + k + "\" was not text and was left out."); return; }
    clean.meta[k] = text(m[k]).slice(0, 300);
  });
  if (!clean.meta.student_name) R.warn("The student name is missing in the file. Add it before you finish.");
  if (!clean.meta.test && !upsc) R.warn("The paper name is missing in the file.");
  if (raw.test_total_marks != null) {
    if (isNum(raw.test_total_marks) && raw.test_total_marks > 0 && raw.test_total_marks <= L.maxMarks && half(raw.test_total_marks)) clean.test_total_marks = raw.test_total_marks;
    else R.err("The total marks of the test (" + String(raw.test_total_marks).slice(0, 20) + ") is not a valid number.");
  } else R.warn("The total marks of the test is missing in the file. Enter it in the test details.");

  // ----- questions
  const qids = new Set();
  if (raw.questions != null && !Array.isArray(raw.questions)) R.err("The question list in the file is not a list.");
  else if (Array.isArray(raw.questions)) {
    if (raw.questions.length > L.questions) R.err("The file has " + raw.questions.length + " questions. The limit is " + L.questions + ".");
    else {
      clean.questions = [];
      raw.questions.forEach((q, i) => {
        const lab = "Question " + (i + 1);
        if (!isObj(q)) { R.err(lab + " is not valid."); return; }
        const id = q.id == null ? i + 1 : q.id;
        if (!Number.isInteger(id) || id < 1 || id > 9999) { R.err(lab + " has no valid number."); return; }
        if (qids.has(id)) { R.err("Question " + id + " appears more than once in the file."); return; }
        qids.add(id);
        const o = { id };
        if (!isNum(q.max_marks) || q.max_marks <= 0 || q.max_marks > L.maxMarks || !half(q.max_marks)) R.err("Q" + id + ": the maximum marks (" + String(q.max_marks).slice(0, 20) + ") is not valid. Use a number above 0, in steps of 0.5.");
        else o.max_marks = q.max_marks;
        o.attempted = q.attempted !== false;
        if (q.marks_obtained == null) o.marks_obtained = null;
        else if (!isNum(q.marks_obtained) || q.marks_obtained < 0 || !half(q.marks_obtained)) R.err("Q" + id + ": the marks (" + String(q.marks_obtained).slice(0, 20) + ") are not valid. Use a number from 0 in steps of 0.5.");
        else if (o.max_marks != null && q.marks_obtained > o.max_marks) R.err("Q" + id + ": the marks (" + q.marks_obtained + ") are more than the maximum of " + o.max_marks + ".");
        else o.marks_obtained = q.marks_obtained;
        o.objective = !!q.objective;
        if (q.question_type != null && !isStr(q.question_type)) R.warn("Q" + id + ": the question type was not text and was left out."); else o.question_type = text(q.question_type || "").slice(0, 100);
        o.comment = isStr(q.comment) ? text(q.comment).slice(0, L.text) : "";
        if (isStr(q.comment) && q.comment.length > L.text) R.note("cut", (n) => n + " long text" + (n > 1 ? "s were" : " was") + " cut to " + L.text + " characters.");
        if (Array.isArray(q.special_cases)) o.special_cases = q.special_cases.filter(isStr).map((s) => text(s).slice(0, 120)).slice(0, 40);
        if (Array.isArray(q.special_case_details)) o.special_case_details = q.special_case_details.filter((d) => isObj(d) && isStr(d.case)).map((d) => ({ case: text(d.case).slice(0, 120), comment: isStr(d.comment) ? text(d.comment).slice(0, L.text) : "" })).slice(0, 40);
        if (upsc && Array.isArray(q.parameters)) {
          o.parameters = q.parameters.filter(isObj).slice(0, 20).map((p) => {
            const r = { name: isStr(p.name) ? text(p.name).slice(0, 60) : "", marks: null, feedback: isStr(p.feedback) ? text(p.feedback).slice(0, L.text) : "" };
            if (p.marks != null) { if (isNum(p.marks) && p.marks >= 0 && p.marks <= PARAM_MAX && half(p.marks)) r.marks = p.marks; else R.err("Q" + id + ": the marks for \"" + r.name + "\" (" + String(p.marks).slice(0, 20) + ") must be from 0 to " + PARAM_MAX + " in steps of 0.5."); }
            return r;
          });
        }
        clean.questions.push(o);
      });
      if (clean.questions.length) {
        const sum = clean.questions.reduce((a, q) => a + (q.max_marks || 0), 0);
        if (clean.test_total_marks && Math.abs(sum - clean.test_total_marks) > 1e-6) R.warn("The questions add up to " + sum + " marks but the test total is " + clean.test_total_marks + ".");
      }
    }
  } else R.warn("The file has no question list. Enter the questions in the test details.");

  // ----- overall feedback
  const ov = raw.overall_summary != null ? raw.overall_summary : (isObj(raw.overall) ? raw.overall.summary : null);
  if (ov != null) {
    if (!isStr(ov)) R.warn("The overall feedback was not text and was left out.");
    else { if (ov.length > L.overall) R.note("cut", (n) => n + " long text" + (n > 1 ? "s were" : " was") + " cut."); clean.overall_summary = text(ov).slice(0, L.overall); }
  }
  if (!clean.overall_summary || !clean.overall_summary.trim()) R.warn(upsc ? "The file has no overall summary." : "The file has no overall feedback yet. It stays pending until you write it.");

  // ----- annotations
  if (!Array.isArray(raw.annotations)) R.err("The file has no list of marks (\"annotations\").");
  else if (raw.annotations.length > L.annotations) R.err("The file has " + raw.annotations.length + " marks. The limit is " + L.annotations + ".");
  else {
    const seen = new Set(), ids = new Set(), unknown = {}, noQ = new Set();
    clean.annotations = [];
    raw.annotations.forEach((o, i) => {
      const lab = "Mark " + (i + 1);
      if (!isObj(o)) { R.err(lab + " is not valid."); return; }
      if (TYPES.indexOf(o.type) < 0) { const k = String(o.type).slice(0, 30); unknown[k] = (unknown[k] || 0) + 1; return; }
      if (!Number.isInteger(o.page) || o.page < 1 || (nPages && o.page > nPages)) { R.err(lab + " (" + o.type + ") is on page " + String(o.page).slice(0, 10) + ", but the copy has " + nPages + " page" + (nPages === 1 ? "" : "s") + "."); return; }
      if (!isNum(o.x) || !isNum(o.y)) { R.err(lab + " (" + o.type + ", page " + o.page + ") has no valid position."); return; }
      const c = { type: o.type, page: o.page };
      const total = o.scope === "test_total";
      if (total) c.scope = "test_total";
      else if (o.question == null) { R.note("noq", (n) => n + " mark" + (n > 1 ? "s have" : " has") + " no question number and " + (n > 1 ? "were" : "was") + " put on Q1."); c.question = null; }
      else if (!Number.isInteger(o.question) || o.question < 1) { R.err(lab + " (" + o.type + ", page " + o.page + ") has an invalid question number."); return; }
      else { c.question = o.question; if (clean.questions && !qids.has(o.question)) noQ.add(o.question); }
      const cl = (v, key) => { const r = clamp(v, 0, 1); if (r !== v) R.note("clamp", (n) => n + " mark position" + (n > 1 ? "s were" : " was") + " outside the page and moved to its edge."); return r; };
      c.x = cl(o.x); c.y = cl(o.y);
      if (RECT.indexOf(o.type) >= 0 || LINE.indexOf(o.type) >= 0) {
        const w = o.width == null ? 0.3 : o.width, h = o.height == null ? 0 : o.height;
        if (!isNum(w) || !isNum(h) || w < 0 || h < 0) { R.err(lab + " (" + o.type + ", page " + o.page + ") has an invalid size."); return; }
        c.width = clamp(w, 0, 1 - c.x + 1e-9); if (c.width !== w) R.note("clamp", (n) => n + " mark position" + (n > 1 ? "s were" : " was") + " outside the page and moved to its edge.");
        if (RECT.indexOf(o.type) >= 0) { c.height = clamp(h, 0, 1 - c.y + 1e-9); if (c.height !== h) R.note("clamp", (n) => n + " mark position" + (n > 1 ? "s were" : " was") + " outside the page and moved to its edge."); }
      }
      if (typeof o.color === "string") c.color = o.color.slice(0, 12);
      if (o.type === "box" || o.type === "underline") {
        if (o.feedback != null && !isStr(o.feedback)) { R.err(lab + " (" + o.type + ", page " + o.page + ") has feedback that is not text."); return; }
        const f = o.feedback || ""; if (f.length > L.text) R.note("cut", (n) => n + " long text" + (n > 1 ? "s were" : " was") + " cut to " + L.text + " characters.");
        c.feedback = text(f).slice(0, L.text);
      }
      if (o.type === "text") {
        if (o.text != null && !isStr(o.text)) { R.err(lab + " (text, page " + o.page + ") is not text."); return; }
        c.text = text(o.text || "").slice(0, L.text);
        c.font_size = isNum(o.font_size) ? clamp(o.font_size, 4, 96) : 12;
        c.align = ["left", "center", "right"].indexOf(o.align) >= 0 ? o.align : "left";
        c.rotation = isNum(o.rotation) ? clamp(o.rotation, -360, 360) : 0;
      }
      if (o.type === "pen") {
        if (!Array.isArray(o.points)) { R.err(lab + " (pen, page " + o.page + ") has no points."); return; }
        if (o.points.length > L.penPoints) { R.err(lab + " (pen, page " + o.page + ") has " + o.points.length + " points. The limit is " + L.penPoints + "."); return; }
        const pts = [];
        for (const p of o.points) { if (!Array.isArray(p) || p.length < 2 || !isNum(p[0]) || !isNum(p[1])) { R.err(lab + " (pen, page " + o.page + ") has an invalid point."); return; } pts.push([clamp(p[0], 0, 1), clamp(p[1], 0, 1)]); }
        c.points = pts;
      }
      if (o.type === "score") c.score = o.score == null ? "" : text(o.score).slice(0, 20);
      if (o.type === "stamp") c.stamp = text(o.stamp || "Good").slice(0, 60);
      if (isNum(o.scale)) c.scale = clamp(o.scale, 0.2, 5);
      if (isStr(o.parameter)) c.parameter = text(o.parameter).slice(0, 60);
      if (isObj(o.ds_ref)) c.ds_ref = o.ds_ref;
      // The same mark twice (same type, place, size and words) is kept once.
      const key = [c.type, c.page, c.question, c.scope || "", c.x.toFixed(3), c.y.toFixed(3), (c.width || 0).toFixed(3), (c.height || 0).toFixed(3), c.feedback || c.text || c.score || c.stamp || "", c.points ? c.points.length : ""].join("|");
      if (seen.has(key)) { R.note("dup", (n) => n + " duplicate mark" + (n > 1 ? "s were" : " was") + " found and kept once."); return; }
      seen.add(key);
      if (isStr(o.id)) { if (ids.has(o.id)) R.note("dupid", (n) => n + " mark" + (n > 1 ? "s share" : " shares") + " an id with another mark. Each was given its own."); ids.add(o.id); }
      clean.annotations.push(c);
    });
    Object.keys(unknown).forEach((k) => R.warn(unknown[k] + " mark" + (unknown[k] > 1 ? "s" : "") + " of the type \"" + k + "\" " + (unknown[k] > 1 ? "are" : "is") + " not supported by this Redpen and " + (unknown[k] > 1 ? "were" : "was") + " not imported."));
    if (noQ.size) R.warn("Marks refer to question" + (noQ.size > 1 ? "s " : " ") + Array.from(noQ).sort((a, b) => a - b).join(", ") + ", which " + (noQ.size > 1 ? "are" : "is") + " not in the question list.");
  }
  if (!R.errors.length && (!clean.annotations || !(clean.annotations.length || (clean.questions && clean.questions.length) || clean.overall_summary))) R.err("The file has no marks, no questions and no feedback. There is nothing to import.");

  // a few harmless carry-overs
  if (isStr(raw.evaluation_id)) clean.evaluation_id = text(raw.evaluation_id).slice(0, 60);
  if (isStr(raw.started_at) && !isNaN(Date.parse(raw.started_at))) clean.started_at = raw.started_at.slice(0, 40);
  if (isObj(raw.ds_source)) clean.ds_source = raw.ds_source;
  return done(R, clean);
}

function done(R, clean) {
  R.flush();
  const ok = !R.errors.length;
  const a = ok && clean.annotations ? clean.annotations : [];
  return {
    ok, errors: R.errors.slice(0, 30), moreErrors: Math.max(0, R.errors.length - 30), warnings: R.warnings, clean: ok ? clean : null,
    summary: ok ? { pages: clean.pages.length, questions: (clean.questions || []).length, marks: a.length, feedback: a.filter((x) => x.type === "box" || (x.type === "underline" && x.feedback)).length, overall: !!(clean.overall_summary && clean.overall_summary.trim()), cohort: clean.cohort } : null,
  };
}

// Is this PDF the copy the JSON was made on?
// copy = { pages: [{ w, h }], sha256, name }.  Level "exact": the PDF bytes are the same. Level "sizes": only page count and sizes could be checked.
export function matchCopy(clean, copy) {
  const out = { ok: false, level: null, errors: [], warnings: [] };
  if (!clean || !copy) return out;
  const jp = clean.pages, cp = copy.pages || [];
  if (!cp.length) { out.errors.push("The PDF has no pages."); return out; }
  if (jp.length !== cp.length) { out.errors.push("The JSON was made on a copy with " + jp.length + " page" + (jp.length === 1 ? "" : "s") + ", but this PDF has " + cp.length + " page" + (cp.length === 1 ? "" : "s") + ". This is not the same answer copy."); return out; }
  const bad = [];
  jp.forEach((p, i) => { if (Math.abs(p.width - Math.round(cp[i].w)) > 1 || Math.abs(p.height - Math.round(cp[i].h)) > 1) bad.push(i + 1); });
  if (bad.length) { const i = bad[0] - 1; out.errors.push("Page size does not match on " + (bad.length === 1 ? "page " + bad[0] : bad.length + " pages (first: page " + bad[0] + ")") + ": the JSON has " + jp[i].width + " × " + jp[i].height + " and the PDF has " + Math.round(cp[i].w) + " × " + Math.round(cp[i].h) + ". This is not the same answer copy."); return out; }
  if (clean.copy && clean.copy.sha256) {
    if (copy.sha256 && copy.sha256 === clean.copy.sha256) { out.ok = true; out.level = "exact"; return out; }
    if (copy.sha256) { out.errors.push("This PDF is not the file the marks were made on (its fingerprint is different), even though the page count and sizes are the same. Choose the original PDF."); return out; }
    out.warnings.push("The PDF fingerprint could not be calculated here, so only page count and sizes were checked.");
  } else out.warnings.push("This JSON was saved before Redpen recorded a fingerprint of the PDF. Only the page count and page sizes could be checked, so please make sure it is the right PDF.");
  if (clean.copy && clean.copy.file && copy.name && clean.copy.file !== copy.name) out.warnings.push("The file name is different: the JSON was made on \"" + clean.copy.file + "\" and you chose \"" + copy.name + "\".");
  out.ok = true; out.level = "sizes";
  return out;
}

export async function sha256Hex(buf) {
  if (!(globalThis.crypto && crypto.subtle)) return null;
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  let s = ""; for (let i = 0; i < d.length; i++) s += (d[i] < 16 ? "0" : "") + d[i].toString(16);
  return s;
}
