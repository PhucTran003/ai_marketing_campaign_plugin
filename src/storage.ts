import { lstat, mkdir, mkdtemp, open, rename, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { validateCampaign } from "./checks.js";
import { renderMarkdown } from "./render.js";
import { calendarCsv } from "./csv.js";
import type { Campaign } from "./schema.js";
import type { RevisionMetadata } from "./revisions.js";
import { assertPayloadSize, MAX_CAMPAIGN_BYTES } from "./limits.js";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

async function assertDirectory(folder: string): Promise<void> {
  const stat = await lstat(folder);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("Campaign storage must use real directories; symlinks are not allowed");
  }
}

export function campaignRoot(cwd: string): string {
  return path.resolve(cwd, "campaigns");
}

// The optional metadata is supplied by saveRevision after its unchanged-field checks.
export async function saveCampaign(cwd: string, input: unknown, revision?: RevisionMetadata) {
  assertPayloadSize(input);
  const campaign = validateCampaign(input);
  const files: [string, string][] = [
    ["campaign.json", JSON.stringify(campaign, null, 2) + "\n"],
    ["campaign.md", renderMarkdown(campaign)],
    ["calendar.csv", calendarCsv(campaign)],
  ];
  if (revision) files.push(["revision.json", JSON.stringify(revision, null, 2) + "\n"]);
  if (Buffer.byteLength(files[0][1]) > MAX_CAMPAIGN_BYTES) {
    throw new Error("Formatted campaign JSON exceeds the 2 MiB storage limit");
  }
  const root = campaignRoot(cwd);
  try {
    await mkdir(root, { mode: 0o700 });
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error;
  }
  await assertDirectory(root);
  const id = randomUUID();
  const folder = path.join(root, id);
  const reservation = path.join(root, `.reserve-${id}`);
  // An exclusive reservation serializes even colliding IDs across cooperating processes.
  await mkdir(reservation, { mode: 0o700 });
  let staging: string | undefined;
  try {
    try {
      await lstat(folder);
      throw new Error("Campaign ID already exists; original files were not changed");
    } catch (error) {
      if (!hasCode(error, "ENOENT")) throw error;
    }
    staging = await mkdtemp(path.join(root, ".pending-"));
    for (const [name, text] of files) {
      const file = await open(path.join(staging, name), "wx", 0o600);
      try {
        await file.writeFile(text, "utf8");
        await file.sync();
      } finally {
        await file.close();
      }
    }
    await assertDirectory(root);
    await rename(staging, folder);
    staging = undefined;
    return { id, folder, campaign };
  } finally {
    try {
      if (staging) await rm(staging, { recursive: true, force: true });
    } finally {
      await rm(reservation, { recursive: true, force: true });
    }
  }
}

export async function loadCampaign(cwd: string, id: string): Promise<Campaign> {
  if (!ID_PATTERN.test(id)) throw new Error("Invalid campaign ID");
  const root = campaignRoot(cwd);
  await assertDirectory(root);
  const folder = path.join(root, id);
  await assertDirectory(folder);
  const filename = path.join(folder, "campaign.json");
  // NONBLOCK prevents a FIFO from hanging open before the regular-file check.
  const file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error("Campaign JSON must be a regular file");
    if (stat.size > MAX_CAMPAIGN_BYTES) throw new Error("Campaign JSON exceeds the 2 MiB storage limit");
    // Bound the read even if another process grows the file after stat().
    const buffer = Buffer.alloc(MAX_CAMPAIGN_BYTES + 1);
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await file.read(buffer, used, buffer.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used > MAX_CAMPAIGN_BYTES) throw new Error("Campaign JSON exceeds the 2 MiB storage limit");
    return validateCampaign(JSON.parse(buffer.subarray(0, used).toString("utf8")));
  } finally {
    await file.close();
  }
}
