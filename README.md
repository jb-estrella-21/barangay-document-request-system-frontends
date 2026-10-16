# Barangay Document Request System — Frontends

This repository contains two independent Vite applications: `frontend-website` for residents and `frontend-admin` for staff. Both use same-origin Cloudflare Pages Functions as an API proxy to the separately maintained NestJS backend.

## Demonstration deployment

The current demonstration endpoints are:

- Resident website: <https://barangay-document-resident.pages.dev>
- Staff portal: <https://barangay-document-staff.pages.dev>
- Backend API: <https://barangay-document-request-system-backend.onrender.com>

The owner reports that Phase 5D completed all nine hosted functional checks, including resident request/tracking and staff authentication, session restoration, and protected-route checks. This repository review did not repeat those hosted workflows. Use fictional information only. The free-tier demonstration is not approved for real resident records or public service.

See [the Phase 5E-A frontend deployment runbook](docs/phase5e-a-frontend-deployment-runbook.md) for current project configuration, local checks, guarded manual deployment, hosted smoke checks, rollback, and troubleshooting. The earlier [Phase 5B architecture and hosting notes](docs/phase5b-deployment-preparation.md) provide the free-tier and security context.

## Local development

Use Node.js `22.23.2`, as pinned in `.nvmrc`. Each application is independent and has its own package manifest, lockfile, tests, and build output. There is no root npm workspace.

Install each app's dependencies and start the API at `http://localhost:3000`:

```sh
npm --prefix frontend-website ci
npm --prefix frontend-admin ci
npm --prefix integration-e2e ci
npm --prefix frontend-website run dev
npm --prefix frontend-admin run dev
```

The resident app listens on `http://localhost:5173`; staff listens on `http://localhost:5174`. The backend CORS allowlist must contain these exact development origins and allow credentialed requests for the staff app. Local app examples use `VITE_API_BASE_URL=http://localhost:3000/api/v1`. Never put backend credentials, session tokens, or signing keys in `VITE_` variables; Vite embeds them in public JavaScript.

For either app, run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` from its directory. The build script typechecks first.

## CI and integration checks

`.github/workflows/ci.yml` runs independent frontend checks, mocked UI/accessibility checks, Pages proxy packaging tests, and a separately gated full-stack integration job. The integration job pins a reviewed backend commit and uses newly created `_test` databases with database identity checks and the backend's exact reset gate. It does not deploy. Consult GitHub Actions for current remote run status; this local review did not query a new workflow run.

The resident UI keeps an uncertain submission's exact body and idempotency key for safe manual retry. Its session marker contains only a timestamp. Tracking credentials remain in tab memory and are not written to URLs, browser history, or storage. The staff portal uses an HttpOnly cookie, in-memory CSRF token, ETags, and `If-Match`; the backend remains authoritative for roles and state changes.

## Repository layout

- `frontend-website/` — public bilingual resident app.
- `frontend-admin/` — authenticated bilingual staff app.
- `functions/api/v1/[[path]].ts` — shared Pages API proxy.
- `wrangler.resident.jsonc`, `wrangler.staff.jsonc` — separate Pages project configs.
- `scripts/pages.sh` — packaging checks and approval-gated manual deployment.
- `integration-e2e/` — mock-only UI/proxy suites and isolated full-stack Playwright harness.
- `docs/` — deployment and operational handoff.
