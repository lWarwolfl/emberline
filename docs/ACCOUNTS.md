# Courier accounts and cloud saves

Accounts use Better Auth's username plugin with PostgreSQL. Players supply only
a username and password. The server creates an internal, non-deliverable email
identifier because Better Auth's credential schema requires it. There is no email
or social login endpoint exposed by the app.

## Run locally

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `BETTER_AUTH_SECRET` and
   `BETTER_AUTH_URL`. Generate a secret with at least 32 random characters. Set
   the URL to the exact game origin, such as `http://localhost:4173`.
2. Run `npm run db:migrate` once against the intended database. This creates the
   prefixed Better Auth tables and recovery, save and rate-limit tables. The
   migration adds missing tables and columns; it does not reset game accounts.
3. Run `npm run host`. Open the configured game address and use ACCOUNT.

`.env` is ignored and is excluded from playable static assets. Database credentials
are used only in server code. Static `file://` play still works with device saves;
cloud accounts need a configured server. A desktop/LAN host also needs its own
server environment and matching origin to offer cloud accounts.

## Vercel

The same-origin Node function is `api/account/[...action].ts`. Set the three
server environment variables in the Vercel project; use the HTTPS production
origin as `BETTER_AUTH_URL`, and keep the same secret across instances. Run the
migration against that database before deploying. The static game remains under
`public/`; the function and database access stay on the server. The local `.env`
does not configure a remote deployment.

`api/tsconfig.json` gives Vercel's function compiler a server configuration with
the repository as its source root and Node types enabled. The browser-only root
configuration remains separate. The deployment regression test checks actual
JavaScript emission for the account handler, including its server imports.

## Saved data and conflicts

The account saves the canonical economy (wallet, ownership and upgrades),
loadout/custom difficulty, best score, legacy coins and sound/effects settings.
Large currency and scores remain decimal strings. Active runs are not resumed
after closing the app. Signed-in progress uploads every 30 seconds, when returning
online and when the document becomes hidden. SYNC NOW provides a manual flush.

The first account creation uploads this device's save. Signing into an existing
account asks which save to keep if the device and cloud differ. A revision check
rejects stale uploads from another tab/device and pauses syncing until the player
explicitly chooses a save. Data is scoped to the authenticated account. The game
keeps its device save if the network fails. A sync acknowledgement proves the
database write; a local-storage acknowledgement alone does not.

## Backup codes

Creating an account presents a downloadable text backup. The random recovery code
is shown only when issued; the server stores its SHA-256 hash. FORGOT PASSWORD
requires the username, backup code and a new password. Recovery consumes the old
code, issues a replacement and revokes all sessions in one database transaction.
Signed-in users can replace a lost code by entering their current password.
Replacing a code invalidates the previous one. The account dialog explains that
the replacement must be downloaded and kept private.

Session cookies are HttpOnly; Better Auth enables secure cookies for HTTPS.
Account mutations enforce the configured origin and require a custom request
header. Database-backed attempt limits cover login, registration and recovery.
Only the app's account routes are exposed; generic Better Auth routes are not.

## Verification

`npm test` runs payload/reset validation without touching the database. To run
the opt-in live account integration against the configured database:

```powershell
$env:EMBERLINE_TEST_DATABASE = '1'
node --import tsx --test tests/accounts.test.ts
```

The live test creates two random test accounts, checks isolation, stale saves,
recovery-code consumption, password replacement and session revocation, then
deletes those test accounts and their dependent rows.
