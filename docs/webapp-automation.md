# Webapp automation plan

## Goal

Let a user request a followers/following analysis from the webapp without blocking the HTTP request and without depending on a fragile live browser tab.

## Recommended product flow

1. User submits an Instagram username.
2. Backend runs a cheap preview: 6 followers + 6 following.
3. UI shows the preview immediately, with the remaining results blurred/locked.
4. Backend creates an `export_job` with status `queued` only when the user requests the full analysis.
5. A worker picks the job, opens/reuses one Instagram browser session, and exports one page at a time.
6. Worker writes a checkpoint after every GraphQL page.
7. UI polls or receives realtime updates.
8. When both followers and following are complete, backend imports the CSVs, computes overlap, and marks the job `completed`.
9. User downloads CSV/JSON or sees the comparison in the app.

## Cheap preview mode

The scraper does not use LLM tokens. The cost is browser/session time and Instagram GraphQL requests.

For a fast product preview, request only a tiny sample:

```bash
npm run preview:extension-graphql -- profilefinder.ai
```

Equivalent explicit command:

```bash
npm run export:extension-graphql -- profilefinder.ai --mode both --delay 0 --limit-items 6
```

This makes at most:

- 1 profile page load
- 1 GraphQL page for followers
- 1 GraphQL page for following

Use this to show:

- public follower/following counts
- 6 visible follower examples
- 6 visible following examples
- blurred placeholders for the rest
- a CTA to launch the full background job

Suggested frontend rule:

```text
show first 6 followers
show first 6 following
blur/lock the remaining cards
start full export only after user confirms
```

## Safer acquisition modes

Use these in this order:

1. **Official/owned-data mode**
   User uploads their official Instagram data export JSON. This is the most stable and easiest to defend.

2. **Companion extension mode**
   A browser extension runs in the user's own browser/session and sends completed CSV/JSON results to your backend. This avoids handling Instagram passwords on your server.

3. **Server worker mode**
   A server-side worker runs the current GraphQL exporter with an authorized test/account session. Keep concurrency low, checkpoint every page, and stop on rate-limit/challenge/login-required.

## Do not make the HTTP request do the export

Bad:

```text
POST /api/analyze-instagram -> open Chrome -> collect 70 pages -> return result
```

Good:

```text
POST /api/export-jobs -> returns job_id immediately
GET /api/export-jobs/:id -> returns status/progress/result links
worker -> processes queued jobs in background
```

## Minimal database schema

```sql
CREATE TABLE export_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_username TEXT NOT NULL,
  mode TEXT NOT NULL, -- followers, following, both
  status TEXT NOT NULL, -- queued, running, checkpointed, completed, failed, cancelled
  source TEXT NOT NULL, -- official_export, extension_graphql, companion_extension
  public_followers_count INTEGER,
  public_following_count INTEGER,
  collected_followers_count INTEGER DEFAULT 0,
  collected_following_count INTEGER DEFAULT 0,
  current_phase TEXT,
  current_page INTEGER DEFAULT 0,
  error_message TEXT,
  output_json_path TEXT,
  output_csv_followers_path TEXT,
  output_csv_following_path TEXT,
  summary_json_path TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  updated_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE export_job_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES export_jobs(id)
);
```

## Worker behavior

Use a queue with low concurrency:

- one active browser worker per Instagram session
- one active job per worker
- page delay default: 15 seconds
- checkpoint after every page
- resume from checkpoint if interrupted
- stop and mark `failed` or `needs_user_action` on login/challenge/rate-limit

Pseudo-flow:

```text
while true:
  job = claim_next_queued_job()
  mark running
  try:
    run exporter with --resume
    import CSV outputs
    compute overlap
    mark completed
  except LoginRequired:
    mark needs_user_action
  except RateLimited:
    mark checkpointed with retry_after
  except Exception:
    mark failed with error
```

## Progress contract for frontend

Return this from `GET /api/export-jobs/:id`:

```json
{
  "id": "job_123",
  "status": "running",
  "targetUsername": "profilefinder.ai",
  "phase": "followers",
  "currentPage": 42,
  "publicTotal": 3329,
  "collected": 1976,
  "progressPct": 59.4,
  "message": "Collecting followers page 42",
  "result": null
}
```

Completed response:

```json
{
  "id": "job_123",
  "status": "completed",
  "targetUsername": "profilefinder.ai",
  "result": {
    "followersCount": 3326,
    "followingCount": 256,
    "followsBackCount": 30,
    "notFollowingBackCount": 226,
    "fansNotFollowedBackCount": 3296,
    "followersCsvUrl": "/exports/job_123/followers.csv",
    "followingCsvUrl": "/exports/job_123/following.csv",
    "summaryJsonUrl": "/exports/job_123/summary.json"
  }
}
```

## Scaling strategy

Do not scale by increasing concurrent requests inside one Instagram session.

Scale by:

- queueing requests
- caching results by target for 12-24h
- deduplicating identical active jobs
- using official export upload for high-volume users
- adding more isolated workers only when each worker has its own authorized session and cooldown policy

## Important product decisions

Decide before implementation:

- Will users upload official Instagram exports?
- Will users connect through a companion browser extension?
- Will the server ever store Instagram credentials? Prefer no.
- What happens when Instagram asks for login/challenge?
- How long is a result cached?
- Can two users request the same target at the same time? Prefer dedupe.

## Hand-off summary

For production, build a queue-backed export service around `python/extension_graphql_export.py`, not a synchronous API endpoint. The current script already supports the key worker requirements:

- `--targets-file`
- `--resume`
- per-page `.partial.json` checkpoints
- low-rate GraphQL pagination
- CSV/JSON outputs compatible with the import pipeline
