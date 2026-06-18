#!/usr/bin/env bash
#
# tickets.sh — read/update SAIF CRM tickets for the fix-tickets skill.
#
# All ticket data lives in the CRM Supabase project (dxllkea...), NOT saif-bio's
# database. Creds are always read from the monorepo CRM env file below, so this
# script behaves identically whether it's invoked from saif-monorepo or saif-bio.
#
# Usage:
#   tickets.sh scan [days]            # open/in_progress tickets assigned to Nick, created/updated within [days] (default 30)
#   tickets.sh get <ticket_id>        # full row for one ticket
#   tickets.sh archive <ticket_id>    # set status=archived (only after the fix is committed)
#   tickets.sh comment <ticket_id> <text>   # add a comment (e.g. the commit SHA + summary)
#
set -euo pipefail

CRM_ENV="/Users/nick/saif-monorepo/apps/crm/.env.local"
NICK_ID="a65533b5-4884-496e-a69d-f454357ba6f3"   # nick@saif.vc in saif_people

if [[ ! -f "$CRM_ENV" ]]; then
  echo "ERROR: CRM env not found at $CRM_ENV" >&2
  exit 1
fi

URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL' "$CRM_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]')
KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY' "$CRM_ENV" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]')

if [[ -z "$URL" || -z "$KEY" ]]; then
  echo "ERROR: could not read NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from $CRM_ENV" >&2
  exit 1
fi

req() { curl -fsS "$@" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"; }

cmd="${1:-scan}"
case "$cmd" in
  scan)
    days="${2:-30}"
    cutoff=$(date -u -v-"${days}"d +%Y-%m-%dT00:00:00Z 2>/dev/null || date -u -d "-${days} days" +%Y-%m-%dT00:00:00Z)
    req "$URL/rest/v1/saif_tickets?assigned_to=eq.$NICK_ID&status=in.(open,in_progress)&or=(created_at.gte.$cutoff,updated_at.gte.$cutoff)&select=id,title,description,status,priority,tags,application_id,source,feedback_type,related_company,related_person,due_date,created_at,updated_at&order=created_at.desc"
    echo
    ;;
  get)
    id="${2:?ticket_id required}"
    req "$URL/rest/v1/saif_tickets?id=eq.$id&select=*"
    echo
    ;;
  archive)
    id="${2:?ticket_id required}"
    curl -fsS -X PATCH "$URL/rest/v1/saif_tickets?id=eq.$id" \
      -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
      -H "Content-Type: application/json" -H "Prefer: return=representation" \
      -d '{"status":"archived"}'
    echo
    ;;
  comment)
    id="${2:?ticket_id required}"
    text="${3:?comment text required}"
    payload=$(NICK_ID="$NICK_ID" TID="$id" TEXT="$text" python3 -c 'import json,os; print(json.dumps({"ticket_id":os.environ["TID"],"author_id":os.environ["NICK_ID"],"content":os.environ["TEXT"]}))')
    curl -fsS -X POST "$URL/rest/v1/saif_ticket_comments" \
      -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
      -H "Content-Type: application/json" -H "Prefer: return=minimal" \
      -d "$payload"
    echo "comment added to $id"
    ;;
  *)
    echo "usage: tickets.sh [scan [days] | get <id> | archive <id> | comment <id> <text>]" >&2
    exit 1
    ;;
esac
