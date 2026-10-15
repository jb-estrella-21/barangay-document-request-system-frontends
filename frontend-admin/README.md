# Staff portal

Bilingual staff dashboard for authenticated request processing, document catalog administration, staff account management, and audit review.

Set `VITE_API_BASE_URL` in `.env.local` if needed. Start with `npm run dev` (port `5174`); run `npm run typecheck` or `npm run build` for checks and a production bundle. The backend CORS allowlist must include `http://localhost:5174` and allow credentialed requests.

Sessions use the API’s HttpOnly cookie. The CSRF token stays in memory, and mutations that process requests include the current ETag. The backend enforces roles, lifecycle rules, password-change requirements, and concurrency.
