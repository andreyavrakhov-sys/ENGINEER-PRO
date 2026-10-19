# ENGINEER PRO — FIXED RELEASE (NO NPM CI)

## Why the error repeats
The log `Run npm ci` means the **old workflow** is still running. This ZIP includes a NEW workflow at `.github/workflows/engineer-pro-fixed-release.yml`, with a distinct name: `ENGINEER PRO FIXED RELEASE (NO NPM CI)`.

## GitHub instructions
1. Upload the whole ZIP contents **including the hidden `.github` folder** into the root of the repo; GitHub's web file uploader may not preserve hidden folders, so verify `.github/workflows/engineer-pro-fixed-release.yml` exists in the repo.
2. The old `.github/workflows/windows-release.yml` remains in GitHub unless you delete it manually. Delete it in the GitHub web editor to avoid choosing the old workflow.
3. Go to Actions and select **ENGINEER PRO FIXED RELEASE (NO NPM CI)** (NOT "Build and publish ENGINEER PRO").
4. Run workflow with `0.8.4` if release v0.8.4 doesn't exist, otherwise use a new version (e.g. `0.8.5`).
5. In the job log check the first install step reads **Install dependencies (regenerate lockfile)**. If you see `Run npm ci` as the first install step, you selected the old workflow.

## Technical detail
This workflow runs `npm install` to regenerate the lockfile, then validates it with `npm ci --dry-run`, before packaging. To make future builds reproducible, commit the regenerated package-lock.json from a connected machine. This runtime cannot reach registry.npmjs.org (EAI_AGAIN), so a complete lockfile cannot be generated here.

This is SOURCE, not a Windows installer; actual GitHub Actions build still needs verification.
