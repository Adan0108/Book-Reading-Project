# Current implementation verification

4 November 2026 (Australia/Sydney). Run commands from the named package directory using `npm.cmd` on this Windows host. Earlier audit evidence remains historical.

| Directory / command | Observed result |
|---|---|
| `backend`: `$env:PUBLISHING_TEST_DATABASE='publishing_qa'; npm.cmd test` | 38 passed in four files, including real MySQL auth/approval and publishing integration; final run 22:41 Sydney |
| `backend`: `npm.cmd run typecheck` | Passed |
| `backend`: `npm.cmd run build` | Passed; runtime assets copied |
| `frontend`: `npm.cmd run typecheck` | Passed |
| `frontend`: `npm.cmd run lint` | Passed |
| `frontend`: `npm.cmd test` | 11 passed in three files |
| `frontend`: `npm.cmd run build` | Passed; existing bundle-size, DaisyUI and Node warnings remain |
| `frontend`: `npm.cmd run test:e2e -- auth.spec.ts` | One headed Chromium journey passed: registration, local SMTP OTP, secure setup, role rejection, application, admin approval, draft creation, reload, password reset, old-token rejection and new login. Zero Cloudinary uploads. |
| `frontend`: `npm.cmd run test:e2e` | All three passed in headed Chromium (31.3 s). Includes cross-tab restoration and rapid full navigation, actual signed Cloudinary upload/confirmation, sorting/reopening/publishing/reader order, legacy Markdown and unauthenticated rejection. Four test uploads were retained; no deletion. |
| Root: `git diff --check` | Passed before final documentation additions; rerun before staging |

Auth integration covers invalid/expired/reused OTP, exhausted attempts, missing/forged/expired/consumed setup proof, explicit RS256/purpose/caller checks, JTI revocation, atomic concurrent rotation and replay family revocation, password reset invalidation, logout/all, blocked accounts, expired sessions, stale-password issuance, approved/unapproved author boundaries, IP-independent account throttling and safe abandoned-registration cleanup. Existing publishing tests cover ownership, ordering, rollback and migration reruns.

Only the named `publishing_qa` schema on localhost:3307 is used. New migrations ran twice through the runner to verify tracked re-entry. The local QA SMTP sink binds loopback ports 2526/2527 and retains at most 100 test messages in memory; no real recipients receive mail. It is outside application source/production build. Redis is not flushed. Dependency installation added only a development SMTP sink; the existing backend audit still reports 9 moderate and 1 high advisory and needs a separate dependency review.

The first browser run failed on a test locator (`Email` versus the actual `Email Address` label); the corrected journey passed. An initial integration fixture reused the globally unique username `Reader`; it now generates a unique fixture username. The full suite then exposed refresh interruption during rapid navigation. The HttpOnly access-cookie restoration endpoint fixed that reproducible regression; the unchanged navigation sequence passed afterwards. No failed run is represented as a passing result.

Normal-database migration, real SMTP delivery, production HTTPS/proxy/cookie behavior and later MVP modules remain unverified. No deployment has occurred.
