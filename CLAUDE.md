# SAIF Bio

Internal operations system for SAIF Bio, a nonprofit run by the SAIF Ventures partners. Single Next.js app (no monorepo) with its own Supabase project — deliberately separate from the saif-monorepo CRM because SAIF Bio is a separate legal entity with separate books.

## What it does

- **Contributions** — record donations (cash, stock, crypto, in-kind), generate and email IRS Pub 1771-compliant acknowledgement letters (PDF via @react-pdf/renderer, email via Resend)
- **Expenses** — categorized with Form 990 functional classes (program / management & general / fundraising), receipt uploads, 1099 vendor tracking
- **Grants** (grantmaking) — proposal intake → partner review (score 1-5, yes/maybe/no vote, comments, COI recusal) → decision → award → disbursements (auto-create matching expense) → grantee report deadlines
- **Reports** — 990-style functional expense summary, donor summaries, Schedule I-shaped grants paid, 1099 vendor totals, CSV exports

## Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 App Router, TypeScript 5 strict |
| Styling | Tailwind CSS 4 (`@import "tailwindcss"` + custom `.card`/`.input`/`.btn` classes in app/globals.css) |
| Database | Supabase (Postgres + Auth + Storage + RLS) |
| PDF | @react-pdf/renderer (server-side, no headless Chrome) |
| Email | Resend |
| Tests | Vitest (`pnpm test`) |

## Commands

```bash
pnpm dev        # dev server on port 3003
pnpm build
pnpm typecheck
pnpm test       # letter compliance unit tests
pnpm db:types   # regenerate lib/supabase/types/database.ts (needs linked project)
```

## Architecture notes

- All tables use the `bio_` prefix. Money is always `amount_cents bigint` — never floats. Use `formatCents`/`parseDollarsToCents` from lib/utils/money.ts.
- **Auth**: Supabase magic-link only, public signups disabled. `bio_team_members` whitelists the 3 partner emails; a DB trigger links `auth.users` rows by email and rejects unknown emails. Every RLS policy requires `bio_is_partner()` (SECURITY DEFINER helper).
- **RLS exception**: `bio_proposal_reviews` and `bio_proposal_comments` — partners read all, but write only their own rows (`reviewer_id = bio_member_id()`).
- **Letters**: `lib/pdf/letter-data.ts` is the pure data builder holding the IRS-required language (no-goods statement, quid pro quo estimate, in-kind no-valuation). It is unit-tested in letter-data.test.ts — don't change the language without checking IRS Pub 1771. Generated PDFs go to the private `letters` bucket; a `body_snapshot` is frozen on the letter row; contributions with a *sent* letter are locked from editing.
- **Disbursements**: marking one paid auto-creates a `bio_expenses` row in "Grants paid" (linked via `disbursement_id`) so 990 functional totals stay complete without double entry.
- **Storage**: two private buckets, `documents` and `letters`. Always serve via signed URLs (`getSignedFileUrl`). Uploads go through the `uploadAttachment` server action into the polymorphic `bio_attachments` table.
- **Governance docs** (bylaws, determination letter, board minutes) live as attachments with `entity_type='governance'`, `entity_id='00000000-0000-0000-0000-000000000000'`, managed from /settings.
- Server actions live in lib/actions/*.ts, throw `ActionError` with user-facing messages, and call `requireMemberId()` first. Route handlers exist only for streaming: /api/letters/[contributionId] (PDF preview) and /api/exports/[report] (CSV).

## Environment

Copy .env.example to .env.local. `SUPABASE_SERVICE_ROLE_KEY` is needed for letter PDF storage writes; `RESEND_API_KEY` + a verified sending domain for emailing letters.

## Migrations

supabase/migrations/ runs in order 001-009 on a fresh database. 009 creates the storage buckets and policies. After schema changes, run `pnpm db:types` and `pnpm typecheck`.
