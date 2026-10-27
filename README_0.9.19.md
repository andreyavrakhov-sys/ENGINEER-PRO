# ENGINEER PRO 0.9.19 — PDF page geometry audit

## Changes
- Added `pdf-page-audit.js`: conservative per-page accounting of coordinate-based unit/quantity anchors, failed parsing and text-layer gaps.
- Each analyzed PDF now returns `pageAudit`, included in integrated diagnostic `analysisDetails.documents[].pageAudit`.
- At most 30 problem pages and 3 short example lines per page are emitted; no absolute paths.
- Existing accepted PDF rows, quantities, candidate matching and quarantine decisions remain unchanged.
- Added `test-page-audit-0919.js` and included module in Windows packaging.

## Limitations
- This is a diagnostic improvement, not a replacement for robust multi-column PDF table reconstruction.
- PDF.js extraction remains capped at 150 pages per PDF. The report only covers scanned pages.
- OCR is not automatically activated.
- No Windows EXE was built in this environment; test the packaged app and real PDFs through Windows release workflow.
