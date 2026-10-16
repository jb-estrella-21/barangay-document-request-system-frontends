# Resident website

Public bilingual React application for browsing active document types, submitting anonymous requests, and privately tracking request progress. The demonstration deployment is <https://barangay-document-resident.pages.dev>; it is not approved for real resident records. Use Node.js `22.23.2` from the workspace `.nvmrc`.

For local development, set `VITE_API_BASE_URL` in `.env.local` if the API is not at `http://localhost:3000/api/v1`. Production Pages builds force `/api/v1` so browser requests remain same-origin. Run `npm ci`, then `npm run dev` (port `5173`). Use `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` for local checks. Manual deployment and hosted checks are documented in the [frontend deployment runbook](../docs/phase5e-a-frontend-deployment-runbook.md); full-stack Playwright commands are in the [integration-test README](../integration-e2e/README.md).

Document content and status messages come from the API and are shown as returned. Submission references and tracking credentials are not stored in URLs or browser storage.
