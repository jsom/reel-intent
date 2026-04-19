#!/usr/bin/env bash
# Film Revival NYC — PostgREST API introspection script
# Generates docs/frnyc-schema.md from live API responses.
#
# Usage:
#   export FRNYC_ANON_KEY=eyJ...
#   bash scripts/introspect-frnyc.sh
#
# Dependencies: curl, jq (brew install jq  /  apt install jq)

set -euo pipefail

KEY="${FRNYC_ANON_KEY:?set FRNYC_ANON_KEY before running}"
BASE="https://smwdhiwbgmmpqtuuoaou.supabase.co/rest/v1"
UA="film-radar-personal/0.1 (introspection)"
OUT="docs/frnyc-schema.md"

# Date window: today + 14 days (adjust if your machine's date differs)
TODAY="$(date -u +%Y-%m-%d)"
WINDOW_START="${TODAY}T04:00:00.000Z"       # midnight NYC in UTC
WINDOW_END="$(date -u -d '+14 days' +%Y-%m-%d 2>/dev/null || date -u -v+14d +%Y-%m-%d)T04:00:00.000Z"

mkdir -p docs

api() {
  # api METHOD PATH [EXTRA_HEADERS...]
  local method="$1" path="$2"; shift 2
  curl -sS --fail-with-body \
    -X "$method" \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $KEY" \
    -H "User-Agent: $UA" \
    -H "accept-profile: public" \
    "$@" \
    "${BASE}${path}"
}

api_head() {
  # Returns response headers only; writes them to stdout
  curl -sS -I \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $KEY" \
    -H "User-Agent: $UA" \
    -H "Prefer: count=exact" \
    "${BASE}${1}"
}

echo "=== Film Revival NYC introspection starting ==="
echo "Window: $WINDOW_START → $WINDOW_END"
echo ""

# ── Step 1: OpenAPI spec / table catalog ─────────────────────────────────────
echo "[1/8] Fetching OpenAPI spec..."
SPEC="$(api GET / -H 'Accept: application/json')"
TABLES="$(echo "$SPEC" | jq -r '.definitions | keys[]' | sort)"
echo "Tables found: $(echo "$TABLES" | tr '\n' ' ')"
echo ""

# ── Step 2: Column definitions for all tables ─────────────────────────────────
echo "[2/8] Extracting column definitions..."
declare -A TABLE_SCHEMAS
for tbl in $TABLES; do
  TABLE_SCHEMAS[$tbl]="$(echo "$SPEC" | jq -r --arg t "$tbl" '
    .definitions[$t].properties // {} | to_entries[] |
    [.key,
     (.value.format // .value.type // "unknown"),
     (if (.value | has("description")) then .value.description else "" end)
    ] | @tsv
  ')"
done

# Required columns from OpenAPI (nullable = not in required array)
declare -A TABLE_REQUIRED
for tbl in $TABLES; do
  TABLE_REQUIRED[$tbl]="$(echo "$SPEC" | jq -r --arg t "$tbl" \
    '(.definitions[$t].required // []) | join(",")')"
done

# ── Step 3: One sample row per table ─────────────────────────────────────────
echo "[3/8] Fetching sample rows..."
declare -A SAMPLE_ROWS
declare -A TABLE_ERRORS
for tbl in $TABLES; do
  echo "  → $tbl"
  if row="$(api GET "/${tbl}?select=*&limit=1" 2>&1)"; then
    SAMPLE_ROWS[$tbl]="$row"
  else
    TABLE_ERRORS[$tbl]="$row"
    SAMPLE_ROWS[$tbl]="ERROR"
  fi
  sleep 0.3   # be polite
done

# ── Step 4: Join tests ────────────────────────────────────────────────────────
echo "[4/8] Testing joins..."
JOIN_A_URL="/showtimes?select=*,film:films(*),venue:venues(*)&limit=1"
JOIN_B_URL="/showtimes?select=*,films(*),venues(*)&limit=1"
JOIN_C_URL="/showtimes?select=*,films(*),venues(*)&limit=1&accept-profile=public"

join_a="$(api GET "$JOIN_A_URL" 2>&1 || true)"
sleep 0.3
join_b="$(api GET "$JOIN_B_URL" 2>&1 || true)"
sleep 0.3

# Also try getting the HTTP status codes explicitly
join_a_status="$(curl -so /dev/null -w '%{http_code}' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "User-Agent: $UA" \
  "${BASE}${JOIN_A_URL}")"
sleep 0.3
join_b_status="$(curl -so /dev/null -w '%{http_code}' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "User-Agent: $UA" \
  "${BASE}${JOIN_B_URL}")"

# ── Step 5: Row counts via HEAD + Prefer: count=exact ────────────────────────
echo "[5/8] Checking data volumes..."
SHOWTIME_HEAD="$(api_head "/showtimes?start_at=gte.${WINDOW_START}&start_at=lte.${WINDOW_END}")"
SHOWTIME_COUNT="$(echo "$SHOWTIME_HEAD" | grep -i 'content-range' | grep -oP '/\K[0-9]+' || echo 'not found')"

# Identify FK column names from sample or schema for films/venues
FILM_FK="$(echo "${SAMPLE_ROWS[showtimes]:-}" | jq -r '.[0] | keys[]' 2>/dev/null | grep -i 'film' | head -1 || echo 'film_id')"
VENUE_FK="$(echo "${SAMPLE_ROWS[showtimes]:-}" | jq -r '.[0] | keys[]' 2>/dev/null | grep -i 'venue' | head -1 || echo 'venue_id')"

# Unique films in window (fetch IDs only, count distinct)
FILM_IDS="$(api GET "/showtimes?select=${FILM_FK}&start_at=gte.${WINDOW_START}&start_at=lte.${WINDOW_END}" 2>/dev/null \
  | jq -r ".[].${FILM_FK}" | sort -u | wc -l | tr -d ' ' || echo 'error')"
sleep 0.3
VENUE_IDS="$(api GET "/showtimes?select=${VENUE_FK}&start_at=gte.${WINDOW_START}&start_at=lte.${WINDOW_END}" 2>/dev/null \
  | jq -r ".[].${VENUE_FK}" | sort -u | wc -l | tr -d ' ' || echo 'error')"

# ── Step 6: Diverse spot-check rows ──────────────────────────────────────────
echo "[6/8] Spot-checking diverse showtimes..."
SPOT="$(api GET "/showtimes?select=*&limit=8&offset=5" 2>/dev/null || echo 'error')"
sleep 0.3

# Oldest showtimes (stale data check)
OLDEST="$(api GET "/showtimes?select=start_at,id&order=start_at.asc&limit=3" 2>/dev/null || echo 'error')"
sleep 0.3

# ── Step 7: Check response headers for rate limits ───────────────────────────
echo "[7/8] Checking response headers..."
HEADERS="$(curl -sS -I \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "User-Agent: $UA" \
  "${BASE}/showtimes?limit=1")"

# ── Step 8: Write markdown ───────────────────────────────────────────────────
echo "[8/8] Writing $OUT ..."

render_columns() {
  local tbl="$1"
  local required="${TABLE_REQUIRED[$tbl]:-}"
  echo "| name | type | nullable | notes |"
  echo "|------|------|----------|-------|"
  echo "${TABLE_SCHEMAS[$tbl]:-}" | while IFS=$'\t' read -r col type desc; do
    [ -z "$col" ] && continue
    if echo "$required" | grep -qw "$col"; then
      nullable="NOT NULL"
    else
      nullable="nullable"
    fi
    printf "| \`%s\` | %s | %s | %s |\n" "$col" "$type" "$nullable" "$desc"
  done
}

{
cat <<HEADER
# Film Revival NYC — Data Source Reference

*Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ") by scripts/introspect-frnyc.sh*

## Endpoint

\`\`\`
Base URL:  ${BASE}/
OpenAPI:   ${BASE}/   (GET → application/json)
\`\`\`

## Authentication

| Header | Value |
|--------|-------|
| \`apikey\` | \`${KEY:0:20}…[truncated]\` |
| \`Authorization\` | \`Bearer <same>\` |
| \`accept-profile\` | \`public\` |

JWT payload (decoded):
\`\`\`json
$(echo "$KEY" | cut -d. -f2 | base64 -d 2>/dev/null | jq . 2>/dev/null || echo '(decode failed)')
\`\`\`

---

## Tables

**All tables visible to anon role:** $(echo "$TABLES" | tr '\n' ' ')

HEADER

# Per-table sections
for tbl in $TABLES; do
cat <<TBL

### ${tbl}

#### Columns

$(render_columns "$tbl")

#### Sample Row

\`\`\`json
$(if [ "${SAMPLE_ROWS[$tbl]}" = "ERROR" ]; then
  echo "// ERROR: ${TABLE_ERRORS[$tbl]:-unknown}"
else
  echo "${SAMPLE_ROWS[$tbl]}" | jq '.[0] // "empty"'
fi)
\`\`\`

#### Notes / Gotchas

$(if [ "${SAMPLE_ROWS[$tbl]:-}" = "ERROR" ]; then
  echo "- **RLS BLOCKED or error** — anon role cannot SELECT from this table."
  echo "  Error: \`${TABLE_ERRORS[$tbl]:-}\`"
else
  echo "- Sample row fetched successfully."
fi)

TBL
done

# Showtimes count section
cat <<COUNTS

### showtimes — Row Count (window: ${TODAY} to $(date -u -d '+14 days' +%Y-%m-%d 2>/dev/null || date -u -v+14d +%Y-%m-%d))

- Total showtime rows: **${SHOWTIME_COUNT}**
- HEAD response:
\`\`\`
$(echo "$SHOWTIME_HEAD" | grep -iE '(content-range|x-rate|date|server)' || echo '(no relevant headers)')
\`\`\`
- Unique film IDs in window: **${FILM_IDS}** (FK column used: \`${FILM_FK}\`)
- Unique venue IDs in window: **${VENUE_IDS}** (FK column used: \`${VENUE_FK}\`)

---

## Joins That Work / Don't Work

### Test A — Aliased join: \`film:films(*),venue:venues(*)\`

\`\`\`
GET ${BASE}${JOIN_A_URL}
HTTP Status: ${join_a_status}
\`\`\`

\`\`\`json
$(echo "$join_a" | jq '.[0] // .' 2>/dev/null || echo "$join_a")
\`\`\`

### Test B — Direct join: \`films(*),venues(*)\`

\`\`\`
GET ${BASE}${JOIN_B_URL}
HTTP Status: ${join_b_status}
\`\`\`

\`\`\`json
$(echo "$join_b" | jq '.[0] // .' 2>/dev/null || echo "$join_b")
\`\`\`

---

## Metadata Fields — Present / Absent

Fields identified from the actual schema (not guessed):

| Field of interest | Present? | Column name | Table | Notes |
|-------------------|----------|-------------|-------|-------|
| Film format (35mm / 70mm / DCP / IMAX) | $(echo "$TABLES $TABLE_SCHEMAS" | grep -qi 'format' && echo '✓ likely' || echo '? check schema') | check showtimes schema above | showtimes or films | |
| Series / retrospective name | $(echo "${TABLE_SCHEMAS[showtimes]:-}" | grep -qi 'series' && echo '✓' || echo '?') | see showtimes columns | showtimes | |
| Director | $(echo "${TABLE_SCHEMAS[films]:-}" | grep -qi 'director' && echo '✓' || echo '?') | see films columns | films | |
| Release year | $(echo "${TABLE_SCHEMAS[films]:-}" | grep -qi 'year' && echo '✓' || echo '?') | see films columns | films | |
| Country | $(echo "${TABLE_SCHEMAS[films]:-}" | grep -qi 'country' && echo '✓' || echo '?') | see films columns | films | |
| Runtime | $(echo "${TABLE_SCHEMAS[films]:-}" | grep -qi 'runtime' && echo '✓' || echo '?') | see films columns | films | |
| Featured / critic pick flag | $(echo "$TABLES $TABLE_SCHEMAS" | grep -qi 'featured\|pick\|curated' && echo '✓' || echo 'not found') | — | — | |
| Ticket URL | $(echo "$TABLES $TABLE_SCHEMAS" | grep -qi 'ticket' && echo '✓' || echo 'not found') | — | showtimes? | |
| TMDB / IMDB cross-ref | $(echo "${TABLE_SCHEMAS[films]:-}" | grep -qi 'tmdb\|imdb' && echo '✓' || echo 'not found') | — | films | |

---

## Spot-Check: Edge Cases

### 8 diverse showtimes (offset=5)

\`\`\`json
$(echo "$SPOT" | jq . 2>/dev/null || echo "$SPOT")
\`\`\`

### Oldest 3 showtimes (stale-data check)

\`\`\`json
$(echo "$OLDEST" | jq . 2>/dev/null || echo "$OLDEST")
\`\`\`

---

## Response Headers (rate-limit check)

\`\`\`
$(echo "$HEADERS" | grep -iE '(x-rate|ratelimit|retry-after|content-range|server|cf-ray|x-request)' || echo '(no rate-limit headers observed)')
\`\`\`

Full headers:
\`\`\`
$(echo "$HEADERS")
\`\`\`

---

## Open Questions

*(Populate after reviewing real data above)*

1. Is \`format\` a dedicated column on \`showtimes\` or buried in a text field?
2. Are double features represented as one row or two?
3. How are 35mm/70mm prints indicated — column value, title suffix, or notes text?
4. Is venue name normalized (FK) or stored as free text on showtimes?
5. Does the anon role have SELECT on all tables listed above?
6. What is the data freshness — oldest row \`start_at\` from stale-data check above?
7. Is there a separate \`series\` table or is retrospective data inline on showtimes?
8. Do any columns contain rep-vs-first-run distinction, or is that implicit from venue?
COUNTS

} > "$OUT"

echo ""
echo "=== Done. Output written to $OUT ==="
echo "Review it, then: git add $OUT && git commit -m 'docs: add FRNYC schema reference'"
