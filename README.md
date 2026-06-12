# SAIF Bio

Internal operations system for SAIF Bio: contribution tracking with IRS-compliant acknowledgement letters, expense tracking with Form 990 functional classes, grantmaking (proposal review → award → disbursement → grantee reports), grantseeking pipeline, and year-end reporting.

See CLAUDE.md for architecture details.

## Demo mode (current state)

The app runs in **demo mode by default**: no login required, all pages served from in-memory sample data. Writes work (you can add contributions, vote on proposals, generate letters) but reset whenever the server restarts — on Vercel that means per serverless instance. Letter "sending" is simulated (no email goes out).

Going live requires an explicit opt-in: set `NEXT_PUBLIC_USE_SUPABASE=true` *and* the Supabase env vars. The mere presence of Supabase vars is not enough — integrations like Vercel's Supabase marketplace inject them automatically, and that must not silently disable the demo.

## First-time setup

1. **Create the Supabase project** (not yet created — was deferred during initial build):
   - Dashboard → New project (its own project, separate from the SAIF Ventures CRM database).
   - Run the migrations in `supabase/migrations/` in order (001 → 009) via the SQL editor, or link the CLI (`supabase link`) and `supabase db push`.
   - Auth → Providers → Email: **disable signups** ("Allow new users to sign up" off). Magic-link login still works for invited users.
   - Auth → Users → invite `nick@saif.vc`, `mike@saif.vc`, `geoff@saif.vc`. The DB trigger links each to `bio_team_members` by email and rejects anyone else.

2. **Environment**: copy `.env.example` → `.env.local` and fill in the project URL, anon key, and service-role key (Project settings → API).

3. **Resend** (for emailing letters): create an API key at resend.com, verify your sending domain, set `RESEND_API_KEY` and `LETTER_FROM_EMAIL`.

4. **Org settings**: run the app, go to `/settings`, and fill in the legal name, EIN, address, and letter signatory. Letters cannot be generated until EIN and signatory are set.

5. **Optional sample data**: `npx tsx scripts/seed.ts` (with env vars loaded).

## Commands

```bash
pnpm install
pnpm dev        # http://localhost:3003
pnpm typecheck
pnpm test       # IRS letter-language unit tests
pnpm build
pnpm db:types   # regenerate DB types after schema changes (requires linked project)
```

## Deploy

Vercel: import the repo, set the four env vars from `.env.example`, deploy. Add the production URL to Supabase Auth → URL configuration (site URL + redirect URLs including `/auth/callback`).
