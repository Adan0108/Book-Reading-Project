# Testing and evidence

Use Node.js 24+ and run `npm ci` in both packages. On this Windows installation invoke `npm.cmd`. Commands below run from the named directory.

| Directory | Commands |
|---|---|
| backend | `npm run typecheck`, `npm test`, `npm run build` |
| frontend | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` |
| frontend, real services | `npx playwright install chromium`, `npm run test:e2e` |

Backend ESLint is not configured. Strict TypeScript, HTTP/service and real integration tests provide the configured backend checks. Tests requiring MySQL skip unless `PUBLISHING_TEST_DATABASE=publishing_qa` is explicitly set. Do not report an opt-out run as full integration evidence.

## Existing isolated QA fixture

Real integration/browser tests deliberately force `publishing_qa` on localhost:3307 and local SMTP sinks. The retained MySQL 8.0.21 container is `book-publishing-qa-20261104`; the harness uses the existing local Redis without flushing it. They never repoint the normal application database. See [historical fixture setup and limits](../publishing/PUBLISHING_REPORT.md).

```powershell
# backend
$env:PUBLISHING_TEST_DATABASE='publishing_qa'
npm.cmd test
npm.cmd run build
# frontend, after the backend build finishes
npm.cmd run test:e2e
```

Headed Chromium is the default; `PW_HEADLESS=1` enables CI mode. The harness serves the actual API, SMTP/mailbox and frontend. The payment fixture is labeled simulation and exists only in tests, while the raw SDK-signed webhook, database grants and UI remain real. **The image journeys perform real retained Cloudinary uploads.** Run them intentionally with the configured test account; do not delete existing cloud assets to clean a test. Traces/screenshots stay ignored under `frontend/test-results/`.

## Fresh Compose verification

The separate root application Compose stack uses MySQL 8.4, Redis 8, Nginx, backend and a development mailbox. It must use a unique project name and fresh volumes, never the owner's normal database. Verification should cover an empty schema, built frontend/API, registration/mail, operator admin provisioning, author approval, text-only publishing/reading, readiness/outages and persistence across recreation. Results are recorded only after execution in the [running test report](../mvp/TEST_REPORT.md).

The existing verification project is `hibook-mvp-verification-20261105`, using ignored `.env.compose.qa`, application port 8087 and Mailpit port 8027. Once it is running, from `frontend/` execute `$env:COMPOSE_QA_ALLOW_WRITES='1'; npm.cmd run test:compose`. This opt-in test creates local accounts, grants one administrator through the operator CLI, stops/restarts only that project's Redis, and recreates only its backend. It sends no external mail, uploads no images and performs no financial transaction. It preserves volumes. Do not point it at an unrelated project; alternative fixture names must retain the `hibook-mvp-verification-` prefix.

The [test report](../mvp/TEST_REPORT.md) distinguishes current automated evidence, historical publishing results, failed checks that were fixed, and unavailable external-provider verification. The [original audit reproduction script](../mvp-audit/verify-mvp.cjs) intentionally demonstrated old vulnerabilities and is not the current regression suite. A passing fixture checkout does not verify external Stripe; a local mail sink does not verify external SMTP or production TLS.

For a fresh checkout, first provision the isolated MySQL fixture described above and a local trusted Redis on port 6379; the suite will not create those host services. If the retained fixture exists but is stopped, run `docker start book-publishing-qa-20261104`. Never start a conflicting service or flush an existing Redis. The harness fixes its QA database/SMTP settings explicitly; see `backend/tests/qa-environment.ts` and `backend/tests/serve-qa.cjs` for the local fixture contract.

If Cloudinary test credentials/preset are unavailable, run the independent non-media browser subset with `npm.cmd run test:e2e -- --grep-invert 'direct Cloudinary uploads|inline illustrations|optional post artwork'`. This deliberately excludes three real-upload journeys and must not be reported as a passing full suite. Full-suite release evidence above was executed with actual configured Cloudinary uploads.
