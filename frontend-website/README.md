# Resident website

Public bilingual React application for browsing active document types, submitting anonymous requests, and privately tracking request progress.

Set `VITE_API_BASE_URL` in `.env.local` if the backend is not at `http://localhost:3000/api/v1`. Start with `npm run dev` (port `5173`); run `npm run typecheck` or `npm run build` for checks and a production bundle.

Document content and status messages come from the API and are shown as returned. Submission references and tracking credentials are not stored in URLs or browser storage.
