# Staff portal

Bilingual staff dashboard for authenticated request processing, document catalog administration, staff account management, and audit review. Use Node.js `22.23.2` from the workspace `.nvmrc`.

Set `VITE_API_BASE_URL` in `.env.local` if needed. Run `npm ci`, then `npm run dev` (port `5174`). The backend CORS allowlist must include `http://localhost:5174` and allow credentialed requests.

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` for local checks. The catalog editor is under `src/features/catalog/`; auth provider, context, and hook live in `src/auth/`; shared presentation components and date/error formatting live under `src/components/` and `src/lib/`.

Sessions use the API’s HttpOnly cookie. The CSRF token stays in memory, and mutations that process requests include the current ETag. The backend enforces roles, lifecycle rules, password-change requirements, and concurrency.
