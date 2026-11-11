# Product Vision and Scope — Redpen

## 1. Product goal
Build a web-based subjective answer-copy evaluation platform for SMEs and
admins. SMEs should be able to evaluate a copy easily, without needing
technical knowledge. The experience should follow the supplied AI Grader
Result Experience design in Figma.

This product is being built for the requirements in both PRDs:
- New Result Experience
- Hybrid Flow — SEP + AI

Read both PRDs fully. They are the detailed requirements; this document gives
the overall product context.

## 2. Existing project and repository
The existing project is Redpen. Inspect its current code and README before
recommending changes. Preserve and account for its existing useful features.

Use the existing project repository as the starting point. Do not create a
separate replacement project unless the audit explains why it is necessary
and I approve that approach.

## 3. Current workflow
1. Copies are assigned through a Google Sheet.
2. An SME downloads their assigned copy.
3. The SME uploads the copy to the evaluation platform.
4. The SME evaluates it and downloads the completed JSON, HTML, and PDF.
5. The SME uploads the files to Google Drive and shares the links with the
   admin.
6. The admin reviews results, makes changes if needed, and downloads outputs.

Keep this workflow simple for SMEs. Do not assume direct Google Sheets or
Google Drive integration exists; assess it as a possible future improvement.

## 4. User roles and access
### SME
- Sign in to the platform.
- Evaluate copies using the appropriate team workflow.
- Annotate the answer PDF and enter required marks and feedback.
- Download completed evaluation outputs.

### Admin
- Review evaluation results and changes.
- Make corrections where needed.
- Download evaluation outputs.
- Manage or review the current Sheet and Drive handoff.

The platform must include login. Recommend a secure, simple sign-in approach
for SMEs and admins. Compare Google sign-in and ID/password if requirements
do not settle the choice. Explain how the system will identify the user's
team and role. Do not implement authentication during the audit.

## 5. Team-specific evaluation
The platform must show the correct evaluation fields for the evaluator's team.

### UPSC
- Total marks
- Question-level marks
- Parameter-level feedback
- Overall feedback
- PDF annotations and evaluation data, including marks, feedback, highlights,
  and teacher annotation styles

### Foundation
- Total marks
- Question-level marks
- PDF annotations and evaluation data, including marks, feedback, highlights,
  and teacher annotation styles

Foundation SMEs must not see or be asked to fill UPSC-only fields.

## 6. Data and outputs
Required outputs include:
- JSON evaluation data
- Annotated PDF
- HTML output
- Google Sheet data for the golden dataset and reporting

The current SME handoff uses downloaded files uploaded to Google Drive, with
links shared with the admin. The admin needs access to the results and the
ability to download and correct them.

Review the PRDs and sample API JSON to identify exact fields. Treat the sample
JSON as an example, not the complete API contract. Identify how first-page
content and marks should map to the Sheet, and how edge cases and their
reasons should be represented. Report unclear details; do not invent a schema.

## 7. Design requirements
Use the supplied Figma design as the visual source of truth:
https://www.figma.com/design/5pQKwlt2uuLCQ21xyIx2vI/AI-Grader-Main?node-id=20981-20185

Also inspect the local screenshots, SVG (if present), and design notes in
`docs/04-DESIGN-REFERENCES/`.

Do not apply a generic starter design or redesign the experience from scratch.
Match the referenced typography, font sizes, layout, colours, spacing,
components, and relevant interaction states. Record any inaccessible or
unclear design details in the audit.

## 8. Future scope
The product may later need:
- Separate SME and admin capabilities.
- Team-specific workflows and additional teams.
- Admin access to evaluation data, history, and corrections.
- Google Sheets and Google Drive integration to reduce manual handoffs.
- Metabase reporting.
- More detailed evaluation and annotation data.
- Support for 100+ SMEs working at the same time.
- A maintainable architecture that supports adding features over time.

These are future requirements to consider in architecture planning. Do not
build all future scope in the first milestone.

## 9. First milestone
After the audit and my approval, propose a small first milestone that lets an
SME:
1. Sign in and be associated with the correct role/team.
2. Open or upload a copy.
3. Evaluate it using the correct UPSC or Foundation fields.
4. Annotate the PDF.
5. Download JSON, HTML, and PDF outputs for the current admin handoff.

Use the attached Foundation and UPSC copies as audit examples from docs/samples copy

## 10. Audit guardrails
During the initial audit:
- Read this brief, both PRDs, the Figma references, sample JSON, and README.
- Inspect the existing code and repository structure.
- Use the existing GitHub repository as context if access is available.
- Do not edit, create, delete, rename, or reformat files.
- Do not install packages or implement features.
- Report findings, trade-offs, missing requirements, and questions.
- Wait for my approval before changing files.