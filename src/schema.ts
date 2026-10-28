import { z } from "zod";

export const Channel = z.enum(["instagram", "tiktok", "facebook", "email"]);

export const BriefSchema = z.object({
  brand: z.string().trim().min(2).max(100),
  product: z.string().trim().min(2).max(200),
  audience: z.string().trim().min(5).max(500),
  goal: z.enum(["awareness", "traffic", "leads", "sales"]),
  budgetVnd: z.number().int().positive().max(1_000_000_000),
  durationDays: z.number().int().min(1).max(90),
  channels: z.array(Channel).min(1).max(4).refine(
    (xs) => new Set(xs).size === xs.length,
    "Channels must be unique",
  ),
  differentiator: z.string().trim().min(3).max(500),
  voice: z.string().trim().min(2).max(150),
  constraints: z.array(z.string().max(300)).max(50).default([]),
});

export const PostSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,60}$/),
  channel: Channel,
  title: z.string().min(3).max(150),
  caption: z.string().min(10).max(3000),
  cta: z.string().min(2).max(200),
  hashtags: z.array(z.string().max(80)).max(15),
});

export const CampaignSchema = z.object({
  brief: BriefSchema,
  strategy: z.object({
    campaignName: z.string().min(3).max(120),
    positioning: z.string().min(10).max(1000),
    keyMessage: z.string().min(5).max(500),
    audienceInsight: z.string().min(10).max(1000),
  }),
  posts: z.array(PostSchema).min(1).max(100),
  calendar: z.array(z.object({
    day: z.number().int().min(1).max(90),
    postId: z.string().regex(/^[a-z0-9-]{1,60}$/),
    channel: Channel,
  })).min(1).max(200),
  budget: z.array(z.object({
    channel: Channel,
    amountVnd: z.number().int().nonnegative(),
    rationale: z.string().min(5).max(500),
  })).min(1).max(4),
  kpis: z.array(z.object({
    metric: z.string().min(2).max(120),
    target: z.string().min(1).max(120),
    measurement: z.string().min(3).max(400),
  })).min(1).max(15),
  assumptions: z.array(z.string().max(500)).max(100).default([]),
});

export type Brief = z.infer<typeof BriefSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
