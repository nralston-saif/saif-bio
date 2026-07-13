# QuickBooks Go-Live Checklist

The QuickBooks expense sync is built and verified against an Intuit sandbox
company (July 2026). It stays dormant until SAIF Bio has its real QuickBooks
company. Work through this checklist top to bottom when that day comes —
roughly an hour, most of it inside QuickBooks itself.

Current state while you read this: the app runs with **development keys**
against a **sandbox** company. Nothing here touches SAIF Ventures' QuickBooks
at any point.

## 1. Get the real QuickBooks company (TechSoup)

1. When TechSoup approves SAIF Bio's nonprofit status, request
   **QuickBooks Online Plus, 1-Year Subscription, 5 Users** (~$80/yr admin fee).
   Plus is required — class tracking lives in Plus and up.
2. Follow the fulfillment email. At activation, **sign in with SAIF's existing
   Intuit login** instead of creating a new account — SAIF Bio becomes a second
   company under that login. Skip every data-migration step in Intuit's docs;
   SAIF Bio starts with fresh books.
3. The person who activates becomes the company's primary admin. Renewal: pay
   TechSoup's admin fee annually (subscription year starts at TechSoup
   *approval*, not activation — activate promptly).

## 2. Set up the new company's books

Do this inside the new QuickBooks company (with the accountant if possible):

1. **Chart of accounts**: create one expense account per active category in
   /expenses/categories (Grants paid, Legal fees, Software & IT, …). Also
   confirm the real bank account(s) and card(s) exist as Bank / Credit Card
   accounts — they usually appear automatically when bank feeds connect.
2. **Classes**: Settings gear → Account and settings → Advanced → Categories →
   turn on **Track classes**. Then Settings gear → All lists → Classes → create
   exactly three: `Program`, `Management & General`, `Fundraising`.
3. Decide with the accountant how partner-fronted reimbursements should post
   (the sync books them as a Purchase from whatever account the
   "Reimbursement" payment method is mapped to — e.g. an "Owed to partners"
   Other Current Liability account).

## 3. Production keys in the Intuit developer portal

At developer.intuit.com (Nick's developer account, workspace "SAIFbio", app
"Internal App"):

1. Complete the **Get production keys** questionnaire. The EULA / privacy
   fields are a formality for private apps — real pages on saifbio.org are fine.
   Host domain: `internal.saif.vc`; launch/disconnect URLs:
   `https://internal.saif.vc/bio/settings`.
2. On **Keys & Credentials → Production**, copy the production Client ID and
   Client Secret.
3. Under the **Production** redirect URIs, add exactly:
   `https://internal.saif.vc/bio/api/quickbooks/callback`

## 4. Point the deployed app at production

In Vercel (saif-bio project) set:

```
QBO_CLIENT_ID=<production client id>
QBO_CLIENT_SECRET=<production client secret>
QBO_ENVIRONMENT=production
QBO_REDIRECT_URI=https://internal.saif.vc/bio/api/quickbooks/callback
```

Redeploy. Keep the development keys in local `.env.local` if you want to keep
testing against the sandbox locally.

## 5. Connect and map

1. On https://internal.saif.vc/bio/settings, the QuickBooks card should show
   environment `production`. If a stale sandbox connection is still shown,
   click **Disconnect QuickBooks** first (the sandbox connection and its
   mappings are throwaway — mappings are per-company and must be redone).
2. Click **Connect to QuickBooks**, sign in as a SAIF Bio company admin, pick
   the **SAIF Bio** company on the consent screen.
3. Map everything:
   - every expense category → its QuickBooks expense account,
   - the three functional classes → the three Classes from step 2,
   - each payment method → the bank/card account it draws from, plus the
     **Default** row (used when an expense has no payment method).
4. Sanity test: create a $1 test expense, confirm the green **Synced** badge,
   find it in QuickBooks (Expenses → Expenses), then delete it in the app and
   confirm it disappears from QuickBooks too.

## 6. Backfill pre-integration expenses

Expenses entered before go-live show **Not synced**. For each one, open it and
click **Sync now**. (If there are many by then, ask Claude for a one-shot
backfill script/button instead of clicking through them.)

Receipts note: attachments are pushed to QuickBooks only on an expense's
*first* successful sync, so backfilled expenses carry their receipts over.

## How the sync behaves day-to-day (reference)

- Creating / editing / deleting an expense in the app creates / updates /
  deletes the matching QuickBooks Purchase. Marking a grant disbursement paid
  syncs its auto-created "Grants paid" expense too.
- A sync failure never blocks saving — the expense shows a red **Sync failed**
  badge with the reason (usually an unmapped category) and a retry button.
- Changes made *directly in the database* (Supabase dashboard/SQL) do **not**
  sync — the app is the front door for expenses.
- QuickBooks is the book of record for the accountant; the app is where
  expenses are entered. Don't hand-edit synced transactions in QuickBooks —
  fix them in the app and let it re-sync.
- Tokens refresh automatically on use; if no expense activity for ~100 days
  the connection expires and Settings will show a reconnect prompt.
