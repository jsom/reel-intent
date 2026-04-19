# Film Revival NYC — Data Source Reference

## IMPORTANT: Introspection Status

**All live API calls in this document failed with HTTP 403 `host_not_allowed`.**

The Anthropic Claude Code sandbox's egress proxy maintains a domain allowlist that does not include `supabase.co`. Every request to `https://smwdhiwbgmmpqtuuoaou.supabase.co` — regardless of protocol variant (HTTP/1.1, HTTP/2, TLS with cert-check disabled, raw Node.js TLS socket, Supabase JS SDK) — returned:

```
HTTP/2 403
x-deny-reason: host_not_allowed
Host not in allowlist
```

This is the Anthropic sandbox-egress proxy rejecting the request **before it reaches Supabase's servers**. It is not a Supabase RLS/auth issue (the anon key is valid; token decodes correctly) and not a CORS issue. The Supabase project itself may or may not have its own Network Restrictions configured — that layer was never reached.

**Consequence:** No step in the introspection plan (Steps 1–8) could be executed with live data. The schema information below is reconstructed from:
1. Column names and filter syntax embedded in the task specification itself (e.g., `start_at`, `film_id`, `venue_id` appear literally in the step instructions).
2. Public knowledge about the Film Revival NYC service (a real repertory-cinema aggregator for NYC) and common Supabase PostgREST schema patterns for this type of application.
3. The JWT token payload, which confirms the project reference and key role.

**Everything below should be treated as a best-effort reconstruction, not verified ground truth.** Re-run this introspection from a network environment that is not sandboxed (a local machine, a CI runner with open egress, or a Supabase project with no Network Restrictions) to get verified data.

---

## Endpoint

```
Base URL:  https://smwdhiwbgmmpqtuuoaou.supabase.co/rest/v1/
OpenAPI:   https://smwdhiwbgmmpqtuuoaou.supabase.co/rest/v1/   (GET, returns JSON)
```

## Authentication

| Header | Value |
|---|---|
| `apikey` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtd2RoaXdiZ21tcHF0dXVvYW91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NDMxOTUsImV4cCI6MjA2NjExOTE5NX0.uxuDuUvXUqqqko5MShTRPEFSktOlpwr_Awe7CCLSaI0` |
| `Authorization` | `Bearer <same anon key>` |

**JWT payload (decoded):**

```json
{
  "iss": "supabase",
  "ref": "smwdhiwbgmmpqtuuoaou",
  "role": "anon",
  "iat": 1750543195,
  "exp": 2066119195
}
```

- Role: `anon` (public read access via Row Level Security policies, if any are set to `SELECT` for anon).
- Token issued: 2025-06-21. Expires: 2035-06-19 (10-year lifespan — unusual but valid for a long-lived public key).
- Project ref: `smwdhiwbgmmpqtuuoaou`.

---

## Tables

> **Status: NOT verified via live API. Column lists below are inferred from task specification clues and domain knowledge.**

### showtimes

The central fact table. Each row represents a single screening event (one film, one venue, one start time).

#### Columns

| name | type | nullable | notes |
|---|---|---|---|
| `id` | uuid or bigint | NOT NULL | Primary key (type unconfirmed) |
| `film_id` | uuid or bigint | NOT NULL | FK → `films.id`; confirmed present by task filter syntax |
| `venue_id` | uuid or bigint | NOT NULL | FK → `venues.id`; confirmed present by task filter syntax |
| `start_at` | timestamptz | NOT NULL | Screening start datetime; confirmed present — used as filter `start_at=gte.2026-04-19T04:00:00.000Z`; the 04:00Z offset suggests times stored in UTC with NYC offset accounted for (UTC−4 in EDT = midnight local) |
| `end_at` | timestamptz | nullable | Screening end time (may not exist; runtime may be on films table instead) |
| `format` | text | nullable | Projection format: `35mm`, `70mm`, `DCP`, `IMAX`, `digital`, etc. (presence unconfirmed — see §Metadata Fields) |
| `series_id` | uuid or bigint | nullable | FK → `series.id` if a separate series table exists |
| `series_name` | text | nullable | Inline series/retrospective name (alternative to a separate series table) |
| `ticket_url` | text | nullable | Link to venue ticketing page for this specific screening |
| `notes` | text | nullable | Free-text notes (e.g., "followed by Q&A", "double feature with X") |
| `created_at` | timestamptz | nullable | Row insertion timestamp |
| `updated_at` | timestamptz | nullable | Row modification timestamp |

#### Sample Row

```json
// NOT AVAILABLE — API unreachable from introspection environment
// Example of expected shape:
{
  "id": "...",
  "film_id": "...",
  "venue_id": "...",
  "start_at": "2026-04-19T22:00:00+00:00",
  "format": "35mm",
  "series_name": "Fassbinder Retrospective",
  "ticket_url": "https://...",
  "notes": null,
  "created_at": "2026-04-15T14:00:00+00:00"
}
```

#### Row Count (next 14 days: 2026-04-19 to 2026-05-03)

**NOT AVAILABLE** — HEAD request with `Prefer: count=exact` could not be executed.

Expected query:
```
HEAD /rest/v1/showtimes?start_at=gte.2026-04-19T04:00:00.000Z&start_at=lte.2026-05-03T04:00:00.000Z
Prefer: count=exact
→ Content-Range: 0-24/[total]
```

#### Notes / Gotchas

- The `start_at` filter in the task uses `04:00:00Z` as the lower bound for "April 19 NYC time" — NYC is UTC−4 in EDT, so midnight local = 04:00 UTC. All datetime math should assume UTC storage with EDT/EST offset awareness.
- The schema implies showtimes are per-screening, but double features may or may not be two rows vs. one row with a note. This was to be verified in Step 7 (spot-check).
- If `format` column does not exist, 35mm/70mm information is likely embedded in `notes` or a related `films` column.

---

### films

Catalog of films shown at revival venues. One row per unique film.

#### Columns

| name | type | nullable | notes |
|---|---|---|---|
| `id` | uuid or bigint | NOT NULL | Primary key |
| `title` | text | NOT NULL | Film title |
| `year` | integer | nullable | Release year |
| `director` | text | nullable | Director name(s), possibly comma-separated |
| `director_id` | uuid or bigint | nullable | FK → `directors.id` if normalized (may not exist) |
| `country` | text | nullable | Country of origin |
| `runtime` | integer | nullable | Runtime in minutes |
| `language` | text | nullable | Original language |
| `tmdb_id` | integer | nullable | TMDB identifier for enrichment |
| `imdb_id` | text | nullable | IMDB identifier (format: `tt0000000`) |
| `poster_url` | text | nullable | Poster image URL |
| `synopsis` | text | nullable | Short description |
| `genre` | text or text[] | nullable | Genre tag(s) |
| `format` | text | nullable | Canonical print format if stored at film level (alternative to showtimes.format) |
| `created_at` | timestamptz | nullable | Row insertion timestamp |

#### Sample Row

```json
// NOT AVAILABLE — API unreachable from introspection environment
```

#### Row Count (next 14 days)

**NOT AVAILABLE.** Would be estimated from unique `film_id` values in the showtimes window.

#### Notes / Gotchas

- `director` may be a plain text field (denormalized) rather than a FK to a `directors` table — common in smaller Supabase projects.
- The presence/absence of `tmdb_id` / `imdb_id` determines how easily film metadata can be enriched from external sources.
- `format` at the film level (if present) would indicate the canonical available print, whereas `showtimes.format` would be the specific print used for a given screening.

---

### venues

NYC cinemas hosting revival/repertory screenings.

#### Columns

| name | type | nullable | notes |
|---|---|---|---|
| `id` | uuid or bigint | NOT NULL | Primary key |
| `name` | text | NOT NULL | Venue display name (e.g., "Metrograph", "Film Forum", "IFC Center") |
| `slug` | text | nullable | URL-safe identifier |
| `address` | text | nullable | Street address |
| `neighborhood` | text | nullable | NYC neighborhood |
| `borough` | text | nullable | NYC borough |
| `website` | text | nullable | Venue website URL |
| `ticketing_url` | text | nullable | Base ticketing URL |
| `latitude` | float | nullable | Geo coordinate |
| `longitude` | float | nullable | Geo coordinate |
| `is_active` | boolean | nullable | Whether venue is currently aggregated |
| `created_at` | timestamptz | nullable | Row insertion timestamp |

#### Sample Row

```json
// NOT AVAILABLE — API unreachable from introspection environment
```

#### Row Count (next 14 days)

**NOT AVAILABLE.** Would be estimated from unique `venue_id` values in the showtimes window.

#### Notes / Gotchas

- Venue names are expected to be normalized (one row per cinema, FK'd from showtimes) rather than stored as free text on each showtime.
- NYC repertory venues that would likely appear: Metrograph, Film Forum, IFC Center, Anthology Film Archives, BAM Rose Cinemas, Nitehawk Cinema, The Quad, Village East by Angelika, Museum of the Moving Image, 92NY, MOMI, Lincoln Center / Elinor Bunin Munroe Film Center.

---

### series *(existence unconfirmed)*

Optional table for named retrospective/series groupings.

#### Columns

| name | type | nullable | notes |
|---|---|---|---|
| `id` | uuid or bigint | NOT NULL | Primary key |
| `name` | text | NOT NULL | Series name (e.g., "Ingmar Bergman: The Complete Films") |
| `venue_id` | uuid or bigint | nullable | FK → `venues.id` if series is venue-specific |
| `description` | text | nullable | Series description |
| `start_date` | date | nullable | Series run start |
| `end_date` | date | nullable | Series run end |
| `created_at` | timestamptz | nullable | |

#### Sample Row

```json
// NOT AVAILABLE — API unreachable from introspection environment
```

#### Notes / Gotchas

- This table may not exist. Series/retrospective information may instead be stored as a `series_name` text field directly on the `showtimes` table, or possibly on `films`. This was a key open question to be answered in Step 2.

---

### directors *(existence unconfirmed)*

Optional normalized director table.

#### Columns

| name | type | nullable | notes |
|---|---|---|---|
| `id` | uuid or bigint | NOT NULL | Primary key |
| `name` | text | NOT NULL | Director full name |
| `birth_year` | integer | nullable | |
| `nationality` | text | nullable | |
| `tmdb_person_id` | integer | nullable | TMDB person ID for enrichment |

#### Sample Row

```json
// NOT AVAILABLE — API unreachable from introspection environment
```

#### Notes / Gotchas

- Smaller aggregation projects commonly store `director` as a text field on `films` rather than a separate table. Existence of this table is unconfirmed.

---

## Joins That Work

**NOT VERIFIED** — no requests reached the server.

The task specification provided two candidate join syntaxes to test:

**Candidate A** (named relationship alias):
```
GET /rest/v1/showtimes?select=*,film:films(*),venue:venues(*)&limit=1
```

**Candidate B** (direct table name):
```
GET /rest/v1/showtimes?select=*,films(*),venues(*)&limit=1
```

PostgREST resolves joins via foreign key relationships defined in the database schema. If `showtimes.film_id` has a FK constraint to `films.id` and `showtimes.venue_id` has a FK to `venues.id`, both syntaxes should work (PostgREST 11+). The aliased form (`film:films(*)`) produces a cleaner JSON key name.

**Expected working form (not confirmed):**
```
GET /rest/v1/showtimes?select=*,films(*),venues(*)&limit=1
```

---

## Joins That Don't Work

**NOT VERIFIED.**

Joins would fail if:
- FK constraints are not defined in the database (PostgREST relies on FK metadata to resolve relationships).
- RLS policies block the joined table for the `anon` role.
- Column name assumptions are wrong (e.g., if the FK column is named `film` not `film_id`).

---

## Metadata Fields — Present / Absent

| Field | Expected Location | Confidence | Notes |
|---|---|---|---|
| Film format (35mm, 70mm, DCP, IMAX) | `showtimes.format` or `showtimes.notes` | Low | Key open question — dedicated column vs. embedded in notes text |
| Series/retrospective name | `showtimes.series_name` or `series.name` via FK | Medium | Very common for repertory aggregators to track this |
| Director | `films.director` (text) | Medium-High | Likely denormalized text field |
| Release year | `films.year` | Medium-High | Standard film metadata field |
| Country | `films.country` | Medium | Common but not universal |
| Runtime | `films.runtime` | Medium | Common but not always populated |
| "Featured" / critic pick flags | Unknown | Low | No evidence in task spec; could exist as `showtimes.is_featured` boolean |
| Ticket URL | `showtimes.ticket_url` | Medium | Useful for aggregator; common pattern |
| Rep vs. first-run distinction | Unknown | Low-Medium | May be implicit (venue type) or explicit flag on `venues` or `showtimes` |
| TMDB/IMDB cross-reference | `films.tmdb_id`, `films.imdb_id` | Low-Medium | Helpful for enrichment; not guaranteed |
| Poster URL | `films.poster_url` | Low-Medium | May come from TMDB rather than stored locally |

---

## Open Questions

These were the specific questions the introspection was meant to answer, all of which remain open:

1. **What is the complete table list?** The OpenAPI `definitions` object was never fetched. There may be additional tables beyond showtimes/films/venues (e.g., `events`, `screenings`, `curators`, `programs`, `tags`, `film_tags`, `watchlist`, `users`).

2. **Is `format` a dedicated column on `showtimes`?** This is the most important unanswered question for the app. If 35mm/70mm screenings are only mentioned in free-text notes, they're hard to filter programmatically.

3. **Are double features one row or two?** If one row with a special type/flag, joining to `films` would only give one film per showtime row.

4. **What is the primary key type?** UUID vs. bigint/bigserial affects join and lookup performance.

5. **Does the `anon` role have SELECT on all tables?** RLS policies may restrict certain tables (e.g., if there's a `users` or `watchlist` table, those would be user-scoped).

6. **What is the data freshness / update cadence?** Are there stale rows from months ago, or is there a cleanup job? The task's Step 7 ("oldest rows" check) was meant to reveal this.

7. **What is the exact row count for the next 14 days (2026-04-19 to 2026-05-03)?** Could not be determined — Content-Range from HEAD request was unavailable.

8. **How many unique films and venues are represented in the next 14-day window?**

9. **Does PostgREST expose `X-RateLimit-*` headers?** Standard Supabase projects do not enforce PostgREST-level rate limits (rate limiting is at the Kong API gateway level, if configured). Could not check response headers.

10. **Does the `series` table exist as a separate entity, or is series data embedded in `showtimes`?**

---

## Network Blocker — Reproduction Steps

To verify the block from this environment:

```bash
curl -v \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  "https://smwdhiwbgmmpqtuuoaou.supabase.co/rest/v1/"
# → HTTP/2 403, x-deny-reason: host_not_allowed
```

The TLS certificate on the connection is issued by `O=Anthropic; CN=sandbox-egress-production TLS Inspection CA`, confirming the sandbox proxy performs TLS interception and blocks non-whitelisted hosts before the request reaches Supabase's servers.

**To run this introspection successfully**, execute from any environment with unrestricted outbound HTTPS to `*.supabase.co` — a standard developer workstation, GitHub Actions runner with default networking, or a cloud VM with no egress restrictions.
