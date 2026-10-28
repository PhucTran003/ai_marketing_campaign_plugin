import { mkdir, writeFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { validateCampaign } from "./checks.js";
import { renderMarkdown } from "./render.js";
import { calendarCsv } from "./csv.js";
import type { Campaign } from "./schema.js";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

export function campaignRoot(cwd: string): string {
  return path.resolve(cwd, "campaigns");
}

export async function saveCampaign(cwd: string, input: unknown) {
  const campaign = validateCampaign(input);
  const id = randomUUID();
  const folder = path.join(campaignRoot(cwd), id);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "campaign.json"), JSON.stringify(campaign, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  await writeFile(path.join(folder, "campaign.md"), renderMarkdown(campaign), { encoding: "utf8", flag: "wx" });
  await writeFile(path.join(folder, "calendar.csv"), calendarCsv(campaign), { encoding: "utf8", flag: "wx" });
  return { id, folder, campaign };
}

export async function loadCampaign(cwd: string, id: string): Promise<Campaign> {
  if (!ID_PATTERN.test(id)) throw new Error("Invalid campaign ID");
  const filename = path.join(campaignRoot(cwd), id, "campaign.json");
  return validateCampaign(JSON.parse(await readFile(filename, "utf8")));
}
