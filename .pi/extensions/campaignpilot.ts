import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { saveCampaign } from "../../src/storage.js";

const SaveInput = Type.Object({
  campaign: Type.Any({ description: "A complete campaign object matching the campaign structure in the prompt" }),
});

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
and save it. If validation fails, fix the structure and retry. Then tell the
user the saved campaign ID, output file paths and concise summary.
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
    description: "Validate a complete marketing campaign and export JSON + Markdown under the current project's campaigns directory.",
    parameters: SaveInput,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = await saveCampaign(ctx.cwd, params.campaign);
      return {
        content: [{ type: "text", text: `Saved campaign ${result.id} to ${result.folder} (campaign.json, campaign.md)` }],
        details: { id: result.id, folder: result.folder },
      };
    },
  });
}
