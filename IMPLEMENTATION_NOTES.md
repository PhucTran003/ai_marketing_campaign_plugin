# CampaignPilot implementation notes (sections 3–9)

Implemented the guide's MVP, tests, V1 load/revision workflow, and V2 scoring/CSV export. Pi owns model access and conversation;
the extension validates and exports campaigns locally. There is no separate model
client, web UI, or publishing integration.

## Files

| File | Purpose |
| --- | --- |
| `package.json` | ESM package with the guide's `dev`, `test`, and `typecheck` scripts; dependencies resolved by npm rather than copied version pins. Pi is installed locally as a development dependency. |
| `package-lock.json` | Records the dependency versions for reproducible installation with `npm ci`. |
| `tsconfig.json` | Strict ES2022 / NodeNext checking of source, future tests, and the Pi extension. No JavaScript is emitted. |
| `.gitignore` | Preserves existing rules and adds generated `campaigns/` and macOS `.DS_Store` exclusions; dependencies and environment files were already ignored. |
| `src/schema.ts` | Zod schemas and inferred `Brief` / `Campaign` types, with field bounds and unique selected channels. |
| `src/checks.ts` | `validateCampaign` parses untrusted input and rejects duplicate post IDs, invalid channel choices, bad calendar references/days, and incorrect budget totals. |
| `src/render.ts` | `renderMarkdown` exports the brief, strategy, content, calendar, budget, proposed KPIs, and human review notes. |
| `src/storage.ts` | `saveCampaign` validates before writing and creates UUID directories containing exclusive JSON, Markdown, and CSV files. `loadCampaign` validates IDs and revalidates persisted campaigns. |
| `.pi/extensions/campaignpilot.ts` | Registers `/campaign`, `campaign_save`, `campaign_load`, `campaign_revise`, and `campaign_review`. Revision responses show the new ID and a short diff, with instructions to seek human approval before use. Review validates saved data before scoring. |
| `src/review.ts` | Pure deterministic quality heuristic from section 8; returns a score clamped at zero and warning/info findings. It does not infer marketing performance or verify claims. |
| `src/csv.ts` | Pure calendar export from section 9, with CRLF rows, quoted cells, escaped quotes, and apostrophe-prefix protection for formula operators after optional whitespace. |
| `src/tool-input.ts` | Generates nested campaign schemas from Zod; defines ID-based load/revision parameters and preserves the JSON-string compatibility hook for both saves and revisions. |
| `src/revisions.ts` | Validates one-section revisions, preserves the brief and assumptions, saves a new campaign with exclusive `revision.json` metadata, and produces a bounded field-level before/after diff. |
| `src/load-preview.ts` | Returns validated JSON using Pi's `truncateHead`, capped at 20,000 bytes or 500 lines. Marks truncation and identifies the full file without copying it into tool details. |
| `tests/tool-input.test.ts` | Focused regression tests for native objects, JSON-string arguments, malformed/non-object/double-encoded JSON, Pi schema validation, successful exports, and rejection without writes. |
| `tests/fixtures/campaign.ts` | A fresh, typed sample campaign for each validation/storage test; no casts are needed to construct invalid input passed to the validator. |
| `tests/checks.test.ts` | The section 5 cases plus duplicate IDs, unsupported/unselected channels, calendar channel mismatches, and duplicate budget channels. |
| `tests/storage.test.ts` | Temporary-directory tests for JSON/Markdown export, persisted loading, separate saves without overwrites, invalid-input rejection before writes, unsafe ID rejection, and validation on load. |
| `tests/revisions.test.ts` | Covers all five editable sections, byte-for-byte parent preservation, revision metadata and chains, unchanged brief/assumptions/unrelated sections, calendar dependencies, safe parent IDs, and bounded diffs. |
| `tests/v1-tools.test.ts` | Checks revision parameters with Pi's argument validator, JSON-string compatibility, uneditable sections, ID-only inputs, complete/truncated load previews, and path rejection. |
| `tests/review.test.ts` | Pure tests for each scoring rule, thresholds, cumulative penalties, the zero floor, repeatability, and input preservation. |
| `tests/csv.test.ts` | Pure tests for exact CSV rows, quotes/commas/newlines, formula injection and leading whitespace, Unicode text, calendar ordering/repeated references, missing posts, and input preservation. |
| `examples/brief.json` | The guide's Bean & Brew sample brief. |
| `tests/.gitkeep` | Original scaffold placeholder; the directory now contains the test suite. |
| `README.md` | Local installation, typecheck, and Pi usage instructions with explicit scope and verification limits. |
| `IMPLEMENTATION_NOTES.md` | This file: implementation explanations, API comparison, and verification record. |

The ignored `campaigns/` directory exists locally and is also created on demand by
`saveCampaign`. New campaigns and revisions contain `calendar.csv`; older campaign
directories are not modified automatically.

## Installed Pi API compared with the guide

Verified against `@earendil-works/pi-coding-agent` **1.4.0**, specifically
`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`:

- `ExtensionAPI`, `registerCommand`, and `registerTool` support the guide's usage.
- `ToolDefinition.execute` still takes five arguments: tool-call ID, inferred
  parameters, optional abort signal, optional update callback, and context. The
  current context type is `ExtensionToolContext`, which supplies `cwd`.
- `sendUserMessage` accepts a string and returns `void`; its optional settings
  include `deliverAs` and `expandPromptTemplates`. The guide's single-string call
  requires no change.
- Pi's declarations import `TSchema` and `Static` from the newer `typebox` package.
  The guide imports `Type` from `@sinclair/typebox` (installed version **0.34.52**).
  The supplied object/any schema satisfies the installed Pi types, so the guide's
  import is retained. This is compile-time verification, not a claim of a complete
  provider/tool-call integration test.

The initial scaffold needed no adapter changes. A real Nemotron interaction then
exposed a tool-call compatibility issue: it repeatedly supplied `campaign` as a
JSON string. The guide's `Type.Any` accepted it, and Zod correctly rejected it
because a campaign must be an object.

The adapter now exposes a full JSON Schema generated with Zod's `toJSONSchema`
instead of `Type.Any`. `Type.Unsafe<unknown>` wraps that generated schema for the
TypeBox interface without asserting that the input is a valid campaign. Pi's
installed `prepareArguments` hook runs before tool schema validation and decodes
a string value once. Malformed JSON, primitives, arrays, null, and double-encoded
strings are rejected. Zod and all domain checks still run before any writes.
Channel uniqueness and cross-field invariants remain in runtime validation.

The planner instructions explicitly request a nested object. No provider
configuration or model change is required for this compatibility fix.

## V1 behavior and differences from the guide

- The same installed Pi 1.4.0 `registerTool` / `execute` API handles both new tools.
  Revision metadata is parsed with Zod in the handler, providing a checked section
  enum without casting through the two TypeBox packages' type inference.
- Both tool inputs accept generated IDs, never caller-selected filesystem paths.
  `campaign_revise` additionally takes `section`, `reason`, and the full campaign.
- `saveRevision` validates the parent, candidate, and unchanged fields before
  creating files. Each successful revision uses a new UUID directory, preserving
  the parent, and writes `revision.json` with `parentId`, `section`, trimmed
  nonempty `reason`, and ISO `createdAt`. Metadata uses exclusive `wx` writes.
- Unlike the starter snippet, assumptions are also protected as an unrelated
  top-level section. Deep equality checks compare parsed data rather than object
  key order. Post/calendar dependencies follow the guide's strict V1 rule.
- Load output is bounded using Pi's installed `truncateHead` API. Full validated
  JSON stays on disk. A truncated preview explicitly warns the model to read the
  complete file before preparing a revision.
- Revision responses include up to eight changed fields with short before/after
  excerpts and an omitted-change count. Human approval is conversational and is
  requested after saving a draft; there is no publishing or approval-state tool.

## V2 behavior and differences from the guide

- `reviewCampaign` and `calendarCsv` implement the guide's pure functions. Their
  27 unit tests passed before any storage or Pi wiring was added, as Prompt 4
  requires. No dependencies or provider configuration changes were needed.
- `campaign_review` takes the same ID-only schema as `campaign_load`, loads and
  validates the saved campaign, then applies the deterministic rubric. Invalid
  schema/domain data fails without a score. No filesystem path is accepted.
- The review is read-only and does not save a score or alter campaign files. Tool
  text explicitly states that the score is not a performance prediction or
  publishing approval. Optional model commentary on brand voice, claims, audience,
  or platform fit must explain uncertainty and stay separate from the score.
- CSV export runs automatically through `saveCampaign` after validation, so new
  revisions also export their updated calendar without touching the parent CSV.
  There is no redundant CSV tool or retroactive export into historical folders.
- Formula protection affects only CSV cells; JSON and Markdown preserve original
  content. Calendar days remain offsets rather than invented publication dates.

## Verification

- `npm run typecheck`: **passed**, no TypeScript errors.
- `git diff --check`: **passed**.
- Pi's installed `discoverAndLoadExtensions` loaded the actual TypeScript
  extension successfully with an isolated temporary agent directory; `/campaign`
  and all four campaign tools were registered. An offline smoke check invoked
  the actual save/revise/review handlers, confirmed CSV creation and parent
  preservation, and checked rejection of unsafe IDs and invalid budgets before
  review. No provider call was made.
- `npm test`: **88 tests passed across 7 files**: 10 campaign validation tests,
  14 storage tests, 8 tool argument regression tests, 20 revision tests,
  9 V1 tool input/preview tests, 11 quality review tests, and 16 CSV tests. Storage tests use
  isolated temporary directories and remove them after each test.
- The existing tool argument tests exercise Pi's installed `validateToolArguments`
  validator. No casts or type suppressions were added.
- The user confirmed a successful live campaign after the argument compatibility
  fix. Automated tests do not call a model or require API credentials.

## Remaining manual integration checks

The successful generation is already user-confirmed. To complete section 5's
integration checklist in Pi:

1. Inspect both saved files for complete strategy, posts, calendar, budget, KPIs,
   and review notes; confirm factual claims and proposed targets are appropriate.
2. Ask the model to call `campaign_save` with an incorrect budget total; confirm
   the tool reports rejection and only saves after repair.
3. Repeat with duplicate post IDs and confirm the error is surfaced and repaired.
4. Generate a second brand's campaign and check that the first campaign's files
   remain unchanged.
5. Exit and restart Pi, then confirm the saved JSON and Markdown remain on disk.

For the new V1 tools (not yet tested with a live model):

1. Restart Pi to load the updated extension. Ask `campaign_load` to summarize an
   existing campaign by its ID.
2. Ask for a posts-only revision with a reason, preserving referenced IDs/channels.
   Confirm `campaign_revise` returns a different ID and a useful diff, and inspect
   its `revision.json`, JSON, and Markdown before approving the draft for use.
3. Try changing the brief or an unrelated section in that revision; confirm Pi
   surfaces the rejection and repairs the candidate without changing the parent.
4. Load both parent and revision after restarting Pi and verify both persist.
5. For a large campaign, confirm Pi reads the complete file after receiving a
   truncated preview before revising it.

For V2 (registered handlers verified offline; live model use still to check):

1. Restart Pi and ask `campaign_review` to review a saved campaign by ID. Confirm
   it explains the heuristic findings without promising results.
2. Save a campaign or a new revision and inspect `calendar.csv` in that new folder.
   Import it into your spreadsheet application and verify multiline cells,
   Vietnamese text, and day offsets. Formula-like text must be treated as text.
3. Revise only the calendar, then confirm the new CSV matches the revision and the
   original CSV remains unchanged. Historical campaigns may have no CSV.

Storage retains the guide's local MVP limitations: it does not protect against
symlinked campaign directories or make output writes atomic. A failed write can
leave an incomplete new directory, including a campaign without revision metadata;
it does not update the parent. Those production-hardening changes remain outside
the scope of Prompt 4. Portfolio hardening and CI from section 10 are not implemented.
