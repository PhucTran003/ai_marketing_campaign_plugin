import { describe, expect, it } from "vitest";
import { validateCampaign } from "../src/checks.js";
import { sampleCampaign } from "./fixtures/campaign.js";

describe("campaign validation", () => {
  it("accepts a complete campaign", () => {
    const campaign = sampleCampaign();
    expect(validateCampaign(campaign)).toEqual(campaign);
  });

  it("rejects budget mismatch", () => {
    const campaign = sampleCampaign();
    campaign.budget[0].amountVnd = 1;
    expect(() => validateCampaign(campaign)).toThrow(/Budget sums to 1000001, expected 3000000/);
  });

  it("rejects unknown calendar posts", () => {
    const campaign = sampleCampaign();
    campaign.calendar[0].postId = "missing";
    expect(() => validateCampaign(campaign)).toThrow(/Unknown post ID missing/);
  });

  it("rejects days outside campaign duration", () => {
    const campaign = sampleCampaign();
    campaign.calendar[0].day = 30;
    expect(() => validateCampaign(campaign)).toThrow(/Calendar day 30 exceeds duration/);
  });

  it("rejects duplicate post IDs", () => {
    const campaign = sampleCampaign();
    campaign.posts.push({ ...campaign.posts[0], caption: "Another draft with the same post ID." });
    expect(() => validateCampaign(campaign)).toThrow(/Duplicate post IDs/);
  });

  it("rejects unsupported channels in briefs, posts, calendars, and budgets", () => {
    const campaign = sampleCampaign();
    const invalidInputs = [
      { ...campaign, brief: { ...campaign.brief, channels: ["youtube"] } },
      { ...campaign, posts: [{ ...campaign.posts[0], channel: "youtube" }] },
      { ...campaign, calendar: [{ ...campaign.calendar[0], channel: "youtube" }] },
      { ...campaign, budget: [{ ...campaign.budget[0], channel: "youtube" }] },
    ];
    for (const input of invalidInputs) {
      expect(() => validateCampaign(input)).toThrow(/Invalid option/);
    }
  });

  it("rejects supported but unselected post channels", () => {
    const campaign = sampleCampaign();
    campaign.posts[0].channel = "email";
    expect(() => validateCampaign(campaign)).toThrow(/Post post-1: unselected channel/);
  });

  it("rejects a calendar channel that differs from its post", () => {
    const campaign = sampleCampaign();
    campaign.calendar[0].channel = "tiktok";
    expect(() => validateCampaign(campaign)).toThrow(/Channel mismatch for post-1/);
  });

  it("rejects duplicate budget channels even when the total is correct", () => {
    const campaign = sampleCampaign();
    campaign.budget[1].channel = "instagram";
    expect(() => validateCampaign(campaign)).toThrow(/Duplicate budget channel instagram/);
  });

  it("rejects supported but unselected budget channels", () => {
    const campaign = sampleCampaign();
    campaign.budget[0].channel = "email";
    expect(() => validateCampaign(campaign)).toThrow(/Budget uses unselected channel email/);
  });
});
