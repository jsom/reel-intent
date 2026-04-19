# Film Revival NYC — Data Source Reference

*Status: awaiting live introspection — see below*

## Endpoint

```
Base URL:  https://smwdhiwbgmmpqtuuoaou.supabase.co/rest/v1/
OpenAPI:   GET /rest/v1/   → application/json (PostgREST OpenAPI spec)
```

## Authentication

| Header | Value |
|--------|-------|
| `apikey` | `$FRNYC_ANON_KEY` |
| `Authorization` | `Bearer $FRNYC_ANON_KEY` |
| `accept-profile` | `public` |
| `User-Agent` | `film-radar-personal/0.1 (introspection)` |

**JWT payload:**
```json
{
  "iss": "supabase",
  "ref": "smwdhiwbgmmpqtuuoaou",
  "role": "anon",
  "iat": 1750543195,
  "exp": 2066119195
}
```
- Role: `anon` (public read, governed by RLS)
- Key issued: 2025-06-21 · Expires: 2035-06-19 (10-year lifespan — note for rotation planning)
- Project ref: `smwdhiwbgmmpqtuuoaou`

---

## How to populate this document

The Anthropic Claude Code web sandbox blocks egress to `supabase.co`
(`x-deny-reason: host_not_allowed`). The introspection must run from
a machine with unrestricted outbound HTTPS.

**Run the introspection script locally:**

```bash
export FRNYC_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
bash scripts/introspect-frnyc.sh
```

The script (`scripts/introspect-frnyc.sh`) covers all 8 steps from the
design spec in order:

1. Fetch the OpenAPI spec → full table catalog
2. Extract column definitions (name, type, nullable, FK refs)
3. `?select=*&limit=1` sample row per table
4. Join tests: `film:films(*),venue:venues(*)` and `films(*),venues(*)`
5. HEAD + `Prefer: count=exact` row counts for the next 14-day window
6. Metadata field audit (format, series, director, ticket URLs, etc.)
7. Spot-check 8 diverse showtimes + oldest-row stale-data check
8. Response header inspection for rate-limit signals

It writes directly to this file, replacing the content above with
real API data. Dependencies: `curl`, `jq`.

---

## Tables

*Populated by script*

---

## Joins That Work

*Populated by script*

---

## Joins That Don't Work

*Populated by script*

---

## Metadata Fields — Present / Absent

*Populated by script*

---

## Open Questions

*(Pre-loaded — update after reviewing real data)*

1. Is `format` a dedicated column on `showtimes`, or is 35mm/70mm buried in a notes/title text field?
2. Are double features one row or two rows in `showtimes`?
3. Are venue names normalized (FK to a `venues` table) or duplicated free text?
4. Does the `anon` role have SELECT on all tables, or do any return 401/403?
5. What is the oldest `start_at` value — evidence of stale data or cleanup job?
6. Does a separate `series` table exist, or is retrospective data inline on `showtimes`?
7. Is rep-vs-first-run distinction explicit (column/flag) or implicit from venue type?
8. Are `tmdb_id` / `imdb_id` cross-references present on `films` for enrichment?
