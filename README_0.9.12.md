# ENGINEER PRO 0.9.12 — PDF column geometry (conservative)

## Fixed
- PDF.js text rows retain x coordinates of each text fragment.
- A new geometry-first extractor reads the first numeric cell immediately to the right of a recognized unit cell; subsequent cells (mass, notes, price) are not concatenated into quantity.
- For multi-fragment rows where geometry is ambiguous, the application does NOT fall back to flattened-line quantity inference. It leaves such rows for manual verification instead of inventing quantities.
- The older single-fragment text/OCR path remains as a limited fallback.
- Two new integrated diagnostic oracles and four regression assertions cover column boundaries (8 vs 2,800; 4 vs 4).

## Important limitations
- This is a safety-first fix, not a complete multi-column table reconstruction. PDF.js may combine several visual cells into a single text fragment; such cases still need column segmentation and verification.
- Fewer extracted rows can be correct when false positives are removed; zero matches is still a quality warning.
- Windows EXE must be built using GitHub Actions. Tests here run under Node, not a packaged Windows build.

## Build
Upload the entire ZIP contents to the repository, then use the existing Windows Release GitHub Actions workflow. `npm ci` uses the included synchronized lockfile. Run `npm test` locally or in CI.
