# ENGINEER PRO 0.9.16 — coordinate row reconstruction

- `pdf-enhanced.makeLines` preserves vertical coordinate `y`.
- `table-geometry.extractGeometry` preserves `y` on parsed candidates.
- `table-reconstruction.reconstruct` conservatively joins descriptive text within numbered PDF rows and left of the unit column, preserving quantity/unit and originalName for audit.
- Reconstruction only runs when a numbered row marker and source geometry are available; it does not guess missing quantities or claim a confirmed match.
- Warnings record the number of reconstructed names. This is a preliminary method and requires real PDF diagnostics.
- Run `npm test` for 13 regression suites.
