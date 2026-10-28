import { describe, expect, it } from "vitest";
import { reviewCampaign } from "../src/review.js";
import { sampleCampaign } from "./fixtures/campaign.js";

function strongCampaign() {
  const campaign = sampleCampaign();
  campaign.posts = Array.from({ length: 3 }, (_, i) => ({
    ...campaign.posts[0], id: `post-${i + 1}`, cta: "Visit our store",
  }));
  return campaign;
}

describe("deterministic campaign review", () => {
  it("gives 100 with no findings when no heuristics are triggered", () => {
    expect(reviewCampaign(strongCampaign())).toEqual({ score: 100, findings: [] });
  });

  it("deducts 15 for too few posts", () => {
    const campaign = strongCampaign();
    campaign.posts = campaign.posts.slice(0, 2);
    expect(reviewCampaign(campaign)).toEqual({
      score: 85, findings: [{ severity: "warning", message: "Few posts relative to campaign length" }],
    });
  });

  it.each([1, 2, 3])("uses the campaign length as the post threshold for %i days", (durationDays) => {
    const campaign = strongCampaign();
    campaign.brief.durationDays = durationDays;
    campaign.posts = campaign.posts.slice(0, durationDays);
    expect(reviewCampaign(campaign)).toEqual({ score: 100, findings: [] });
  });

  it("deducts 10 for missing assumptions", () => {
    const campaign = strongCampaign();
    campaign.assumptions = [];
    expect(reviewCampaign(campaign)).toEqual({
      score: 90, findings: [{ severity: "info", message: "Document assumptions and unverified facts" }],
    });
  });

  it("deducts 5 for each weak CTA after trimming whitespace", () => {
    const campaign = strongCampaign();
    campaign.posts[0].cta = "  Go now  ";
    campaign.posts[1].cta = "Visit us"; // Eight characters meets the threshold.
    campaign.posts[2].cta = "Buy";
    expect(reviewCampaign(campaign)).toEqual({
      score: 90,
      findings: [
        { severity: "warning", message: "post-1 has a weak CTA" },
        { severity: "warning", message: "post-3 has a weak CTA" },
      ],
    });
  });

  it("deducts 10 once for multiple short KPI measurement methods", () => {
    const campaign = strongCampaign();
    campaign.kpis = [
      { metric: "Reach", target: "Estimate: 10000", measurement: "  Analytics  " },
      { metric: "Clicks", target: "Estimate: 200", measurement: "Counter" },
    ];
    expect(reviewCampaign(campaign)).toEqual({
      score: 90, findings: [{ severity: "info", message: "Some KPIs need a measurement method" }],
    });
  });

  it("accepts a measurement method at the 12-character threshold", () => {
    const campaign = strongCampaign();
    campaign.kpis[0].measurement = "012345678901";
    expect(reviewCampaign(campaign).score).toBe(100);
  });

  it("combines penalties and keeps scores at zero or above", () => {
    const campaign = sampleCampaign();
    campaign.posts[0].cta = "Go";
    campaign.assumptions = [];
    campaign.kpis[0].measurement = "App";
    expect(reviewCampaign(campaign).score).toBe(60);
    campaign.posts = Array.from({ length: 30 }, (_, i) => ({ ...campaign.posts[0], id: `post-${i}` }));
    const result = reviewCampaign(campaign);
    expect(result.score).toBe(0);
    expect(result.findings).toHaveLength(32);
  });

  it("is repeatable and does not modify its input", () => {
    const campaign = sampleCampaign();
    const before = structuredClone(campaign);
    expect(reviewCampaign(campaign)).toEqual(reviewCampaign(campaign));
    expect(campaign).toEqual(before);
  });
});
