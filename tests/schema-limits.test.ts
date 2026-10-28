import { describe, expect, it } from "vitest";
import { validateCampaign } from "../src/checks.js";
import { MAX_CAMPAIGN_BYTES } from "../src/limits.js";
import { prepareSaveArguments } from "../src/tool-input.js";
import { sampleCampaign } from "./fixtures/campaign.js";

describe("schema and input limits", () => {
  it("bounds constraint and assumption counts", () => {
    const campaign = sampleCampaign();
    campaign.brief.constraints = Array(51).fill("No invented offers");
    expect(() => validateCampaign(campaign)).toThrow();
    campaign.brief.constraints = [];
    campaign.assumptions = Array(101).fill("Needs review");
    expect(() => validateCampaign(campaign)).toThrow();
  });

  it("rejects oversized or path-like calendar references", () => {
    for (const postId of ["a".repeat(61), "../outside"]) {
      const campaign = sampleCampaign();
      campaign.calendar[0].postId = postId;
      expect(() => validateCampaign(campaign)).toThrow();
    }
  });

  it("rejects oversized encoded payloads before JSON parsing", () => {
    expect(() => prepareSaveArguments({ campaign: "x".repeat(MAX_CAMPAIGN_BYTES + 1) })).toThrow(/2 MiB/);
  });

  it("reports circular input as non-JSON data", () => {
    const circular: { campaign?: unknown } = {};
    circular.campaign = circular;
    expect(() => prepareSaveArguments(circular)).toThrow(/JSON-serializable/);
  });

  it("rejects missing brand, negative budget, overlong duration, and duplicate channels", () => {
    const campaign = sampleCampaign();
    for (const brief of [
      { ...campaign.brief, brand: undefined },
      { ...campaign.brief, budgetVnd: -1 },
      { ...campaign.brief, durationDays: 91 },
      { ...campaign.brief, channels: ["instagram", "instagram"] },
    ]) {
      expect(() => validateCampaign({ ...campaign, brief })).toThrow();
    }
  });
});
