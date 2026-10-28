import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateToolArguments } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { saveCampaign } from "../src/storage.js";
import { SaveInput, prepareSaveArguments } from "../src/tool-input.js";

// Exercise the same schema validator Pi uses after prepareArguments.
function validateArguments(args: { campaign: unknown }) {
  return validateToolArguments(
    { name: "campaign_save", description: "Save campaign", parameters: SaveInput },
    {
      type: "toolCall", id: "test-call", name: "campaign_save",
      arguments: z.record(z.string(), z.json()).parse(args),
    },
  );
}

function sample() {
  return {
    brief: {
      brand: "Bean & Brew", product: "Matcha latte",
      audience: "University students in Ho Chi Minh City", goal: "awareness",
      budgetVnd: 3000000, durationDays: 14, channels: ["instagram"],
      differentiator: "Customizable sweetness", voice: "Friendly", constraints: [],
    },
    strategy: {
      campaignName: "Matcha Moments", positioning: "Refreshing study break for students",
      keyMessage: "Take a matcha break", audienceInsight: "Students look for convenient breaks",
    },
    posts: [{
      id: "post-1", channel: "instagram", title: "Matcha break",
      caption: "A fresh matcha latte for your study break.", cta: "Visit us", hashtags: ["#matcha"],
    }],
    calendar: [{ day: 1, postId: "post-1", channel: "instagram" }],
    budget: [{ channel: "instagram", amountVnd: 3000000, rationale: "Reach students with short visuals" }],
    kpis: [{ metric: "Reach", target: "Estimate: 10000", measurement: "Platform analytics" }],
    assumptions: ["Budget allocation is a draft"],
  };
}

describe("campaign_save argument compatibility", () => {
  it("accepts a native object and advertises its required structure", () => {
    const campaign = sample();
    expect(prepareSaveArguments({ campaign }).campaign).toBe(campaign);
    expect(validateArguments({ campaign })).toEqual({ campaign });
    expect(() => validateArguments({ campaign: JSON.stringify(campaign) })).toThrow();
    expect(() => validateArguments({ campaign: {} })).toThrow();
  });

  it("saves JSON-string arguments after preparation and full validation", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "campaignpilot-input-"));
    try {
      const campaign = sample();
      const params = prepareSaveArguments({ campaign: JSON.stringify(campaign) });
      expect(validateArguments(params)).toEqual(params);
      const saved = await saveCampaign(cwd, params.campaign);
      expect(JSON.parse(await readFile(path.join(saved.folder, "campaign.json"), "utf8"))).toEqual(campaign);
      expect(await readFile(path.join(saved.folder, "campaign.md"), "utf8")).toContain("# Matcha Moments");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it.each(["{broken", "null", "[]", "42", JSON.stringify(JSON.stringify(sample()))])(
    "rejects invalid or repeatedly encoded campaign values: %s", (campaign) => {
      expect(() => prepareSaveArguments({ campaign })).toThrow(/campaign must/);
    },
  );

  it("still rejects invalid campaign data without writing files", async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), "campaignpilot-invalid-"));
    try {
      const badBudget = sample();
      badBudget.budget[0].amountVnd = 1;
      for (const campaign of [badBudget, { brief: { brand: "Bean & Brew" } }]) {
        const params = prepareSaveArguments({ campaign: JSON.stringify(campaign) });
        await expect(saveCampaign(cwd, params.campaign)).rejects.toThrow();
      }
      expect(await readdir(cwd)).toEqual([]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
