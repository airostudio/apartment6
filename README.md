# Cascade Apartment 6

Direct-booking site for Cascade Apartment 6, Mt Baw Baw. Next.js (App Router) on Vercel, Supabase (Postgres) for data, Stripe for payments, Resend for email.

## Layout
- `app/(site)/…` public pages · `app/(admin)/admin/…` admin pages. Page markup is JSX; page behaviour is plain browser JS in `public/js` (loaded after hydration by `components/LegacyScripts.jsx`).
- `pages/api/*` serverless API routes (Node `req`/`res` handlers). Shared logic lives in `lib/`. `/api/availability`, `/api/ical-feeds` and `/api/send-test-email` are rewrites onto other routes (see `next.config.js`) to stay under Vercel's serverless function limit.
- `supabase-schema.sql` + `supabase-migrations/` – database schema and migrations (run in the Supabase SQL editor).
- `public/` – images, `css/`, `js/`, robots/sitemap. The old `/public/<image>` URLs are rewritten to `/<image>`.

## Environment variables
`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ADMIN_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY` (optional `ADMIN_<n>_EMAIL/HASH/SALT/ROLE` for extra admin logins).

## Develop
`npm install` then `npm run dev` (http://localhost:3000). `npm run build && npm start` for a production build.
