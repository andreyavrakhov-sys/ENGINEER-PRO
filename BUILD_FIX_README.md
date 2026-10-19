# ENGINEER PRO 0.8.4 — build rescue (npm ci EUSAGE)

The source package-lock.json lacks dependencies added for PDF/OCR. The Windows release workflow now uses `npm install --no-package-lock` rather than `npm ci` and checks installed libraries. This is a temporary workaround; dependency versions may vary for transitive dependencies.

**Upload the entire extracted archive, including the hidden `.github/workflows/windows-release.yml` folder, to the repository root.** In GitHub, open that workflow and verify the step is named `Install dependencies (lockfile recovery)`; if it still says `Run npm ci`, the repository is running the old workflow or old commit.

Run the workflow with 0.8.4 only if release v0.8.4 does not exist.

Permanent fix: on a machine with npm registry access, run `npm install --package-lock-only --ignore-scripts` and commit the resulting package-lock.json, then restore `npm ci`.

No Windows EXE was built in this environment.
