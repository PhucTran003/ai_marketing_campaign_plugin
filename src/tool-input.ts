import { Type } from "@sinclair/typebox";
import { z } from "zod";
import { CampaignSchema } from "./schema.js";
import { RevisionInfoSchema } from "./revisions.js";
import { assertPayloadSize } from "./limits.js";

// Generate model guidance from the same schema used for runtime validation.
// Keep external data unknown until validation; no campaign type is asserted here.
export const SaveInput = Type.Object({
  campaign: Type.Unsafe<unknown>({
    ...z.toJSONSchema(CampaignSchema, { io: "input" }),
    description: "A complete campaign JSON object, not a JSON-encoded string",
  }),
});

const SaveEnvelope = z.object({ campaign: z.unknown() });

export function prepareSaveArguments(input: unknown): { campaign: unknown } {
  assertPayloadSize(input);
  const params = SaveEnvelope.parse(input);
  let campaign: unknown = params.campaign;
  if (typeof campaign === "string") {
    try {
      campaign = JSON.parse(campaign);
    } catch {
      throw new Error("campaign must be an object or valid JSON encoding an object. Fix the JSON and retry.");
    }
  }
  if (typeof campaign !== "object" || campaign === null || Array.isArray(campaign)) {
    throw new Error("campaign must be a JSON object. Pass { campaign: { brief, strategy, posts, calendar, budget, kpis, assumptions } }.");
  }
  return { campaign };
}

export const LoadInput = Type.Object({
  id: Type.String({ description: "The generated campaign ID; never a filesystem path" }),
});

export const ReviseInput = Type.Object({
  parentId: Type.String({ description: "The existing campaign ID to revise; never a filesystem path" }),
  section: Type.Unsafe<z.infer<typeof RevisionInfoSchema>["section"]>(
    z.toJSONSchema(RevisionInfoSchema.shape.section),
  ),
  reason: Type.String({ minLength: 1, maxLength: 1000, description: "Why the user requested this revision" }),
  campaign: SaveInput.properties.campaign,
});

export function prepareRevisionArguments(input: unknown) {
  const info = RevisionInfoSchema.parse(input);
  return { ...info, ...prepareSaveArguments(input) };
}
