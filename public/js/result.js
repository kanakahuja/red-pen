// One evaluation, read once: the canonical "result" that the JSON, HTML and PDF exports all use.
// Pure data (no DOM). Cohort-specific parts exist only for the cohort that has them.
import { COLORS, PARAM_MAX, TEAMS } from "./config.js";
import { numbered, totals, countMarks, rotOf, coverTotal, fileBase, r4 } from "./model.js";

export const RESULT_SCHEMA = "redpen.result/v1";
export const PLATFORM = "redpen-web";
const clean = (s) => String(s == null ? "" : s).trim();
// Remark bands from the Result Experience PRD (4.3 B). Derived from marks %, never typed.
export function remarkOf(pct) {
  return pct >= 90 ? { text: "Excellent!", tone: "positive" } : pct >= 60 ? { text: "Very Good!", tone: "positive" }
    : pct >= 40 ? { text: "Good Effort!", tone: "encouraging" } : { text: "Keep Practicing!", tone: "encouraging" };
}
// Type 1 = numbered coloured box (always has feedback). An underline with a comment is also listed here, as "U".
export const isType1 = (a) => a.type === "box" || (a.type === "underline" && clean(a.text) !== "");

export function buildResult({ S, pages, fileName, qpName, now }) {
  const when = now || new Date();
  const upsc = S.cohort === "upsc", m = S.meta, t = totals(S), nums = numbered(S);
  const live = S.anns.filter((a) => !a._draft);
  const ds = S.ds || null, dsCb = ds && ds.callback, dsMeta = (dsCb && dsCb.meta) || {};
  const warnings = (S.dsWarnings || []).map((w) => ({ ...w }));
  const gaps = ["student_id", "test_id", "test_date", "student_contact"];
  if (!m.testDate) gaps.push("test_date_is_evaluation_date"); else gaps.splice(gaps.indexOf("test_date"), 1);
  if (m.contact) gaps.splice(gaps.indexOf("student_contact"), 1);
  gaps.push("model_answers");

  const feedback = live.filter(isType1).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x).map((a, i) => {
    const isBox = a.type === "box", k = COLORS[a.color] ? a.color : "red";
    if (!clean(a.text)) warnings.push({ code: "box_without_feedback", message: "Highlight " + (nums[a.id] || "") + " on page " + (a.page + 1) + " has no feedback.", question: a.q, annotation: a.id });
    return {
      id: a.id, order: i + 1, number: isBox ? nums[a.id] : null, label: isBox ? String(nums[a.id]) : "U", kind: isBox ? "box" : "underline",
      question: a.q, page: a.page + 1, color: k, polarity: COLORS[k].pol, text: clean(a.text), parameter: a.param || null,
      source: a.src === "ai" ? "ai" : "reviewer", ds_ref: a.ds || null,
    };
  });
  const handwritten = live.filter((a) => !isType1(a)).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x).map((a, i) => ({
    id: a.id, order: i + 1, type: a.type, question: a.total ? null : a.q, page: a.page + 1, color: a.color || null,
    value: a.type === "score" ? clean(a.value) : a.type === "stamp" ? a.stamp : a.type === "text" ? clean(a.value) : null, ds_ref: a.ds || null,
  }));

  const questions = S.questions.map((q) => {
    const fb = feedback.filter((f) => f.question === q.id), mine = live.filter((a) => a.q === q.id && !a.total);
    const got = q.attempted ? (q.marks == null || q.marks === "" ? 0 : +q.marks) : 0;
    if (q.attempted && (q.marks == null || q.marks === "")) warnings.push({ code: "marks_missing", message: "Q" + q.id + " has no marks.", question: q.id });
    const o = {
      id: q.id, number: q.id, max_marks: +q.max || 0, marks_obtained: got, attempted: q.attempted, objective: upsc ? false : !!q.objective,
      question_type: upsc ? "Subjective" : q.type || "", pages: Array.from(new Set(mine.map((a) => a.page + 1))).sort((a, b) => a - b),
      feedback_ids: fb.map((f) => f.id), handwritten_count: mine.length - mine.filter(isType1).length, comment: q.comment || "",
    };
    const notes = [clean(q.comment)].concat((q.edge || []).map((k) => k + (clean((q.edgeNotes || {})[k]) ? ": " + clean(q.edgeNotes[k]) : ""))).filter(Boolean);
    o.marks_on_copy = countMarks(S, q.id).total; o.notes = notes;
    if (!q.attempted) o.status = "not_attempted"; else o.status = "evaluated";
    if (upsc) o.parameters = q.params.map((p) => ({ name: p.name, marks: p.marks, max_marks: PARAM_MAX, feedback: clean(p.feedback) }));
    return o;
  });
  questions.forEach((q) => { if (q.attempted && !q.feedback_ids.length && !q.handwritten_count) warnings.push({ code: "question_without_marks_on_copy", message: "Q" + q.id + " has no marks drawn on the copy.", question: q.id }); });

  const fields = [["Student name", clean(m.student)]];
  const add = (l, v) => { if (clean(v)) fields.push([l, clean(v)]); };
  add("Reviewer", m.reviewer); add("Team", TEAMS[S.cohort] || ""); add("Subject", m.subject);
  add(upsc ? "Test" : "Test name", m.test);
  if (upsc) add("Contact no.", m.contact);
  else { add("Course", "Foundation"); add("Class", m.klass); add("Board", m.board); }
  fields.push([m.testDate ? "Test date" : "Evaluated on", m.testDate || when.toISOString().slice(0, 10)]);
  add("Copy name", fileName); add("Question paper", qpName);
  fields.push(["Marks on the copy", String(countMarks(S).total)]);
  fields.push(["Marks obtained", String(t.got)], ["Maximum marks", String(t.max)], ["Percentage", t.pct.toFixed(1) + "%"], ["Remark", remarkOf(t.pct).text]);

  const ct = coverTotal(S);
  const res = {
    schema: RESULT_SCHEMA, cohort: S.cohort,
    student: { id: m.studentId || null, name: clean(m.student), contact: clean(m.contact) || null },
    test: { id: m.testId || null, name: upsc ? null : clean(m.test), code: upsc ? clean(m.test) : null, date: m.testDate || null, subject: clean(m.subject), total_marks: t.max, question_count: S.questions.length },
    cohort_details: upsc ? { test_code: clean(m.test), contact: clean(m.contact) || null } : { course: "Foundation", class: clean(m.klass) || null, board: clean(m.board) || null },
    cover: { fields: fields.map(([label, value]) => ({ label, value })), marks_obtained: t.got, total_marks: t.max, percent: +t.pct.toFixed(1), remark: remarkOf(t.pct), cover_total_written: !!ct.ann },
    questions,
    parameters: upsc ? { names: S.questions[0] ? S.questions[0].params.map((p) => p.name) : [], max_marks: PARAM_MAX } : null,
    overall: upsc ? {
      summary: clean(S.overall),
      strengths: ds ? ((dsCb.overallFeedback || []).find((x) => x.key === "strengths") || { feedback: [] }).feedback : [],
      improvements: ds ? ((dsCb.overallFeedback || []).find((x) => x.key === "improvements") || { feedback: [] }).feedback : [],
    } : null,
    feedback, handwritten,
    pages: pages.map((p, i) => ({ page: i + 1, width: Math.round(p.w * 10) / 10, height: Math.round(p.h * 10) / 10, rotation: rotOf(S, i) })),
    model_answers: null,
    evaluation: {
      id: S.evalId || "", timestamp: when.toISOString(), started_at: S.startedAt || null, platform: PLATFORM, language: dsMeta.language || null,
      model: dsMeta.model || null, evaluator: clean(m.reviewer) || null, source: ds ? "ds_draft_reviewed_in_redpen" : "redpen_reviewer", file: fileName || "", file_base: fileBase(S, ""),
      question_paper: qpName || "",
    },
    feedback_interactions: [], overall_rating: null,
    data_gaps: gaps, warnings,
  };
  if (!clean(m.student)) res.warnings.push({ code: "student_name_missing", message: "Student name is missing." });
  if (!S.testTotal && t.max !== t.sumMax) res.warnings.push({ code: "totals_differ", message: "Test total and the sum of question marks differ." });
  return res;
}

export const resultCounts = (S) => countMarks(S);
export { r4 };
