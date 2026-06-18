---
name: fix-tickets
description: >-
  Scan Nick's recent open CRM tickets, triage them down to real development
  tasks, route each to the correct repo (saif-monorepo CRM or saif-bio), propose
  a plan, fix on approval (edits only — no commit), and archive each ticket once
  its fix is committed. Skips rejection-email/follow-up and non-dev notes, and
  asks before acting on anything ambiguous. Use when the user asks to scan,
  triage, work through, or fix their open tickets / dev backlog.
---

# fix-tickets

Turn the open tickets assigned to Nick into shipped code changes, while leaving
the noise (rejection emails, notes-to-self, non-pressing items) untouched.

## Key facts

- **All tickets live in the CRM Supabase project** (`dxllkea…`), not saif-bio's
  database. The bundled `scripts/tickets.sh` always reads from
  `/Users/nick/saif-monorepo/apps/crm/.env.local`, so it works the same whether
  you're invoked from `/Users/nick/saif-monorepo` or `/Users/nick/saif-bio`.
- **Two target repos** — a fix goes into whichever the ticket is about:
  - `/Users/nick/saif-monorepo` → the CRM app (`apps/crm`). Default for most tickets.
  - `/Users/nick/saif-bio` → the SAIF Bio app. Tickets that file Bio work here
    even though the ticket itself lives in the CRM DB.
- **Status enum** is `open | in_progress | testing | archived` — there is no
  literal `resolved`; "resolved/done" == `archived` (set this only after commit).
- The helper script is in this skill's `scripts/` dir. If you can't resolve the
  skill dir, it's at `/Users/nick/saif-monorepo/.claude/skills/fix-tickets/scripts/tickets.sh`
  (the saif-bio copy is identical).

## Helper script

```bash
scripts/tickets.sh scan [days]          # open/in_progress tickets assigned to Nick, created/updated within [days] (default 30); JSON array
scripts/tickets.sh get <ticket_id>      # full row
scripts/tickets.sh archive <ticket_id>  # set status=archived  (ONLY after the fix is committed)
scripts/tickets.sh comment <ticket_id> "<text>"  # add a comment, e.g. the commit SHA + summary
```

It uses the CRM service-role key (bypasses RLS). Pretty-print JSON with `python3 -m json.tool` or `python3 -c`.

---

## Workflow — four phases. Never skip the approval gate.

### Phase 1 — Scan & triage (read-only)

1. Run `scripts/tickets.sh scan <days>`. Default window is **30 days**; if the
   user named one ("last 2 weeks", "this month", a specific ticket), use that
   instead. A single ticket id → `get` it directly.
2. Classify every returned ticket into one of three buckets:
   - **Dev task** — a code change to make. Bug fixes, UI/UX fixes, new pages,
     feature requests, and founder feedback with `feedback_type` `bug_report`
     or `suggestion`.
   - **Skip (not dev)** — do not touch. In particular:
     - Rejection / email-follow-up ops tickets: title starts with `Send rejection email`,
       or `application_id` is set **and** `tags` include any of
       `rejected`, `email-follow-up`, `interview`, `follow-up`.
     - Notes-to-self, reminders, "discuss with X", and other non-code items.
   - **Uncertain** — could be a dev task or not, importance unclear, or you
     can't tell which repo it targets.
3. **Route each dev task to a repo** from its content: anything about the SAIF
   Bio app/site → `saif-bio`; everything else → `saif-monorepo` (CRM). Open the
   candidate repo and locate the relevant files to confirm the routing and scope
   the fix. If routing is still unclear, mark it uncertain.
4. **Ask Nick about every uncertain ticket** before going further — "is this one
   worth doing / is it actually a dev task / which app is it for?" Use his
   answers to finalize the dev-task list. Do not silently include or drop
   borderline tickets.

### Phase 2 — Propose a plan, then stop

Present a concise plan and wait for explicit approval. For each dev task show:

- ticket id (short) + title
- target repo
- the fix approach and the specific files you expect to touch
- anything risky or that needs a decision

Also list (briefly) what you're skipping and why, so nothing is silently lost.
**Do not edit any files yet.** Let Nick add/remove/reorder tickets. Proceed only
on a clear go-ahead. If he asked to "just scan" or "just triage", stop here.

### Phase 3 — Execute the approved fixes (edits only, NO commit)

For each approved ticket:

1. `cd` into the correct repo.
2. Implement the smallest correct fix. Match surrounding code style.
3. Gate the change with type-checking, **not lint** — repo memory notes
   `pnpm lint` is broken under Next 16, so `pnpm typecheck` is the gate
   (`pnpm --filter @saif/crm typecheck` for CRM; `pnpm typecheck` in saif-bio).
4. **Do not `git commit` and do not `git push`.** Leave changes in the working
   tree for Nick to review (his chosen delivery: edits only).

After all edits, summarize per ticket: repo, files changed, what the fix does,
and a suggested commit message that references the ticket, e.g.
`Fix: Contribution letters 404 (ticket be750adb)`.

### Phase 4 — Archive once committed

A ticket is only `archived` after its fix is **committed** — never before.

1. Tell Nick the edits are ready and to review + commit (one commit per ticket
   keeps the mapping clean; the suggested message references the ticket id).
2. Confirm a commit exists for the ticket's changes **in that ticket's repo** —
   either Nick says he committed, or verify with `git -C <repo> log` /
   `git -C <repo> status` that the files are committed (working tree clean for
   them). If a ticket spans both repos, check the repo where its fix landed.
3. For each committed ticket:
   - `scripts/tickets.sh archive <ticket_id>` (the DB trigger sets `archived_at`).
   - Optionally `scripts/tickets.sh comment <ticket_id> "Fixed in <repo>@<sha>: <one-line summary>"`.
4. Report which tickets were archived and which are still pending a commit.

## Guardrails

- Read-only until Nick approves the plan. No edits in Phase 1–2.
- Never modify, archive, or comment on rejection-email / follow-up / notes
  tickets.
- Never commit or push — Nick commits.
- Never archive a ticket whose fix is not committed.
- When unsure whether something is a dev task, which repo it targets, or whether
  it's worth doing — ask, don't guess.
