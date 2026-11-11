# Foundation Evaluation Rules

Source: rules supplied by the product owner (pasted into the audit session).
Transcribed as given. Items marked **[Check]** are possible typos or unclear
references in the source and need confirmation.

---

## 1. Evaluation Guidelines
What principles should every evaluator follow?

### Evaluation philosophy
1. SME score is ground truth. AI score is what is being measured against it, never the other way round.
2. Grading follows the board's own marking-scheme conventions below, not personal interpretation, so the same answer gets the same marks regardless of which SME grades it.
3. Every copy is evaluated on two outputs together: marks awarded and feedback given.
4. A deviation is only useful if it is explainable. Every mismatch gets a reason (error category + root cause), not just a marks difference.

### CBSE: General Evaluation Instructions
1. Follow the marking scheme / rubric value points. Don't grade on personal interpretation.
2. If a student's answer is correct but different from the model answer (newer info, alternate approach, different wording for the same concept), it should still get due marks. Don't reject just because it is not an exact match.
3. For competency-based questions specifically, if the concept demonstrated is correct even in different words, give due credit.
4. Every answer/part must be assessed. Nothing is left unmarked.
5. Multi-part questions: award marks part-wise, then total.
6. Don't penalise the same mistake twice. If one wrong value is carried forward through later steps in a numerical, the later correct method still gets credit (no cumulative penalty).
7. Never award more than the marks assigned to a question/part.

### ICSE / CISCE: Evaluation Guidelines
1. Step-wise marking. Credit is given for correct steps/working, not only the final answer. Applies mainly to Math, Physics, Chemistry numericals.
2. A different but logically correct method gets full or appropriate credit, even if it doesn't match the model solution's path.
3. Diagrams are scored separately for accuracy, labelling and units, not folded into the main answer marks.
4. A fully wrong answer gets zero, no partial-credit guessing.
5. Half-correct answers should never be marked fully wrong. The correct part still gets credit.
6. Leaving any part of an answer unassessed, or making totalling/transfer errors, is treated as a serious evaluator mistake.

---

## 2. Foundation Evaluation SOP
The step-by-step process every SME follows for every single question, every single copy.

| Step | Sub-points |
|---|---|
| 1. Identify question type | MCQ / Short Answer / Long Answer / Numerical / Diagram / etc. |
| 2. Read the question completely | Understand exactly what the question asks. |
| 3. Refer to question-specific rubric | Identify: expected components; marks split; accepted alternatives; partial-credit conditions; deduction rules. |
| 4. Read student's complete answer | Don't start assigning marks after reading only the first line. |
| 5. Assign marks | Marks should be based on the mapping in Step 5, not on a separate, independent judgement. **[Check]** The source says "Step 5" here. It probably means the rubric mapping from Step 3. |
| 6. Write feedback | Feedback should explain the student's gap: which component was missing/incorrect and why marks were deducted for it. |
| 7. Final consistency check | Check: Marks <-> Answer <-> Feedback. These three must agree with each other. |

### Marks <-> Answer <-> Feedback consistency rule
This is one of the strongest guidelines in this SOP. Marks, the actual answer, and the feedback must all agree. A mismatch between any two of them is an evaluation-quality issue, not just a scoring issue, and is exactly what the Golden Dataset (Sheet 6) is built to catch.

---

## 3. Rubric rules: Objective vs Subjective

### Objective questions (MCQ / True-False / Fill-in-the-blank / One-word / Matching)
| Rule | Description |
|---|---|
| Binary scoring | Full marks if correct, zero if wrong. No partial credit. |
| Answer variants | Accept the option letter, full option text, and a reasonable paraphrase as correct (e.g. 'B', '(B) xy2', 'xy2'). |
| Blank / not attempted | Zero. Don't guess intent. |
| Multiple options marked | Zero. Ambiguous response is treated as incorrect. |

### Subjective questions (Short answer / Long answer / Numerical / Language)
| Case | Marks to award | Why |
|---|---|---|
| Blank / not attempted | 0 | Nothing to assess. |
| Only the question re-written, no actual answer given | 0 | No answer content present to credit. |
| Fully wrong or irrelevant answer | 0 | CBSE rule: totally incorrect answer gets zero, no partial-credit guessing. |
| Partially correct (some right steps/points, rest wrong or missing) | Marks for the correct steps/points only | ICSE step-wise marking. CBSE: half-correct answers shouldn't be marked fully wrong. |
| Correct final answer via a different valid method than the model answer | Full or appropriate credit for that method | CBSE: alternate but correct approaches must be assessed on merit, not rejected for not matching. |
| Correct concept shown, different wording from model answer | Due credit for the concept demonstrated | CBSE: competency-based grading. |
| One earlier mistake carried forward through later correct steps | Later correct steps still get credit, no repeat penalty | CBSE: no cumulative penalty for a single error. |
| Diagram-based answer | Diagram, labelling and units scored as separate criteria | ICSE: diagrams carry independent credit. |
| Numerical: correct method but wrong/missing final value or unit | Method marks awarded; final-answer marks depend on the rubric's stated tolerance/unit rule | Governed by the rubric's numeric tolerance and step split. Flag to product/DS if the unit rule feels stricter or looser than board convention. |

---

## 4. Sheet 4: Edge Cases & Decision Rules
What happens in ambiguous situations?

| Edge case | Decision rule |
|---|---|
| Handwriting partially illegible | Grade what can be confidently read; mark the unreadable portion as 'Not legible' in comments. Don't zero the whole answer only because part of it is unreadable, unless the illegible part is the majority of the answer. |
| Answer written out of sequence, in the margin, or on an extra sheet | Locate and grade wherever it is written; award marks as if it were in the right place. Board convention allows overflow/extra sheets. |
| Student crosses out an answer and writes another | Grade only the final, non-crossed-out answer. Ignore the crossed-out portion entirely. Don't average the two. |
| Question has more than one reasonable interpretation | Accept any interpretation that is a reasonable reading of the question and internally consistent. Don't penalise for choosing a valid alternate interpretation. |
| Diagram missing but correctly described in text (or vice versa) | Award diagram-criterion marks only if the rubric explicitly allows a text description in place of a drawing. If the rubric is silent, award only the text-criterion marks and log this as a rubric gap. |
| Numerical answer correct but unit missing or wrong | Apply the rubric's stated unit-tolerance rule. If the rubric is silent, award method marks in full and log Error Category = Rubric-Design. |
| Answer is copied verbatim from the question stem, no original content added | Zero marks. Falls under the 'no answer content' rule (Marking boundaries). |

---

## 5. Notes for the Redpen audit (to confirm, not requirements yet)
- **Edge cases and reasons:** several rules ask the SME to log a reason: "Not legible" in comments, "rubric gap", and "Error Category = Rubric-Design". The Evaluation philosophy also asks for an error category and root cause for every mismatch. The vision doc asks how edge cases and reasons should be represented. The field list, allowed values, and whether the SME enters them in Redpen are **not yet defined**.
- **Consistency rule (Marks <-> Answer <-> Feedback):** a human check. Whether Redpen should enforce any part of it (for example, a question with 0 marks must have feedback) is undecided.
- **Not-attempted and objective questions:** these rules match Redpen's existing "Not attempted" and "Objective" flags (not attempted = 0, objective = no stamp).
- **References to "Sheet 4" and "Sheet 6 (Golden Dataset)":** these point to a Google Sheet I haven't seen. Its columns are needed to define the Sheet mapping.
