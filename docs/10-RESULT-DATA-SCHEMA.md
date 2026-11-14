# Result data schema (Redpen JSON 1.2) and DS mapping

One evaluation is read once into a canonical result (`public/js/result.js`, `redpen.result/v1`). The JSON, the HTML and the PDF all use it.
Nothing from the DS callback or manifest is dropped: both files are stored unchanged in `ds_source`.

## Files in the code

| File | Job |
|---|---|
| `js/ds.js` | Reads the DS callback and manifest into the Redpen shape (an AI draft). Notes anything odd as a warning. |
| `js/result.js` | Builds the canonical result: cover, questions, type 1 feedback list, type 2 marks, pages, evaluation, warnings. |
| `js/resulthtml.js` | The HTML Result Experience (from the canonical result). |
| `js/pdfpages.js` | The cover, UPSC parameter and overall pages, and the consolidated feedback pages of the PDF. |
| `js/export.js` | `buildExport` (JSON), `exportPdf`, `exportHtml`, import. |

## Redpen JSON (`schema: redpen/v1`, `schema_version: 1.2`)

The earlier 1.1 fields are unchanged. 1.2 adds:

```
student            { id|null, name, contact|null }
test               { id|null, name|null, code|null, date|null, subject, total_marks, question_count }   name = Foundation, code = UPSC
cohort_details     Foundation: { course, class, board }      UPSC: { test_code, contact|null }
result             { marks_obtained, total_marks, percent, remark{ text, tone } }       remark from marks % (PRD 4.3 B)
parameters_config  UPSC: { names[], max_marks }              Foundation: null
overall            UPSC: { summary, strengths[], improvements[] }   Foundation: null
feedback_index     [{ id, order, number, label, question, page, color, polarity, parameter }]   type 1: numbered boxes, and underlines with a comment ("U")
handwritten_index  [{ id, order, type, question, page }]       type 2: tick, cross, underline, circled score, strike, stamp, text, circle, pen
evaluation         { id, timestamp, started_at, platform, language, model, evaluator, source, file, file_base, question_paper }
model_answers      null until model answers exist
feedback_interactions []   thumbs up/down, reasons, comment (collected in the HTML, see below)
overall_rating     null    star rating (collected in the HTML)
data_gaps          fields Redpen does not capture (student_id, test_id, test_date, student_contact, model_answers)
warnings           [{ code, message, question?, annotation? }]   nothing is dropped silently
ds_source          { callback, manifest } exactly as received, or null
```

`questions[]` keeps its fields and, for UPSC, `parameters[{name, marks, max_marks, feedback}]`. Foundation questions have no `parameters`.
Each annotation may also carry `parameter` and `ds_ref` (where it came from in the DS file). `pages[]` may carry `source_rotation` (the DS page rotation).

### Reaction record (written by the HTML, "Save my responses")

`{ feedback_id, question_id, test_id, test, student_name, cohort, platform: "html", reaction: "up"|"down", options[], comment, timestamp, feedback{ number, color, polarity, type, page, text } }`.
Complete-evaluation reports and the star rating (`{ stars, options[], comment, ... }`) are saved the same way.

## Mapping from DS

### Callback (`callback_payload.json`)

| DS field | Where it goes |
|---|---|
| `userScore` | recomputed from the questions (`result.marks_obtained`); original kept in `ds_source` |
| `overallRating[]` | UPSC: per question `parameters[]` come from each question's `rating`; the test-level list stays in `ds_source` |
| `overallFeedback` key `summary` | `overall.summary` (and `overall_summary`) |
| `overallFeedback` keys `strengths`, `improvements` | `overall.strengths`, `overall.improvements` |
| `subjectivequestionsResult[].questionNumber` | `questions[].id` / `number` |
| `.qbgQuestionId`, `.status` | kept in `ds_source` (`ds_ref.qbgQuestionId` on annotations) |
| `.userScore`, `.totalScore` | `questions[].marks_obtained`, `max_marks` |
| `.rating[]` (key, score, maxScore, feedback) | `questions[].parameters[]` (name, marks, max_marks, feedback) |
| `meta.model`, `meta.language` | `evaluation.model`, `evaluation.language` |
| `meta.program` | `cohort` (`UPSC` → upsc, anything else → foundation) |
| `meta.totalPages` | checked against the manifest page count |
| `meta.warnings[]` | `warnings[]` (`ds_callback_warning`) |
| `aiAnnotationManifestFileId`, `annotationManifestFileId`, `manifestVersion`, `annotationSchemaVersion`, `isTeacherEvaluationCurl` | kept in `ds_source.callback` |

### Manifest (`manifest.json`)

| DS field | Where it goes |
|---|---|
| `schemaVersion`, `testStudentMappingId`, `pageCount` | `ds_source.manifest` (`pageCount` is checked against the copy) |
| `pageGeometry[]` (page, width, height, rotation) | `pages[]` width/height. The rotation is kept as `source_rotation` and is **not** applied again (pdf.js already opens the page with it, and the DS boxes line up with the page as opened). |
| `questions[].questionNumber`, `qbgQuestionId` | question id, `ds_ref` |
| `questions[].pages`, `questionRegions[]` | `ds_source.manifest`; `questions[].pages` in the result are the pages that carry marks |
| `annotationIndex[]` (index, page, bb, type, parameter, feedbackPoint) | type 1 box: `bb` → x, y, width, height; `positive/negative/neutral` → green/red/yellow; `feedbackPoint` → feedback; `parameter` → `parameter` |
| `ops[]` type `circled_score` | score mark (value = `score`) |
| `ops[]` type `comment` | handwritten text (colour from `tone`) |
| `ops[]` type `underline` | underline (neighbouring words on one line are joined; `ds_ref.indexes` lists every original op) |
| `ops[]` types `tick`, `cross`, `circle`, `strike` | the same marks in Redpen |
| `ops[]` other types, unknown annotation types | not drawn; `warnings[]` says so; the original stays in `ds_source` |
| `factCheck` | `ds_source.manifest` |

## Warnings raised

`ds_box_without_feedback`, `ds_annotation_type_unknown`, `ds_op_type_unknown`, `ds_parameter_unknown`, `ds_question_not_in_manifest`, `ds_question_not_in_callback`, `ds_page_count_mismatch`, `ds_program_missing`, `ds_callback_warning`, `box_without_feedback`, `marks_missing`, `question_without_marks_on_copy`, `student_name_missing`, `totals_differ`.

## Adding a cohort or an annotation type

- New cohort: add its fields to `cohort_details` and the cover fields in `result.js`, and its pages in `pdfpages.js` / `resulthtml.js`. Common parts need no change.
- New DS annotation or op type: add one branch in `ds.js`. Until then it is kept in `ds_source` and flagged in `warnings`.
