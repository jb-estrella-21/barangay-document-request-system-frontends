# Barangay document request frontends

This workspace contains two independent React applications for the existing Barangay Document Request API:

- `frontend-website` is the public resident experience.
- `frontend-admin` is the authenticated staff portal.

Both apps default to `http://localhost:3000/api/v1`. Copy each app’s `.env.example` to `.env.local` to override `VITE_API_BASE_URL` for another backend. Never place backend credentials or signing secrets in Vite environment variables; values prefixed with `VITE_` are public in the built application.

## Run locally

Start the backend at `http://localhost:3000`, then in separate terminals run:

```sh
cd frontend-website && npm run dev
cd frontend-admin && npm run dev
```

The resident app uses `http://localhost:5173`; the staff app uses `http://localhost:5174`. Configure the backend’s exact `CORS_ORIGINS` allowlist with `http://localhost:5173,http://localhost:5174`. For local HTTP development, configure the backend session cookie as non-secure; deployed environments should use HTTPS and the backend’s secure cookie settings.

## Build and checks

Run `npm run typecheck` and `npm run build` inside each application. The build script typechecks before producing the static bundle in that app’s `dist/` directory. `npm run dev` and `npm run preview` serve only that application.

## Integration notes

The API owns document names, requirements, dynamic field labels, current request status messages, and staff-visible history. The UI translates its own labels and lifecycle names but displays backend-managed text as returned. The request submission confirmation shows the reference and private tracking credential once; the credential is held only in in-memory navigation state and is never placed in a URL or browser storage.

The staff portal uses the backend’s cookie session, restores `/staff/auth/me` on load, keeps the CSRF token in memory, and sends the current request ETag with status and release-date changes. Role checks in the UI only control navigation; the backend remains authoritative.
