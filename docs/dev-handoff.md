# Dev handoff: reliable multi-request exports

## Current state

The project can now export Instagram followers/following using the same GraphQL pagination pattern observed in the local IG Exporter extension:

- Resolve `profilePage_<id>` from the profile page.
- Query Instagram GraphQL by `query_hash`.
- Page with `end_cursor` and `first: 50`.
- Stop only when `has_next_page=false`.
- Save CSV, JSON, and a `.partial.json` checkpoint while running.

Command:

```bash
npm run export:extension-graphql -- profilefinder.ai --mode both --delay 15 --resume
```

Batch command:

```bash
npm run export:extension-graphql -- --targets-file data/export-targets.txt --mode both --delay 15 --resume
```

Cheap preview command:

```bash
npm run preview:extension-graphql -- profilefinder.ai
```

This collects only 6 followers and 6 followings, enough for a webapp preview. It is intentionally not a full export.

## Multi-request strategy

Do not handle user demand by firing many concurrent Instagram requests from the same session. Treat Instagram export as a long-running job system.

Recommended architecture:

1. API receives an export request and creates a `jobs` row.
2. A queue assigns jobs to workers.
3. Each worker owns one browser session at a time.
4. Each job writes page checkpoints after every GraphQL page.
5. If a worker dies, the job is resumed from its `.partial.json` checkpoint.
6. Final CSV/JSON files are stored and the job is marked `completed`.

Safe defaults:

- `concurrency_per_account = 1`
- `delay_seconds = 15`
- `page_size = 50`
- `max_retries_per_page = 3`
- exponential backoff on transient errors
- stop on auth/challenge/rate-limit states and surface that status to the UI

## Multiple accounts

Multiple accounts should not be used to bypass Instagram limits. If there are multiple authorized customer accounts, isolate them:

- one cookie/session/profile directory per account
- one active worker per account
- account-level cooldown state
- no job stealing between accounts unless the user explicitly owns/authorized both accounts

For a graded demo, prefer:

- one real export job showing the GraphQL flow
- one simulated/official-data import showing large-scale deterministic output
- queued jobs with visible states: `queued`, `running`, `checkpointed`, `completed`, `failed`

## Improvements still worth implementing

- Persist jobs in SQLite instead of only filesystem outputs.
- Add `export_jobs` and `export_job_events` tables.
- Add a small dashboard/CLI: `list-jobs`, `show-job`, `resume-job`.
- Store output metadata: public count, collected count, pages, duration, delay, mismatch.
- Add a validator that imports the generated CSV automatically after both modes complete.
- Add account health state: `ok`, `login_required`, `challenge_required`, `cooldown`.

## Useful current outputs

Latest full `profilefinder.ai` run:

- following: 256 collected / 256 reported
- followers: 3326 collected / 3329 reported
- followers pages: 71
- delay: 15 seconds

The `3329 -> 3326` mismatch is reported by the script and should be shown as a normal data-quality warning, not hidden.
