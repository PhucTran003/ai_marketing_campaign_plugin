import { CampaignSchema, type Campaign } from "./schema.js";

export function validateCampaign(input: unknown): Campaign {
  const campaign = CampaignSchema.parse(input);
  const { brief, posts, calendar, budget } = campaign;
  const errors: string[] = [];

  const postMap = new Map(posts.map((post) => [post.id, post]));
  if (postMap.size !== posts.length) errors.push("Duplicate post IDs");

  const channels = new Set(brief.channels);
  for (const post of posts) {
    if (!channels.has(post.channel)) errors.push(`Post ${post.id}: unselected channel`);
  }
  for (const entry of calendar) {
    if (entry.day > brief.durationDays) errors.push(`Calendar day ${entry.day} exceeds duration`);
    const post = postMap.get(entry.postId);
    if (!post) errors.push(`Unknown post ID ${entry.postId}`);
    else if (post.channel !== entry.channel) errors.push(`Channel mismatch for ${entry.postId}`);
  }
  const seen = new Set<string>();
  for (const item of budget) {
    if (!channels.has(item.channel)) errors.push(`Budget uses unselected channel ${item.channel}`);
    if (seen.has(item.channel)) errors.push(`Duplicate budget channel ${item.channel}`);
    seen.add(item.channel);
  }
  const allocated = budget.reduce((sum, item) => sum + item.amountVnd, 0);
  if (allocated !== brief.budgetVnd) {
    errors.push(`Budget sums to ${allocated}, expected ${brief.budgetVnd}`);
  }
  if (errors.length) throw new Error(`Campaign validation failed:\n- ${errors.join("\n- ")}`);
  return campaign;
}
