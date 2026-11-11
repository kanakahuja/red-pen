# Redpen

Mark student answer copies like a teacher: boxes with feedback, ticks, crosses, underlines, strike-through, circled scores, stamps, handwritten text, circle and pen. Output is a JSON file (golden dataset), an annotated PDF and an HTML copy of the evaluation.

Static site. No build step, no backend, no CDN: everything is in `public/`.

## Run locally

```
python3 scripts/serve.py 3000     # serves public/ with the same headers as production
```

Open http://localhost:3000. Click **Demo** to try without a file.

## Deploy (Vercel)

1. Push this folder to a Git repo.
2. Vercel → New Project → import the repo. Framework: **Other**. Leave build command empty.
3. `vercel.json` sets the output folder (`public`), security headers and caching.
4. Turn on **Deployment Protection** (Vercel SSO or password). Copies contain student data.

## Settings

`public/js/config.js`

| Key | Purpose |
|---|---|
| `submitUrl` | If set, **Submit** POSTs the review JSON to this URL. If empty, Submit offers JSON, PDF and HTML downloads. |
| `submitHeaders` | Extra headers for that request (e.g. an auth token). |

If `submitUrl` is on another origin, it must allow CORS and be reachable under the CSP `connect-src` in `vercel.json`.

## How it works

- Pages are drawn on canvas (PDF via pdf.js, photos as images). Annotations are stored per page in coordinates relative to page size, so they survive zoom and export.
- Work autosaves in the browser (`localStorage`) per file. The JSON export is the source of truth. Closing with unsaved changes shows a warning.
- **Open saved JSON** resumes a review. **Open AI draft** loads an AI-evaluated JSON and marks what the reviewer edited or added.

### Setting up a test (the setup page)

The app opens on a setup page with three steps. The tools, question strip and side panel stay hidden until the evaluation starts.

1. **Question paper.** Upload a PDF or photo, or paste a link (or skip). It then stays open on the left for the rest of the setup and the evaluation.
2. **Test details**, filled in once while the question paper is in view: reviewer name, team (Foundation or UPSC), subject (a dropdown for the team, with "Others" to type one), paper name (for UPSC there is no paper name, so it asks for the **test code**), board and class (Foundation only), number of questions, total marks, and for each question its max marks and (Foundation only) its type: Diagram, Long Answer, MCQ, Numerical, Short Answer, True/False, Fill in the blank, One word, Matching, Language, Assertion Reason, or Others (type a name and tick Objective if it is all-or-nothing). "Same type for all" fills every question at once. MCQ, True/False, Fill in the blank, One word, Matching and Assertion Reason are objective: full marks or zero, no stamp. In UPSC every question is subjective, so no type is asked. Back keeps what was typed. **The team decides the fields**: Foundation shows total and question marks; UPSC adds five parameters (marks out of 5 and feedback each) and an overall summary.
3. **Answer copy.** Type the **student's name**, choose the student's PDF or photos, then press **Start evaluation**. The name is asked for every copy, and the screen shows how the files will be named.

For the next copy of the same test, **New copy** goes straight to step 3. The test details and the question paper are kept (use Change to edit them), and the marks start clean. **Copy details** in the header edits the details during an evaluation. Not attempted is set per copy, in the question strip.

### Submit, final check and export

**Export is hidden until the SME presses Submit and finishes the final check.** If something is missing, Submit lists what to fix, and each line takes the SME there. Otherwise the check has three short steps, each with one tick:

1. **Marks.** First, the **total for the whole test goes on the cover page of the copy**: one button writes it (for example 12/20) as a circled mark on page 1, which the SME can move or resize afterwards. Continue and Export wait for it, and the check offers to update it if the marks change later. Then the total, and one row per question with its marks and number of marks on the copy. Rows that need a second look are flagged: no feedback box, marks and box colours differ, a circled score that differs from the marks, marks that start on an earlier page than the question before, an objective question with part marks, a not-attempted question that has marks. Total marks that do not match the questions are shown above the table. The total for the whole test (for example 10 out of 20) is shown first, and the tick asks whether it is fair for this copy.
2. **Pages.** A thumbnail of every page as it will be saved, with its mark count and flags: turned, no marks, not scrolled to. Tap a page to go to it.
3. **Guidelines.** Four short points and one tick: no bonus or extra marks (the data trains AI models), every question has marks and feedback (not attempted questions are marked Not attempted), special cases get a note, and is the total for the whole test fair for this copy. Then Save HTML, Save PDF and Save JSON appear, with **Start next copy**.

All three ticks are needed. Any later change to marks, notes or the copy hides Export again until the next check. **More** keeps Open saved JSON, Open AI draft and Clear all.

Only these stop Submit or a download (marks adding up to more than the test total is one of them: no extra marks): a question that is neither marked nor set to not attempted, marks outside 0 to the maximum or not in steps of 0.5, a box without a comment, or missing test details. Everything else is a note the SME can read and ignore.

### Marking one question at a time

The strip at the top is where the SME works. Pick a question (Q1, Q2…), highlight the answer and write the feedback on the copy, type the marks in the **Marks** box of that strip, then press **Next question** (or Enter in the Marks box). After the last question the button becomes **Finish and check**. **Not attempted** sits in the same strip. Keys: `]` next question, `[` previous, `1` to `9` jump to that question.

Each chip shows how many marks are on that question, and the side panel lists every question with its marks, so the SME can see what is done. The side panel also holds the extra details of the current question (UPSC parameters, special cases) and the UPSC overall summary. Special cases (poor handwriting, not legible, written elsewhere, and more, or **Other**) are ticked in the side panel. A ticked case moves to the top and opens its own comment box, so the SME can say what and where. There is also a note box for each question. To move one mark to another question, open it and change **Question** in its popover. The final check warns when every mark on the copy is on a single question.

If a marks value is not possible (for example 3 on a 1-mark question), a red message under the box says what is wrong and what to enter: "3 is more than the 1 mark for this question. Enter a number from 0 to 1." The wrong value stays in the box, Next question waits until it is fixed, and Submit lists it. UPSC parameter marks give the same kind of message. Each wrong value that was typed is saved in the JSON.

### Turning pages and resizing

Each page has **Left / Right / 180°** buttons for inverted or sideways copies. Marks stay on the same part of the answer and turn with the page. The turn is saved in the JSON, PDF and HTML. Select a tick, cross, stamp or circled score and drag its corner handle to make it bigger or smaller. Text size is set in its popover.

### Question paper

The **Question paper** opens beside the copy as soon as the SME starts. Upload a PDF or image in Copy details, or paste a link. Drag the edge between the paper and the copy (or use the left and right arrow keys on it) to change how much of each shows; the width is remembered. Use the **− 100% +** buttons in its header to zoom (click the percentage to reset, or pinch / Ctrl + scroll over it); the same panel is used in every step. Links that the browser cannot read (for example Drive pages) open in a new tab with **Open link**. The Question paper button in the header opens or closes it, or asks for a file if there is none yet.

## Saved file names

Downloads are named **`testcode_studentname`** for both teams, using the UPSC test code or the Foundation paper name: for example `SD2630_Siddharth-Jain.redpen.json`, `.annotated.pdf` and `.evaluated.html`. Spaces become hyphens and characters that are not allowed in file names are dropped.

## JSON format (`redpen/v1`, schema_version 1.1)

```
{ schema, schema_version, evaluation_id, file, started_at, exported_at, minutes_spent,
  cohort, meta{copyId,test,student_name,test_code?,file_base,reviewer,subject,board?,class?,question_paper_link?},
  copy{file,page_count}, question_paper{name,link}, position_units,
  test_total_marks, annotation_counts{total,box_red,box_yellow,box_green,tick,cross,underline,strike,score,stamp,text,circle,pen},
  pages[{width,height,rotation}],
  questions[{id,max_marks,question_type,marks_obtained,attempted,objective,comment,pages_marked[],feedback_count,
             annotation_counts{...same keys},special_cases?,parameters?[{name,marks,max_marks,feedback}]}],
  overall_summary?, totals{marks_obtained,total_marks,percent,remark,questions_attempted,questions_not_attempted[]},
  needs_ops_review, cover_total{written,value,matches_total,page,position},
  final_check{completed_at,checks[],total_confirmed,cover_total_written,no_bonus_marks_confirmed,warnings_shown[],warnings[{message,kind,question,page}],
              question_flags[],page_flags[],pages_viewed[],pages_not_viewed[],input_errors[{question,typed,problem,at}]},
  annotations[{id,type,page,question,x,y,width?,height?,position,position_px,position_as_shown?,page_rotation?,
               sequence,created_at,color?,polarity?,number?,feedback?,score?,stamp?,text?,font_size?,align?,rotation?,points?,scale?,source}] }
```

**Where each mark is.** `position` is `{x, y, width, height}` as fractions (0 to 1) of the page as it was opened, origin top-left (ticks, crosses, stamps and scores have only `x`, `y`). `position_px` is the same in the page's own units (PDF points, or image pixels), matching `pages[].width/height`. If the SME turned the page, `page_rotation` and `position_as_shown` give where the mark appears on the turned page. The older top-level `x`, `y`, `width`, `height` are kept. `page` is 1-based.

**What else is recorded.** `evaluation_id` identifies the evaluation. `started_at`, `exported_at` and `minutes_spent` show how long it took. Each question has `question_type`, the SME's `comment` (the note for special cases), the pages its marks are on and how many feedback boxes it has. Each mark has `sequence` (the order it was drawn) and `created_at`. `final_check` records everything the SME was shown and confirmed at the end: the total and the cover total written, no bonus marks, every warning on screen (as text and as data), the flags on each question and page, the pages viewed and not viewed, and the wrong marks values typed (with the message shown). It lets the reviewer's choices be audited. `cover_total` says whether the total was written on the cover page; that mark is in `annotations` with `scope: "test_total"` and `question: null`, and is not counted in `annotation_counts`. `totals.questions_not_attempted` lists the unattempted questions.

- `type`: box, tick, cross, underline, strike, score, stamp, text, circle, pen.
- `polarity` (box/underline): negative = red, neutral = yellow, positive = green.
- `source`: `reviewer`, `ai`, or `ai_edited`.
- `cohort` is `foundation` or `upsc`. `parameters` and `overall_summary` appear only for UPSC. `board` and `class` appear only for Foundation.
- `rotation` is 0, 90, 180 or 270 degrees clockwise.
- `special_cases` lists the cases the SME ticked (see `docs/09-FOUNDATION-EVALUATION-RULES.md`): not legible, written elsewhere, crossed out, read another way, diagram or unit missing, question copied, handwriting not good, answer incomplete, different question answered, another language, poor photo or scan, page missing, marking scheme unclear, something else. `needs_ops_review` is true when one that needs review is ticked.
- `annotation_counts` is the number of marks on the whole copy, and on each question inside `questions`.
- Older files without the new fields still open.

## Project layout

```
public/
  index.html
  css/styles.css
  js/config.js    settings, tools, stamps, colours
  js/model.js     pure data helpers and the checks before a download
  js/export.js    JSON, import, annotated PDF, HTML
  js/app.js       UI and interaction
  vendor/         pdf.js 5.x (legacy build), pdf-lib. Self-hosted.
  assets/         sprites (tick, cross, stamps), favicon
scripts/serve.py  local static server with production headers
vercel.json
```

## Notes

- Fonts (Kalam, Reddit Sans) load from Google Fonts. To self-host, add the font files and update `index.html` and the CSP in `vercel.json`.
- Browsers: current Chrome, Edge, Safari, Firefox.
- Sprites are PNG. For sharper output at large zoom, replace them with SVG.
