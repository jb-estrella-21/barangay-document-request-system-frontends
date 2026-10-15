# Full-stack browser verification

This package drives the two Vite apps against the sibling NestJS API. It is test-only and uses no production dependencies. Use Node.js `22.23.2` from the workspace `.nvmrc`.

The backend test suite and browser suite use separate, newly created PostgreSQL databases whose names end in `_test`. Never point either suite at development or production data. The backend E2E suite resets its database tables. The Playwright harness does not reset or migrate its database; apply the checked-in migrations first, then create its initial administrator with the backend's supported `staff:create-admin:dev` command.

Example setup (replace the database names only when creating new, unused test databases). The API E2E database and browser database must remain separate:

```sh
createdb -h 127.0.0.1 -p 55432 -U postgres barangay_phase2_api_test
createdb -h 127.0.0.1 -p 55432 -U postgres barangay_phase2_browser_test
```

Run the backend safety test before applying migrations or running E2E tests. Set all four safety-gate variables for the API-test database, and make `DATABASE_URL` a different database target. The safety suite is read-only; the E2E runner checks the live database name before clearing tables.

```sh
cd ../barangay-document-request-system-backend
env NODE_ENV=test \
  E2E_DATABASE_URL='postgresql://postgres@127.0.0.1:55432/barangay_phase2_api_test?schema=public' \
  E2E_DATABASE_NAME=barangay_phase2_api_test \
  E2E_ALLOW_DATABASE_RESET=barangay_phase2_api_test \
  DATABASE_URL='postgresql://postgres@127.0.0.1:55432/postgres?schema=public' \
  npm run test:e2e:safety -- --runInBand
env DATABASE_URL='postgresql://postgres@127.0.0.1:55432/barangay_phase2_api_test?schema=public' npm run prisma:migrate:deploy
env NODE_ENV=test \
  E2E_DATABASE_URL='postgresql://postgres@127.0.0.1:55432/barangay_phase2_api_test?schema=public' \
  E2E_DATABASE_NAME=barangay_phase2_api_test \
  E2E_ALLOW_DATABASE_RESET=barangay_phase2_api_test \
  DATABASE_URL='postgresql://postgres@127.0.0.1:55432/postgres?schema=public' \
  npm run test:e2e -- --runInBand
```

The CI workflow runs the safety suite before creating either database. In this local sequence, both databases are newly created disposable instances; the migration targets only the API-test database. The E2E suite then verifies its live `current_database()` identity and exact reset gate before it clears test tables.

Apply migrations to the browser-test database and bootstrap an administrator there. Keep the username and password in process environment only; do not commit them or capture credential-bearing pages in test artifacts.

```sh
env DATABASE_URL='postgresql://postgres@127.0.0.1:55432/barangay_phase2_browser_test?schema=public' npm run prisma:migrate:deploy
env DATABASE_URL='postgresql://postgres@127.0.0.1:55432/barangay_phase2_browser_test?schema=public' npm run staff:create-admin:dev
```

Install the test browser once, then set the browser database URL/name/confirmation and bootstrapped administrator credentials before running Playwright:

```sh
cd ../barangay-document-request-system-frontends/integration-e2e
npm ci
npm run install:browser
PHASE2_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55432/barangay_phase2_browser_test?schema=public' \
  PHASE2_TEST_DATABASE_NAME=barangay_phase2_browser_test \
  PHASE2_CONFIRM_TEST_DATABASE=barangay_phase2_browser_test \
  PHASE2_TEST_ADMIN_USERNAME='your-disposable-test-admin' \
  PHASE2_TEST_ADMIN_PASSWORD='your-disposable-test-password' \
  npm test
```

The browser harness refuses a missing or mismatched `_test` database confirmation. It starts the API and both frontends on ports 3000, 5173, and 5174, with both exact frontend origins in CORS. Test document definitions and resident details are fictional and explicitly marked `TEST ONLY`.

Install Chromium, Firefox, and WebKit when running the cross-browser smoke lane locally. The full stateful resident/staff scenario runs in Chromium; it covers catalog editing, request submission and tracking, session cookies, CSRF, ETags, and stale-version recovery. Firefox and WebKit run only the read-oriented navigation/session/responsive smoke checks at 390×844, 768×1024, and 1365×900. These checks assert key controls and page-level horizontal overflow; they are not a visual design or accessibility audit.

```sh
cd ../barangay-document-request-system-frontends/integration-e2e
npm ci
npx playwright install --with-deps chromium firefox webkit
PHASE3_BROWSER=chromium npm test
PHASE3_BROWSER=firefox npm run test:smoke
PHASE3_BROWSER=webkit npm run test:smoke
```

The CI workflow checks out backend commit `c4d4a4766febc68148741ea16776faf2df9e2b44` rather than following a moving branch. Change that SHA only after a compatibility review and passing integration verification. If the backend repository is private, set an Actions secret called `BACKEND_READ_TOKEN` with read-only access. The CI checkout deliberately has no branch fallback. The local CLI bootstrap uses the backend's supported `npm run staff:create-admin:dev` command; the CI-only `scripts/bootstrap-admin.py` supplies its hidden prompts through a pseudo-terminal and suppresses all CLI output.

Playwright writes no traces, screenshots, videos, or retained output. Do not enable those artifacts without a redaction and retention plan for tracking credentials and temporary staff passwords.

If a default port is already occupied, leave that service untouched and set `PHASE2_API_PORT`, `PHASE2_RESIDENT_PORT`, and/or `PHASE2_STAFF_PORT` to free local ports. Before starting any server, the harness briefly binds each selected port to check availability; it does not send an HTTP readiness request to an occupied port. The harness points both frontends at the configured API port and constructs the exact CORS allowlist from the chosen frontend origins.
