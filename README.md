# CampaignPilot

A local Pi extension for planning marketing campaigns and saving validated JSON
and Markdown. Pi handles the conversation and model access; this extension owns
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

Answer the brief questions. The model should call `campaign_save`, which validates
the campaign and writes `campaigns/<generated-id>/campaign.json` and `campaign.md`.
See [examples/brief.json](examples/brief.json) for the expected brief fields.
Generated campaigns are ignored by Git. Review campaign claims before publishing.

This scaffold implements only sections 3–4 of
[the implementation guide](CampaignPilot_Implementation_Guide.md). Tests from
section 5 and V1/V2 features are not implemented. The `npm test` script is reserved
for that later test suite.

See [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) for file explanations,
Pi API compatibility notes, and verification limits.
