import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadCampaign, saveCampaign } from "../../src/storage.js";
import { reviewCampaign } from "../../src/review.js";
import { loadCampaignPreview } from "../../src/load-preview.js";
import { RevisionInfoSchema, saveRevision } from "../../src/revisions.js";
import { SaveInput, LoadInput, ReviseInput, prepareSaveArguments, prepareRevisionArguments } from "../../src/tool-input.js";

const CAMPAIGN_INSTRUCTIONS = `
You are a marketing campaign planning assistant. Ask the user for missing
required facts instead of inventing them. Required brief: brand, product,
audience, goal (awareness/traffic/leads/sales), budgetVnd (integer),
durationDays (integer 1..90), channels (instagram/tiktok/facebook/email),
differentiator, voice, constraints (array).

When you have enough information, create a campaign object with EXACT keys:
{
  "brief": { "brand": "...", "product": "...", "audience": "...",
    "goal": "awareness", "budgetVnd": 3000000,
    "durationDays": 14, "channels": ["instagram", "tiktok"],
    "differentiator": "...", "voice": "...", "constraints": [] },
  "strategy": { "campaignName": "...", "positioning": "...",
    "keyMessage": "...", "audienceInsight": "..." },
  "posts": [{ "id": "post-1", "channel": "instagram", "title": "...",
    "caption": "...", "cta": "...", "hashtags": ["#brand"] }],
  "calendar": [{ "day": 1, "postId": "post-1", "channel": "instagram" }],
  "budget": [{ "channel": "instagram", "amountVnd": 3000000,
    "rationale": "..." }],
  "kpis": [{ "metric": "Reach", "target": "Estimate only: ...",
    "measurement": "..." }],
  "assumptions": []
}

The object may include multiple posts, calendar entries, budget channels, KPIs.
Use only selected channels. Calendar day is 1..durationDays. All postIds must
exist and channels must match. Budget amounts must sum EXACTLY to budgetVnd.
All text fields should be substantive, not placeholders. Do not invent facts,
performance results, discounts, endorsements or guarantees. Add assumptions
when facts need human confirmation.

IMPORTANT: Call the campaign_save tool with the campaign object to validate
and save it. Pass campaign as a nested JSON object, not a quoted JSON string.
If validation fails, fix the structure and retry. Then tell the
user the saved campaign ID, output file paths and concise summary.

For an existing campaign, call campaign_load using its ID. Read the complete
campaign before editing; if the preview is truncated, read the full saved file.
To revise, ask for the parent ID, requested section, and reason if missing.
Call campaign_revise with a complete campaign that changes ONLY the requested
section (strategy/posts/calendar/budget/kpis). Preserve the brief, assumptions,
and unrelated sections. Revised posts must preserve calendar-referenced IDs
and channel assignments. Schedule changes require a separate calendar revision.
Show the returned diff and new ID and ask the user to approve the draft for use.
Never overwrite the original or use campaign_save to bypass revision checks.

Saves and revisions also export calendar.csv with day offsets, not launch dates.
Use campaign_review with a saved ID for deterministic quality heuristics. Its
score is not a performance prediction or approval to publish. For a qualitative
review of brand voice, factual claims, or platform fit, explain uncertainty and
keep that commentary separate from the deterministic score.
`;

export default function (pi: ExtensionAPI) {
  pi.registerCommand("campaign", {
    description: "Create a structured marketing campaign",
    handler: async (args, ctx) => {
      const brief = args.trim();
      ctx.ui.notify("Starting CampaignPilot", "info");
      pi.sendUserMessage(`${CAMPAIGN_INSTRUCTIONS}\n\nUser brief: ${brief || "Please interview me to gather the required brief."}`);
    },
  });

  pi.registerTool({
    name: "campaign_save",
    label: "Save Campaign",
    description: "Validate a complete marketing campaign and export JSON, Markdown, and calendar CSV under the current project's campaigns directory.",
    parameters: SaveInput,
    prepareArguments: prepareSaveArguments,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = await saveCampaign(ctx.cwd, params.campaign);
      return {
        content: [{ type: "text", text: `Saved campaign ${result.id} to ${result.folder} (campaign.json, campaign.md, calendar.csv)` }],
        details: { id: result.id, folder: result.folder },
      };
    },
  });

  pi.registerTool({
    name: "campaign_load",
    label: "Load Campaign",
    description: "Load a validated campaign by its generated ID. Large previews are truncated; read the full saved file before revising.",
    parameters: LoadInput,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = await loadCampaignPreview(ctx.cwd, params.id);
      return {
        content: [{ type: "text", text: result.text }],
        details: { id: params.id, truncated: result.truncated, filename: result.filename },
      };
    },
  });

  pi.registerTool({
    name: "campaign_revise",
    label: "Revise Campaign",
    description: "Save a new immutable draft revision of one campaign section. Load the full parent first. Preserve brief, assumptions, and other sections. Return the diff and ask for human approval before use; never overwrite the parent.",
    parameters: ReviseInput,
    prepareArguments: prepareRevisionArguments,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const info = RevisionInfoSchema.parse(params);
      const result = await saveRevision(ctx.cwd, info.parentId, info.section, params.campaign, info.reason);
      return {
        content: [{ type: "text", text: `Saved draft revision ${result.id} of ${result.metadata.parentId} to ${result.folder} (campaign.json, campaign.md, calendar.csv, revision.json).\nReason: ${result.metadata.reason}\n${result.summary}\nHuman review required: show this diff and ask the user to approve this draft before using it. The parent is unchanged.` }],
        details: { id: result.id, folder: result.folder, parentId: result.metadata.parentId, section: result.metadata.section, summary: result.summary },
      };
    },
  });

  pi.registerTool({
    name: "campaign_review",
    label: "Review Campaign",
    description: "Validate a saved campaign by ID and return deterministic quality findings and a heuristic score. This does not predict marketing performance, verify factual claims, or approve publication.",
    parameters: LoadInput,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const campaign = await loadCampaign(ctx.cwd, params.id);
      const review = reviewCampaign(campaign);
      return {
        content: [{ type: "text", text: `Campaign ${params.id} passed schema and domain validation.\nHeuristic quality score: ${review.score}/100. This is not a performance prediction or publishing approval.\n${JSON.stringify(review, null, 2)}` }],
        details: { id: params.id, ...review },
      };
    },
  });
}
