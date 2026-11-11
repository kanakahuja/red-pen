# Redpen — Subjective Copy Evaluation Tool

## Product goal
Redpen is a web-based tool for evaluators to review students’ subjective
answer copies, annotate PDFs, enter marks, and provide feedback.

## Users
- Evaluators / SMEs: review assigned student copies.
- Admins: manage access, assignments, evaluation data, and exports.
- Teams: UPSC and Foundation.

## Main evaluation flow
1. Open an assigned student copy and its evaluation data.
2. Review the answer PDF, moving between pages and questions.
3. Add annotations to the PDF.
4. Enter or update marks and feedback.
5. Save the evaluation.
6. Export or send the required evaluation data.

## Team-specific requirements
### UPSC
- Parameter-level feedback: required / TBD
- Overall feedback or summary: required / TBD

### Foundation
- Parameter-level feedback: not required / TBD
- Overall feedback or summary: not required / TBD

Confirm these rules against the PRDs. Do not assume a team based only on the sample data.

## Required outputs
- Evaluation JSON: TBD — confirm exact schema and destination.
- Annotated PDF: TBD — confirm whether this is required for every evaluation.
- HTML report: TBD — confirm required contents and destination.
- Google Sheet: TBD — confirm sheet, columns, and update rules.
- Metabase: TBD — confirm data source and reporting needs.

## Existing project
The current project is named Redpen. It is a static web app. Read the root
README.md and inspect the existing code to identify its actual functionality.
Do not assume every listed feature is complete or working.

## Design direction
Use the supplied Result Experience screenshots and design notes as the visual
reference. Record any required fonts, sizes, colours, and layout details in
docs/04-DESIGN-REFERENCES/notes.md.

## Scale and future needs
The product may later support multiple users and admins, more evaluation teams,
and additional reporting or export features. Recommend an architecture that
can grow, but base the recommendation on the PRDs and audit findings.

## Constraints for the first audit
- Read the PRDs, design references, sample JSON, README.md, and existing code.
- Do not edit or create application files during the audit.
- Do not install packages or begin implementation.
- Report uncertainties instead of guessing.
- Wait for my approval before making changes.