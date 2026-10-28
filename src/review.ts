import type { Campaign } from "./schema.js";

export type Finding = { severity: "warning" | "info"; message: string };

// A deterministic heuristic for a validated campaign, not a performance prediction.
export function reviewCampaign(c: Campaign): { score: number; findings: Finding[] } {
  const findings: Finding[] = [];
  let score = 100;
  if (c.posts.length < Math.min(3, c.brief.durationDays)) {
    score -= 15;
    findings.push({ severity: "warning", message: "Few posts relative to campaign length" });
  }
  if (!c.assumptions.length) {
    score -= 10;
    findings.push({ severity: "info", message: "Document assumptions and unverified facts" });
  }
  for (const post of c.posts) {
    if (post.cta.trim().length < 8) {
      score -= 5;
      findings.push({ severity: "warning", message: `${post.id} has a weak CTA` });
    }
  }
  if (c.kpis.some((k) => k.measurement.trim().length < 12)) {
    score -= 10;
    findings.push({ severity: "info", message: "Some KPIs need a measurement method" });
  }
  return { score: Math.max(0, score), findings };
}
