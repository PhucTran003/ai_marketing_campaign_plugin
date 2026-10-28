import type { Campaign } from "../../src/schema.js";

export function sampleCampaign(): Campaign {
  return {
    brief: {
      brand: "Bean & Brew", product: "Matcha latte",
      audience: "University students in Ho Chi Minh City", goal: "awareness",
      budgetVnd: 3000000, durationDays: 14, channels: ["instagram", "tiktok"],
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
    budget: [
      { channel: "instagram", amountVnd: 2000000, rationale: "Reach students with short visuals" },
      { channel: "tiktok", amountVnd: 1000000, rationale: "Test creator-style videos" },
    ],
    kpis: [{ metric: "Reach", target: "Proposed: 10000", measurement: "Platform analytics" }],
    assumptions: ["Budget allocation is a draft"],
  };
}
