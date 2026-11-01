# Publish a Windows release

Run these commands in the Emberline project folder on Windows.

## One-time setup

Install Node 24, Git and GitHub CLI (`winget install --id GitHub.cli`).
Restart your terminal after installing GitHub CLI, then run:

```text
npm ci
gh auth login
```

Git must also be able to push to `origin`. The script uses your current Git and
GitHub CLI authentication; no tokens belong in source code.

## Each release

1. Switch to your desktop branch, review your changes, and commit them. The
   script refuses dirty working trees and refuses `main`/`master`.
2. Choose a version higher than `package.json`, without a `v` prefix. Do not
   manually bump it first: the script does that. For example, from 7.1.0:

```text
npm run release -- 7.1.1 --dry-run
```

3. Publish when the preview looks right:

```text
npm run release -- 7.1.1 --publish
```

Without `--publish`, the script only prints its plan and changes nothing.
Use a new version for every release, for example 7.1.2 next time.

Before running, close the installed EMBERLINE app: desktop startup tests need its
fixed LAN port 4174. If tests report `EADDRINUSE`, close the app and retry after
restoring the release version changes described below.

## What it does

- Checks Windows, clean Git state, branch, GitHub login and duplicate tags/releases.
- Updates package/lock versions and the service-worker cache.
- Runs formatting, lint, types and all Node tests, then builds the Windows installer.
- Commits only release metadata and generated bundles.
- Atomically pushes the current branch and `v<VERSION>-desktop` tag, leaving main alone.
- Creates a draft GitHub release and uploads `release/EMBERLINE-Setup-<VERSION>.exe`.
- Compares GitHub's uploaded size and SHA256 with the local installer before publishing.
- Prints the published release URL.

This publishes externally and creates a local release commit/tag. It does not
commit unfinished feature work, merge main, sign the installer, run live GUI
checks, or add automatic updates. Players download the new installer from the
release's Assets section and install it over their existing copy.

## If it stops

The script stops on the first error; it never force-pushes, replaces an existing
release, or rolls back your commits. Read the error before retrying.

Before a release commit exists, fix the failure, inspect `git status`, and restore
only release-generated version/cache changes if restarting with the same version.
Do not discard feature work. Once a release commit/tag exists, do not rerun the
version bump: inspect GitHub and finish the existing release manually instead.
A failed upload/verification leaves a draft, not a published broken download.

If a stale local proxy breaks Git/GitHub CLI, repair your terminal proxy settings;
the script deliberately does not change networking or disable TLS validation.
