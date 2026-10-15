# Barangay document request frontends

This workspace contains two independent React applications for the existing Barangay Document Request API:

- `frontend-website` is the public resident experience.
- `frontend-admin` is the authenticated staff portal.

Both apps default to `http://localhost:3000/api/v1`. Copy each app’s `.env.example` to `.env.local` to override `VITE_API_BASE_URL` for another backend. Never place backend credentials or signing secrets in Vite environment variables; values prefixed with `VITE_` are public in the built application.

Use Node.js `22.23.2` as recorded in `.nvmrc`. Both application manifests also require Node `22.23.x`. The apps remain independent Vite projects with separate package manifests, lockfiles, and scripts; there is no root npm workspace.

## Run locally

Start the backend at `http://localhost:3000`, then in separate terminals run:

```sh
cd frontend-website && npm run dev
cd frontend-admin && npm run dev
```

The resident app uses `http://localhost:5173`; the staff app uses `http://localhost:5174`. Configure the backend’s exact `CORS_ORIGINS` allowlist with `http://localhost:5173,http://localhost:5174`. For local HTTP development, configure the backend session cookie as non-secure; deployed environments should use HTTPS and the backend’s secure cookie settings.

## Build and checks

In each application, run `npm ci`, then use `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. The build script typechecks before producing the static bundle in that app’s `dist/` directory. `npm run dev` and `npm run preview` serve only that application.

## Continuous integration

`.github/workflows/ci.yml` runs the resident and staff checks independently on pushes to `main` or `master`, pull requests, and manual dispatch. Its integration job checks out the backend at the reviewed commit `c4d4a4766febc68148741ea16776faf2df9e2b44`, runs the backend E2E safety suite first, and creates separate PostgreSQL databases for API E2E and browser tests. Both databases are created inside an ephemeral PostgreSQL service and end in `_test`; the backend E2E reset gate and live database identity check remain enabled. The job then runs the real Chromium resident/staff workflow and Firefox/WebKit responsive smoke tests. It does not deploy.

The backend commit is pinned intentionally so unrelated backend branch changes cannot alter frontend CI. Update the `ref` in the workflow only after reviewing API compatibility and validating the frontend against the new backend commit. GitHub access to that exact commit has not been verified from this workspace; the checkout fails rather than falling back to a branch if the commit is missing. If the backend repository is private, configure a fine-grained Actions secret named `BACKEND_READ_TOKEN` with read-only Contents access to that repository. This frontend repository currently has no GitHub remote, so actual GitHub Actions results will be available only after the repository is created and these changes are pushed.

The workflow pins its GitHub Actions by immutable commit SHA. Its Node version comes from `.nvmrc`; npm dependency installs use the checked-in lockfiles. Playwright traces, screenshots, videos, and retained test output are disabled so temporary staff and resident tracking credentials do not enter artifacts.

## Integration notes

The API owns document names, requirements, dynamic field labels, current request status messages, and staff-visible history. The UI translates its own labels and lifecycle names but displays backend-managed text as returned. The request submission confirmation shows the reference and private tracking credential once; the credential is handed off through tab-local JavaScript memory and is never placed in a URL, history state, or browser storage.

The staff portal uses the backend’s cookie session, restores `/staff/auth/me` on load, keeps the CSRF token in memory, and sends the current request ETag with status and release-date changes. Role checks in the UI only control navigation; the backend remains authoritative.

## Full-stack integration tests

See [integration-e2e/README.md](integration-e2e/README.md) for local database setup, exact safety-gate variables, the supported administrator bootstrap, browser commands, configured ports, and troubleshooting. Never point the backend E2E or browser harness at a development or production database.
