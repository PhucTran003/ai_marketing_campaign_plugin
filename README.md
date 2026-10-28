# CampaignPilot

A TypeScript extension for Pi that turns a marketing brief into validated local
campaign drafts. Pi handles model access and conversation; CampaignPilot checks
campaign structure, budget totals, channel choices, and calendar references before
saving JSON, Markdown, and CSV.

The project includes immutable section revisions and deterministic quality review.
It does not publish posts, purchase ads, or run a separate inference service.

## Quick start

Use a Node.js version compatible with the package engines: Node 22.19+, 24, or
26+. Verification for this repository was performed on Node 26.12.1 / npm 11.20.0.
Pi 1.4.0 is installed locally; a global Pi installation is unnecessary.
`npm run dev` uses its shipped unbundled CLI so the patched Undici dependency
is used. A separate global/bundled `pi` executable is outside that fix.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run demo
```

`npm run demo` uses fictional test data, makes no model requests, and prints the
locations of temporary exports for inspection. It verifies saving/loading, invalid
budget rejection, heuristic review, and an immutable calendar revision. See
[DEMO.md](DEMO.md) for the recording script and live Pi walkthrough.

To generate a campaign with a model:

```sh
npm run dev
```

Trust this project when Pi asks. In Pi, use `/login` to authenticate with a provider
and `/model` to select a model that supports tools. An existing OpenRouter login
is reused. Credentials belong in Pi's private `~/.pi/agent/auth.json`, managed by
`/login`; no key belongs in this repository. Pi can also use `OPENROUTER_API_KEY`
when no saved credential takes precedence. This project does not load `.env`.

The project preference in `.pi/settings.json` is
`openrouter` / `nvidia/nemotron-3-ultra-550b-a55b:free`. The `:free` suffix is part
of the model ID. Availability, account restrictions, and rate limits are controlled
by OpenRouter. Resuming an old session can restore its previous model.

```text
/campaign Create a campaign using examples/brief.json. Read the brief, ask for any missing facts, then call campaign_save.
```

Answer missing brief questions and inspect the resulting files before using any
copy. KPI targets are estimates; the extension cannot verify marketing claims.

## Commands and tools

| Interface | Input | Behavior |
| --- | --- | --- |
| `/campaign` | Optional brief text | Sends planning instructions to Pi; missing facts should be collected in conversation. |
| `campaign_save` | Complete `campaign` object | Validates and saves a new campaign ID with three exports. |
| `campaign_load` | Generated `id` | Loads and validates saved JSON; large previews are marked as truncated. |
| `campaign_revise` | `parentId`, `section`, `reason`, full `campaign` | Validates a one-section change, saves a new ID, records revision metadata, and returns a short diff. |
| `campaign_review` | Generated `id` | Validates saved data and returns deterministic heuristic findings and a score. |

Model-callable tools take IDs, never arbitrary destination paths. Saves and
revisions support native campaign objects and a single JSON-encoded campaign
string for model compatibility. Both paths still require complete validation.

```text
Load campaign <id> and summarize its strategy using campaign_load.
```

```text
Use campaign_revise to shorten only the posts section of campaign <id>.
Reason: make the captions easier to scan. Preserve post IDs, channels, the brief,
assumptions, and all other sections. Show the diff for my approval.
```

```text
Use campaign_review to review campaign <id> and explain its findings.
```

Revisions may edit `strategy`, `posts`, `calendar`, `budget`, or `kpis`. The brief,
assumptions, and unrelated sections must remain unchanged. Post revisions must
preserve IDs and channels used by the calendar; schedule edits require a separate
calendar revision. Approval is conversational; there is no approval-state service.

The review rubric checks post quantity, documented assumptions, CTA length, and
KPI measurement detail. Its 0–100 score is a heuristic, not a performance forecast,
fact checker, or approval to publish. Model commentary on audience fit or brand
voice is separate from that score.

## Files and architecture

```text
Pi conversation -> campaign tools -> Zod + domain checks -> local exports
                                      |                    |
                                      +-> quality rubric   +-> new revision ID
```

| Module | Responsibility |
| --- | --- |
| `.pi/extensions/campaignpilot.ts` | Pi command/tool adapters and planning instructions. |
| `src/schema.ts`, `src/checks.ts` | Field validation and cross-field invariants. |
| `src/storage.ts`, `src/limits.ts` | Bounded reads, symlink checks, staged export bundles, and ID reservations. |
| `src/revisions.ts` | Unchanged-field checks, revision metadata, and bounded diffs. |
| `src/tool-input.ts`, `src/load-preview.ts` | Model argument compatibility and bounded load previews. |
| `src/render.ts`, `src/csv.ts` | Markdown and CSV rendering. |
| `src/review.ts` | Pure deterministic quality rubric. |
| `tests/` | Validation, exports, revisions, safety regressions, and Pi registration checks. |

Successful writes create:

```text
campaigns/<generated-uuid>/
  campaign.json
  campaign.md
  calendar.csv
  revision.json    # revisions only
```

A complete bundle is staged before a directory rename publishes it. Ordinary
write failures remove staging data; exclusive ID reservations protect cooperating
writers from collisions. Existing campaigns remain unchanged. Older campaigns
are not backfilled with CSV. Calendar rows use day offsets rather than fabricated
publication dates; CSV cells quote special characters and prefix formula-like
text with an apostrophe. Original campaign text remains in JSON and Markdown.

## Verification and limits

Verified during the audit: 106 tests across 10 files, TypeScript typecheck, an
offline demo, a clean lockfile installation with lifecycle scripts disabled, and
Pi CLI/extension loading. `npm audit` reported zero known advisories after the
Undici patch override. These are point-in-time checks, not security guarantees.
The user previously confirmed live campaign generation; the final audit does not
claim a fresh live-provider run or marketing effectiveness.

Campaign tools execute with Pi's OS permissions. Static symlink checks and a
no-follow JSON open do not sandbox Pi or defeat every filesystem race by a hostile
local process. Built-in Pi tools can access other files or execute commands.
Treat campaign data and rendered Markdown as untrusted content. The planner is
instructed to ignore embedded instructions; that instruction is not a technical
prompt-injection guarantee. Disable raw HTML in any Markdown renderer used for
untrusted exports.

An abrupt process exit can leave hidden `.pending-*` or `.reserve-*` directories;
no automatic stale-directory deletion is implemented. Atomic publication is not
a guarantee of power-loss durability or distributed-filesystem behavior. Stored
JSON and tool payloads are limited to 2 MiB; constraints and assumptions are capped
at 50 and 100 entries. Cancellation, filesystem timeouts, CI, package publication,
and multi-user access control are not implemented.

See [AUDIT.md](AUDIT.md) for prioritized findings, fixes, and remaining work;
[IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) for implementation details; and
[DEMO.md](DEMO.md) for the demo walkthrough and portfolio evidence.
The package is private and has not been published to npm.
