# Demo and portfolio script

## Reproducible offline demo

From the repository root:

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run demo
```

The demo script is `scripts/demo.ts`. It uses the same fictional Bean & Brew
fixture as the tests and writes into a fresh OS temporary directory. No provider
login, API key, network request, or real project campaign is used. Successful
runs retain the printed folder for inspection; failed runs clean it up.

Expected evidence, verified locally:

- Two `PASS` messages, followed by JSON with the workspace and two different IDs.
- Original exports: `campaign.json`, `campaign.md`, `calendar.csv`.
- Revision exports: all three files plus `revision.json` linking to the parent.
- An invalid budget is rejected without creating another campaign.
- The review score is 85 with a warning about too few posts. This is a heuristic.
- The diff is `calendar[0].day: 1 → 2`, and the original files remain unchanged.

Open the printed revision folder in your editor and show the CSV day offset and
the `parentId`, `section`, `reason`, and `createdAt` metadata. IDs and temporary
paths change on every run; do not hardcode them in a recording.

## Three-minute recording narrative

1. **Problem (20 seconds).** “A model can draft campaign copy, but a useful local
   workflow also needs validated budgets, valid schedules, saved outputs, and
   revisions that preserve the original.”
2. **Boundary (30 seconds).** Show `.pi/extensions/campaignpilot.ts` and
   `src/checks.ts`. “Pi owns the conversation and model calls. Deterministic code
   checks generated data before persistence. The tools never accept output paths.”
3. **Evidence (60 seconds).** Run the checks and offline demo. Show the printed
   exports and the rejected-budget assertion. Do not present the fixture as
   AI-generated campaign output.
4. **Revision (40 seconds).** Compare the two calendars and open `revision.json`.
   “A revision has a new ID. The brief and unrelated sections cannot change, and
   the parent files stay intact.”
5. **Judgment (30 seconds).** Show the quality warning and `AUDIT.md`. “The score
   is a small heuristic, not a forecast. This is a local extension, not a sandbox
   or a publishing system. The audit tests failures and concurrency.”

## Optional live Pi walkthrough

This part requires your provider credentials and working model tool support; it
is not covered by the offline demo. Do not record credentials or private data.

```sh
npm run dev
```

Confirm the model, then send:

```text
/campaign Read examples/brief.json and create a campaign. Ask for missing facts, then call campaign_save. Do not invent discounts or health claims. Keep KPI targets explicitly estimated.
```

Use the returned ID in:

```text
Use campaign_review to review campaign <id>. Explain the findings as heuristics.
```

```text
Load campaign <id>, then use campaign_revise to move only its first calendar entry
to another valid campaign day. Reason: adjust the publishing schedule. Preserve
all other data and show the diff for my approval.
```

Confirm the new ID and metadata, compare both exports, and approve the draft only
after review. If the first calendar entry cannot move within the duration, choose
a campaign with multiple valid days. For a large truncated preview, confirm the
model reads the complete file before editing. Model success, speed, and latency
depend on the provider and are not guaranteed by these instructions.

## CV bullets supported by the repository

- Built a TypeScript Pi extension with model-callable tools for campaign planning,
  validation, immutable revisions, and local JSON/Markdown/CSV exports.
- Implemented deterministic budget, channel, and calendar checks; added staged
  storage publication, symlink rejection, and regression tests for write failures
  and concurrent saves.
- Added pure quality heuristics and CSV escaping tests, including spreadsheet
  formula injection; verified 106 tests, typecheck, and a reproducible offline demo.

Do not claim ad performance improvements, production deployment, npm distribution,
CI, comprehensive prompt-injection protection, or live behavior you have not
personally demonstrated. Describe the review score as a heuristic in interviews.
