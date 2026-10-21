# ENGINEER PRO 0.9.11 — detailed evidence diagnostics

- One-click diagnostics now include `analysisDetails` in the JSON output whenever real estimate and PDF files were selected and reconciliation succeeded.
- `analysisDetails.documents`: document classification, number of pages, extracted positions, warning count and five extracted sample positions per PDF.
- `analysisDetails.positions`: up to 500 project positions with page/line, quantities, status, human-readable rejection reason, confirmed estimate row if any and up to three possible candidates (code, estimate sheet and row, score, quantity, unit, difference).
- `analysisDetails.summary`: counts by reconciliation status and truncation flag.
- Privacy: names of positions and PDF base filenames are included in the JSON, but not full PDF text, absolute paths or API keys. Review the JSON before sharing.
- The report is diagnostic evidence, not proof of estimate correctness. OCR, AI, remote updates and all UI actions are not tested.

## How to test
1. Build Windows 0.9.11 from the complete source package.
2. Open Diagnostics, select the same estimate and all nine project PDFs, run full diagnostics.
3. Export JSON and inspect `analysisDetails.positions` and `analysisDetails.documents`.
4. Send the JSON for root-cause analysis.

## Local verification
`npm test` passes; `node --check main.js` passes. Windows installer not built or tested in this environment.
