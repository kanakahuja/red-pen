// Adapter for the Data Science (DS) files: the grader callback and the annotation manifest.
// fromDs() turns them into the Redpen JSON shape that applyImport() already understands, so an AI draft from DS opens like any other.
// Nothing is thrown away: the two original files travel with the evaluation in S.ds and are written back verbatim by buildExport().
import { PARAM_NAMES } from "./config.js";

export const isDsCallback = (j) => !!j && typeof j === "object" && Array.isArray(j.subjectivequestionsResult);
export const isDsManifest = (j) => !!j && typeof j === "object" && Array.isArray(j.pageGeometry) && Array.isArray(j.questions);

const TONE = { positive: "green", negative: "red", neutral: "yellow" };
const r4 = (v) => Math.round(v * 10000) / 10000;
const paramName = (key, label) => {
  const k = String(key || label || "").toLowerCase();
  return PARAM_NAMES.find((n) => k.indexOf(n.toLowerCase()) === 0) || null;
};
const lines = (x) => (Array.isArray(x) ? x.filter(Boolean).join(" ") : String(x || ""));

// Underlines come from DS word by word (thousands per copy). Neighbours on the same line are joined into one underline.
function mergeUnderlines(list) {
  const out = [];
  list.slice().sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x).forEach((u) => {
    const last = out[out.length - 1];
    if (last && last.page === u.page && last.color === u.color && Math.abs(last.y - u.y) < 0.004 && u.x - (last.x + last.width) < 0.012) {
      last.width = r4(Math.max(last.width, u.x + u.width - last.x)); last.refs.push(u.ref);
    } else out.push({ ...u, refs: [u.ref] });
  });
  return out;
}

export function fromDs(callback, manifest, opts) {
  opts = opts || {};
  const warnings = [];
  const cb = callback || {}, mf = manifest || {};
  const prog = String((cb.meta && cb.meta.program) || "").toLowerCase();
  const cohort = prog.indexOf("upsc") >= 0 ? "upsc" : prog ? "foundation" : (opts.cohort || "upsc");
  if (!prog) warnings.push({ code: "ds_program_missing", message: "The callback has no meta.program; cohort assumed " + cohort + "." });

  const qres = cb.subjectivequestionsResult || [];
  const questions = qres.map((q) => {
    const o = {
      id: q.questionNumber, max_marks: q.totalScore, marks_obtained: q.userScore,
      attempted: !/not.?attempt|skipp|unattempt/i.test(String(q.status || "")), objective: false, question_type: cohort === "upsc" ? "Subjective" : "",
      comment: "", ds: { qbgQuestionId: q.qbgQuestionId, status: q.status },
    };
    if (cohort === "upsc") {
      o.parameters = (q.rating || []).map((r) => {
        const name = paramName(r.key, r.label);
        if (!name) warnings.push({ code: "ds_parameter_unknown", message: "Parameter '" + r.key + "' is not one of the Redpen parameters; kept in the DS callback only.", question: q.questionNumber });
        return name ? { name, marks: r.score == null ? null : r.score, feedback: lines(r.feedback) } : null;
      }).filter(Boolean);
    }
    return o;
  });
  qres.forEach((q) => { if (!(manifest && (mf.questions || []).some((m) => m.questionNumber === q.questionNumber))) warnings.push({ code: "ds_question_not_in_manifest", message: "Q" + q.questionNumber + " is in the callback but not in the manifest.", question: q.questionNumber }); });

  const ov = Array.isArray(cb.overallFeedback) ? cb.overallFeedback : [];
  const pick = (k) => ov.find((x) => x.key === k);
  const overall = lines((pick("summary") || {}).feedback);

  const annotations = [];
  (mf.questions || []).forEach((q) => {
    const qn = q.questionNumber;
    if (!qres.some((x) => x.questionNumber === qn)) warnings.push({ code: "ds_question_not_in_callback", message: "Q" + qn + " is in the manifest but not in the callback.", question: qn });
    (q.annotationIndex || []).forEach((a) => {
      const bb = a.bb || [[0, 0], [0, 0]];
      if (!a.feedbackPoint || !String(a.feedbackPoint).trim()) warnings.push({ code: "ds_box_without_feedback", message: "Annotation " + a.index + " (Q" + qn + ") has no feedback point.", question: qn, annotation: a.index });
      annotations.push({
        type: "box", page: a.page, question: qn, x: r4(bb[0][0]), y: r4(bb[0][1]), width: r4(bb[1][0] - bb[0][0]), height: r4(bb[1][1] - bb[0][1]),
        color: TONE[a.type] || "yellow", feedback: a.feedbackPoint || "", parameter: paramName(a.parameter) || a.parameter || null,
        ds_ref: { kind: "annotationIndex", index: a.index, qbgQuestionId: q.qbgQuestionId, type: a.type },
      });
      if (!TONE[a.type]) warnings.push({ code: "ds_annotation_type_unknown", message: "Annotation type '" + a.type + "' is not positive/negative/neutral; shown as yellow.", question: qn, annotation: a.index });
    });
    const ul = [];
    (q.ops || []).forEach((op) => {
      const bb = op.bb || [[0, 0], [0, 0]], cx = r4((bb[0][0] + bb[1][0]) / 2), cy = r4((bb[0][1] + bb[1][1]) / 2);
      const ref = { kind: "ops", index: op.index, type: op.type };
      const col = op.tone === "positive" ? "green" : "red";
      if (op.type === "underline") ul.push({ type: "underline", page: op.page, question: qn, x: r4(bb[0][0]), y: r4((bb[0][1] + bb[1][1]) / 2), width: r4(bb[1][0] - bb[0][0]), color: col, feedback: "", ref });
      else if (op.type === "tick") annotations.push({ type: "tick", page: op.page, question: qn, x: cx, y: cy, ds_ref: ref });
      else if (op.type === "cross") annotations.push({ type: "cross", page: op.page, question: qn, x: cx, y: cy, ds_ref: ref });
      else if (op.type === "circled_score") annotations.push({ type: "score", page: op.page, question: qn, x: cx, y: cy, score: op.score == null ? "" : String(op.score), ds_ref: { ...ref, maxMarks: op.maxMarks } });
      else if (op.type === "circle") annotations.push({ type: "circle", page: op.page, question: qn, x: r4(bb[0][0]), y: r4(bb[0][1]), width: r4(bb[1][0] - bb[0][0]), height: r4(bb[1][1] - bb[0][1]), color: col, ds_ref: ref });
      else if (op.type === "comment") {
        const h = (bb[1][1] - bb[0][1]) * 1.417, fs = Math.max(6, Math.min(60, Math.round(0.55 * h * 360)));
        annotations.push({ type: "text", page: op.page, question: qn, x: r4(bb[0][0]), y: r4(bb[0][1]), width: r4(bb[1][0] - bb[0][0]), text: op.text || "", font_size: fs, align: "left", rotation: 0, color: col, ds_ref: ref });
      } else if (op.type === "strike") annotations.push({ type: "strike", page: op.page, question: qn, x: r4(bb[0][0]), y: r4((bb[0][1] + bb[1][1]) / 2), width: r4(bb[1][0] - bb[0][0]), ds_ref: ref });
      else warnings.push({ code: "ds_op_type_unknown", message: "Operation type '" + op.type + "' (index " + op.index + ", Q" + qn + ") is not drawn; it is kept in the DS manifest.", question: qn });
    });
    mergeUnderlines(ul).forEach((u) => { const { refs, ref, ...rest } = u; annotations.push({ ...rest, ds_ref: { kind: "ops", type: "underline", indexes: refs.map((r) => r.index) } }); });
  });

  (cb.meta && cb.meta.warnings || []).forEach((w) => warnings.push({ code: "ds_callback_warning", message: String(w) }));
  const pageCount = mf.pageCount || (mf.pageGeometry || []).length;
  if (cb.meta && cb.meta.totalPages && pageCount && cb.meta.totalPages !== pageCount) warnings.push({ code: "ds_page_count_mismatch", message: "Callback says " + cb.meta.totalPages + " pages, manifest says " + pageCount + "." });

  const json = {
    schema: "redpen/v1", cohort,
    questions, annotations,
    // DS "rotation" describes the stored page; pdf.js already applies it when the page is opened, and the DS boxes line up with the page as opened.
    // So it is not applied again as a reviewer turn. It is kept (pages[].source_rotation and in S.ds).
    pages: (mf.pageGeometry || []).map((g) => ({ width: g.width, height: g.height, rotation: 0, source_rotation: g.rotation || 0 })),
    test_total_marks: questions.reduce((s, q) => s + (+q.max_marks || 0), 0),
    meta: {},
  };
  if (cohort === "upsc") json.overall_summary = overall;
  return { json, warnings, ds: { callback: cb, manifest: mf } };
}
