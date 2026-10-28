# CampaignPilot

A local Pi extension for planning marketing campaigns and saving validated JSON,
Markdown, and calendar CSV. Pi handles the conversation and model access; this extension owns
campaign validation and local exports.

## Setup and use

```sh
npm ci
npm run typecheck
npm run dev
```

In Pi, configure a provider with `/login`, choose a tool-capable model with
`/model`, and start with:

```text
/campaign Create an awareness campaign for Bean & Brew's new matcha latte.
```

This project's Pi settings default to OpenRouter's
`nvidia/nemotron-3-ultra-550b-a55b:free`. An existing OpenRouter `/login` is reused;
no API key belongs in the project. See [OPENROUTER_SETUP.md](OPENROUTER_SETUP.md)
for model selection, credential storage, and troubleshooting.

Answer the brief questions. The model should call `campaign_save`, which validates
the campaign and writes `campaigns/<generated-id>/campaign.json`, `campaign.md`,
and `calendar.csv`.
See [examples/brief.json](examples/brief.json) for the expected brief fields.
Generated campaigns are ignored by Git. Review campaign claims before publishing.

This project implements sections 3–9 (MVP, V1, and V2) of
[the implementation guide](CampaignPilot_Implementation_Guide.md), with a tool
argument compatibility fix for models that send a JSON-string campaign. Run
`npm test` for campaign validation, storage, tool arguments, revisions, quality
scoring, and CSV escaping. See the manual integration checklist in
[IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md).

## Load and revise a saved campaign

Restart Pi after updating the extension, then ask:

```text
Load campaign <id> and summarize its strategy using campaign_load.
```

```text
Use campaign_revise to revise only the posts section of campaign <id>. Reason:
make the captions more concise. Preserve post IDs, channels, the brief, assumptions,
and all other sections. Show me the diff for approval.
```

Editable sections are `strategy`, `posts`, `calendar`, `budget`, and `kpis`.
Each revision saves a new campaign ID plus `revision.json` containing its parent
ID, section, reason, and timestamp. The parent files remain unchanged. The tool
returns a short diff; review the full saved files and approve the draft before
using it. Approval is conversational; this project does not publish campaigns or
store an approval status.

Large load results are marked as truncated and identify the complete file on disk.
Read that file before revising. Post changes must preserve IDs and channels used
by the existing calendar; schedule edits require a separate `calendar` revision.

## Review and calendar export

Restart Pi, then ask:

```text
Use campaign_review to review campaign <id>. Explain the score and findings.
```

The tool validates saved data before scoring it. Its deterministic rubric checks
post quantity, documented assumptions, CTA length, and KPI measurement detail.
The score is a heuristic, not a prediction of campaign performance or confirmation
that factual claims are correct. Any model commentary about voice or audience fit
is separate from that score.

New campaigns and revisions automatically include `calendar.csv`; no separate
export call is needed. It uses day offsets and includes channel, post ID, title,
caption, and CTA. Cells are quoted, embedded quotes are escaped, and leading
spreadsheet formula prefixes are neutralized. Original JSON/Markdown text stays
unchanged. Existing campaigns are not backfilled or overwritten.

See [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) for file explanations,
Pi API compatibility notes, and verification limits.
