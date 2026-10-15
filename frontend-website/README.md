# Resident website

Public bilingual React application for browsing active document types, submitting anonymous requests, and privately tracking request progress. Use Node.js `22.23.2` from the workspace `.nvmrc`.

Set `VITE_API_BASE_URL` in `.env.local` if the backend is not at `http://localhost:3000/api/v1`. Run `npm ci`, then `npm run dev` (port `5173`). Use `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` for local checks. CI and full-stack Playwright commands are documented in the workspace and [integration-test README](../integration-e2e/README.md).

Document content and status messages come from the API and are shown as returned. Submission references and tracking credentials are not stored in URLs or browser storage.
