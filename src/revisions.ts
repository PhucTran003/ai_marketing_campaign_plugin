import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { validateCampaign } from "./checks.js";
import { loadCampaign, saveCampaign } from "./storage.js";
import { assertPayloadSize } from "./limits.js";

export const SectionSchema = z.enum(["strategy", "posts", "calendar", "budget", "kpis"]);
export type Section = z.infer<typeof SectionSchema>;
export const RevisionInfoSchema = z.object({
  parentId: z.string(),
  section: SectionSchema,
  reason: z.string().trim().min(1).max(1000),
});
export type RevisionMetadata = z.infer<typeof RevisionInfoSchema> & { createdAt: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function excerpt(value: unknown): string {
  const text = JSON.stringify(value) ?? "(absent)";
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

// Report actual changed fields, even when an edit is near the end of a long section.
function summarizeChanges(before: unknown, after: unknown, section: Section): string {
  const lines: string[] = [];
  let count = 0;
  function visit(left: unknown, right: unknown, location: string): void {
    if (isDeepStrictEqual(left, right)) return;
    if (Array.isArray(left) && Array.isArray(right)) {
      for (let i = 0; i < Math.max(left.length, right.length); i++) {
        visit(left[i], right[i], `${location}[${i}]`);
      }
    } else if (isRecord(left) && isRecord(right)) {
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        visit(left[key], right[key], `${location}.${key}`);
      }
    } else {
      count++;
      if (lines.length < 8) lines.push(`${location}: ${excerpt(left)} → ${excerpt(right)}`);
    }
  }
  visit(before, after, section);
  if (count > lines.length) lines.push(`… ${count - lines.length} more changed fields; review the saved files.`);
  return lines.length ? lines.join("\n") : "No changes to the selected section.";
}

export async function saveRevision(
  cwd: string, parentId: string, section: Section, input: unknown, reason: string,
) {
  assertPayloadSize(input);
  const info = RevisionInfoSchema.parse({ parentId, section, reason });
  const before = await loadCampaign(cwd, info.parentId);
  const after = validateCampaign(input);
  if (!isDeepStrictEqual(before.brief, after.brief)) {
    throw new Error("Brief cannot change during section regeneration");
  }
  if (!isDeepStrictEqual(before.assumptions, after.assumptions)) {
    throw new Error("Unexpected change to assumptions; preserve review notes during section regeneration");
  }
  for (const key of SectionSchema.options) {
    if (key !== info.section && !isDeepStrictEqual(before[key], after[key])) {
      throw new Error(`Unexpected change to ${key}; regenerate it explicitly`);
    }
  }
  const summary = summarizeChanges(before[info.section], after[info.section], info.section);
  const metadata = { ...info, createdAt: new Date().toISOString() };
  const saved = await saveCampaign(cwd, after, metadata);
  return { ...saved, metadata, summary };
}
