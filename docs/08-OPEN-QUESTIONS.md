# Confirmed workflow and requirements

## Copy assignment and evaluator workflow
1. Copies are assigned through a Google Sheet.
2. SME downloads their assigned copy from the sheet.
3. SME uploads the copy to this platform and evaluates it.
4. Each SME works on their own copy/version. Multiple SMEs may evaluate
   independently; their work must not overwrite one another.
5. After evaluation, the SME downloads the JSON, HTML, and PDF outputs.
6. The SME uploads those files to Google Drive and shares the links with the
   admin.
7. For now, this is a manual workflow. Do not assume the platform directly
   reads assignments from the sheet or uploads files to Drive.

## SME experience
The platform is for SMEs who may not have technical knowledge. Keep the
workflow simple and guide them through the evaluation steps.

SMEs need the evaluation features described in both PRDs, including the SEP
workflow and the existing annotation functionality. They should be able to
download the completed evaluation outputs.

### Foundation evaluation
- Total marks
- Question-level marks
- PDF annotations and evaluation data, including marks, feedback, highlights,
  and teacher annotation styles represented in the JSON format

### UPSC evaluation
- Total marks
- Question-level marks
- Parameter-level feedback
- Overall feedback
- PDF annotations and evaluation data, including marks, feedback, highlights,
  and teacher annotation styles represented in the JSON format

Where possible, preserve additional useful detail in the exported evaluation
data. Confirm the exact fields against the PRDs and sample JSON.

The UI must show the correct fields for the selected team:
- Foundation should not see or be asked to fill UPSC-only feedback fields.
- UPSC should see and complete its required feedback fields.

## Admin experience
The admin should be able to:
- Review copy results and evaluation data.
- Make changes to results when needed.
- Download the evaluation outputs.
- Receive the SME-provided Google Drive links.

For the current workflow, the admin can use a Google Sheet as the central
record of results and links. Confirm the exact columns, ownership, and update
process before implementation.

## Sign-in and team selection
SMEs already work with cohorts and Google Sheets. The platform should keep
access simple and should identify whether the evaluator is working on UPSC or
Foundation so it can show the correct UI.

Preferred sign-in: TBD — compare Google sign-in with a simple ID/password
option. Confirm how users will be assigned to a team and cohort. Do not assume
that selecting a team manually is secure or sufficient for production access.

## Supported devices
Web experience for laptops running Windows or macOS. Exact browser support
and minimum screen size: TBD.

## First milestone after audit approval
Audit the attached Foundation and UPSC copies against the PRDs and the current
Redpen features. Then propose the smallest first implementation milestone for
SMEs to:
1. Open/upload an assigned copy.
2. Easily annotate and evaluate it using the correct team-specific fields.
3. Download the completed JSON, HTML, and PDF files for the existing Drive
   upload and admin handoff process.