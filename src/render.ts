import type { Campaign } from "./schema.js";

export function renderMarkdown(c: Campaign): string {
  const lines: string[] = [
    `# ${c.strategy.campaignName}`,
    "", "## Brief",
    `- Brand: ${c.brief.brand}`,
    `- Product: ${c.brief.product}`,
    `- Audience: ${c.brief.audience}`,
    `- Goal: ${c.brief.goal}`,
    `- Duration: ${c.brief.durationDays} days`,
    `- Budget: ${c.brief.budgetVnd.toLocaleString("en-US")} VND`,
    "", "## Strategy",
    `**Positioning:** ${c.strategy.positioning}`,
    `**Key message:** ${c.strategy.keyMessage}`,
    `**Audience insight:** ${c.strategy.audienceInsight}`,
    "", "## Content",
  ];
  for (const post of c.posts) {
    lines.push("", `### ${post.id}: ${post.title} (${post.channel})`,
      post.caption, `**CTA:** ${post.cta}`,
      `**Hashtags:** ${post.hashtags.join(" ")}`);
  }
  lines.push("", "## Calendar", "", "| Day | Channel | Post ID |", "|---|---|---|");
  for (const item of c.calendar) lines.push(`| ${item.day} | ${item.channel} | ${item.postId} |`);
  lines.push("", "## Budget", "", "| Channel | VND | Rationale |", "|---|---:|---|");
  for (const b of c.budget) lines.push(`| ${b.channel} | ${b.amountVnd} | ${b.rationale.replaceAll("|", "\\|")} |`);
  lines.push("", "## KPIs");
  for (const k of c.kpis) lines.push(`- **${k.metric}** — proposed target: ${k.target}; measurement: ${k.measurement}`);
  lines.push("", "## Assumptions / items for human review");
  for (const a of c.assumptions) lines.push(`- ${a}`);
  lines.push("", "> Draft only. Validate all factual claims, prices, budget recommendations, and legal requirements before publishing.", "");
  return lines.join("\n");
}
