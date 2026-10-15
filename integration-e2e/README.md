# Full-stack browser verification

This package drives the two Vite apps against the sibling NestJS API. It is test-only and uses no production dependencies.

The backend test suite and browser suite use separate, newly created PostgreSQL databases whose names end in `_test`. Never point either suite at development or production data. The backend E2E suite resets its database tables. The browser suite does not reset or migrate its database; apply the checked-in migrations to its new database and create its initial administrator with the backend's supported `staff:create-admin:dev` command.

Example setup (replace the database names only when creating new, unused test databases):

```sh
createdb -h 127.0.0.1 -p 55432 -U postgres barangay_phase2_api_test
createdb -h 127.0.0.1 -p 55432 -U postgres barangay_phase2_browser_test
```

Run the backend safety test before the E2E suite. Set all four safety-gate variables for the API-test database, and make `DATABASE_URL` a different database target. The E2E runner checks the live database name before clearing tables.

```sh
cd ../barangay-document-request-system-backend
npm run test:e2e:safety -- --runInBand
env NODE_ENV=test \
  E2E_DATABASE_URL='postgresql://postgres@127.0.0.1:55432/barangay_phase2_api_test?schema=public' \
  E2E_DATABASE_NAME=barangay_phase2_api_test \
  E2E_ALLOW_DATABASE_RESET=barangay_phase2_api_test \
  DATABASE_URL='postgresql://postgres@127.0.0.1:55432/postgres?schema=public' \
  npm run test:e2e -- --runInBand
```

Apply migrations to the browser-test database and bootstrap an administrator there. Keep the username and password in process environment only; do not commit them or capture credential-bearing pages in test artifacts.

```sh
env DATABASE_URL='postgresql://postgres@127.0.0.1:55432/barangay_phase2_browser_test?schema=public' npm run prisma:migrate:deploy
env DATABASE_URL='postgresql://postgres@127.0.0.1:55432/barangay_phase2_browser_test?schema=public' npm run staff:create-admin:dev
```

Install the test browser once, then set the browser database URL/name/confirmation and bootstrapped administrator credentials before running Playwright:

```sh
cd ../barangay-document-request-system-frontends/integration-e2e
npm install
npm run install:browser
PHASE2_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55432/barangay_phase2_browser_test?schema=public' \
  PHASE2_TEST_DATABASE_NAME=barangay_phase2_browser_test \
  PHASE2_CONFIRM_TEST_DATABASE=barangay_phase2_browser_test \
  PHASE2_TEST_ADMIN_USERNAME='your-disposable-test-admin' \
  PHASE2_TEST_ADMIN_PASSWORD='your-disposable-test-password' \
  npm test
```

The browser harness refuses a missing or mismatched `_test` database confirmation. It starts the API and both frontends on ports 3000, 5173, and 5174, with both exact frontend origins in CORS. Test document definitions and resident details are fictional and explicitly marked `TEST ONLY`.

If a default port is already occupied, leave that service untouched and set `PHASE2_API_PORT`, `PHASE2_RESIDENT_PORT`, and/or `PHASE2_STAFF_PORT` to free local ports. The harness points both frontends at the configured API port and constructs the exact CORS allowlist from the chosen frontend origins.
