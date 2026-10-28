import { mkdir, mkdtemp, open, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_CAMPAIGN_BYTES } from "../src/limits.js";
import { campaignRoot, loadCampaign, saveCampaign } from "../src/storage.js";
import { saveRevision } from "../src/revisions.js";
import { sampleCampaign } from "./fixtures/campaign.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, open: vi.fn(actual.open), rename: vi.fn(actual.rename) };
});
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomUUID: vi.fn(actual.randomUUID) };
});
const realFs = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
const realCrypto = await vi.importActual<typeof import("node:crypto")>("node:crypto");

describe("storage containment, publication, and concurrency", () => {
  let workspace: string;
  let cwd: string;
  let outside: string;
  beforeEach(async () => {
    vi.mocked(open).mockImplementation(realFs.open);
    vi.mocked(rename).mockImplementation(realFs.rename);
    vi.mocked(randomUUID).mockImplementation(realCrypto.randomUUID);
    workspace = await mkdtemp(path.join(os.tmpdir(), "campaignpilot-audit-"));
    cwd = path.join(workspace, "project");
    outside = path.join(workspace, "outside");
    await mkdir(cwd);
    await mkdir(outside);
  });
  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("rejects a linked campaign root for both saving and loading", async () => {
    await symlink(outside, campaignRoot(cwd), "dir");
    await expect(saveCampaign(cwd, sampleCampaign())).rejects.toThrow(/symlinks/);
    await expect(loadCampaign(cwd, realCrypto.randomUUID())).rejects.toThrow(/symlinks/);
    expect(await readdir(outside)).toEqual([]);
  });

  it("rejects a linked campaign directory", async () => {
    const id = realCrypto.randomUUID();
    await mkdir(campaignRoot(cwd));
    await writeFile(path.join(outside, "campaign.json"), JSON.stringify(sampleCampaign()));
    await symlink(outside, path.join(campaignRoot(cwd), id), "dir");
    await expect(loadCampaign(cwd, id)).rejects.toThrow(/symlinks/);
  });

  it("rejects a linked JSON file without reading or changing its target", async () => {
    const id = realCrypto.randomUUID();
    const folder = path.join(campaignRoot(cwd), id);
    await mkdir(folder, { recursive: true });
    const json = JSON.stringify(sampleCampaign());
    const target = path.join(outside, "campaign.json");
    await writeFile(target, json);
    await symlink(target, path.join(folder, "campaign.json"));
    await expect(loadCampaign(cwd, id)).rejects.toThrow();
    expect(await readFile(target, "utf8")).toBe(json);
  });

  it("rejects non-regular JSON files", async () => {
    const id = realCrypto.randomUUID();
    await mkdir(path.join(campaignRoot(cwd), id, "campaign.json"), { recursive: true });
    await expect(loadCampaign(cwd, id)).rejects.toThrow(/regular file/);
  });

  it("rejects oversized stored JSON before parsing", async () => {
    const saved = await saveCampaign(cwd, sampleCampaign());
    await writeFile(path.join(saved.folder, "campaign.json"), " ".repeat(MAX_CAMPAIGN_BYTES + 1));
    await expect(loadCampaign(cwd, saved.id)).rejects.toThrow(/2 MiB/);
  });

  it("removes staging and reservations when an export write fails", async () => {
    vi.mocked(open).mockImplementation((...args) => {
      if (String(args[0]).endsWith("calendar.csv")) return Promise.reject(new Error("Simulated disk failure"));
      return realFs.open(...args);
    });
    await expect(saveCampaign(cwd, sampleCampaign())).rejects.toThrow("Simulated disk failure");
    expect(await readdir(campaignRoot(cwd))).toEqual([]);
  });

  it("does not publish a revision if its metadata cannot be written", async () => {
    const parent = await saveCampaign(cwd, sampleCampaign());
    const revised = sampleCampaign();
    revised.strategy.keyMessage = "A new matcha message";
    vi.mocked(open).mockImplementation((...args) => {
      if (String(args[0]).endsWith("revision.json")) return Promise.reject(new Error("Metadata write failed"));
      return realFs.open(...args);
    });
    await expect(saveRevision(cwd, parent.id, "strategy", revised, "Update message"))
      .rejects.toThrow("Metadata write failed");
    expect(await readdir(campaignRoot(cwd))).toEqual([parent.id]);
    expect(await loadCampaign(cwd, parent.id)).toEqual(sampleCampaign());
  });

  it("has every artifact ready before publishing a revision directory", async () => {
    const parent = await saveCampaign(cwd, sampleCampaign());
    vi.mocked(rename).mockImplementationOnce(async (source, destination) => {
      expect((await readdir(source)).sort()).toEqual(["calendar.csv", "campaign.json", "campaign.md", "revision.json"]);
      expect(await readdir(campaignRoot(cwd))).not.toContain(path.basename(String(destination)));
      await realFs.rename(source, destination);
    });
    const revised = sampleCampaign();
    revised.calendar[0].day = 2;
    await saveRevision(cwd, parent.id, "calendar", revised, "Reschedule");
  });

  it("cleans up after a failed publication rename", async () => {
    vi.mocked(rename).mockRejectedValueOnce(new Error("Rename failed"));
    await expect(saveCampaign(cwd, sampleCampaign())).rejects.toThrow("Rename failed");
    expect(await readdir(campaignRoot(cwd))).toEqual([]);
  });

  it("keeps concurrent saves separate and complete", async () => {
    const saves = await Promise.all(Array.from({ length: 12 }, () => saveCampaign(cwd, sampleCampaign())));
    expect(new Set(saves.map((save) => save.id)).size).toBe(12);
    expect((await readdir(campaignRoot(cwd))).sort()).toEqual(saves.map((save) => save.id).sort());
    for (const saved of saves) {
      expect((await readdir(saved.folder)).sort()).toEqual(["calendar.csv", "campaign.json", "campaign.md"]);
      expect(await loadCampaign(cwd, saved.id)).toEqual(sampleCampaign());
    }
  });

  it("never overwrites an existing campaign on an ID collision", async () => {
    const first = await saveCampaign(cwd, sampleCampaign());
    vi.mocked(randomUUID).mockReturnValue(first.id);
    const revised = sampleCampaign();
    revised.brief.brand = "Another Brand";
    await expect(saveCampaign(cwd, revised)).rejects.toThrow(/already exists/);
    expect(await loadCampaign(cwd, first.id)).toEqual(sampleCampaign());
    expect(await readdir(campaignRoot(cwd))).toEqual([first.id]);
  });

  it("allows only one concurrent writer to reserve the same ID", async () => {
    vi.mocked(randomUUID).mockReturnValue("12345678-1234-4123-8123-123456789abc");
    const results = await Promise.allSettled([saveCampaign(cwd, sampleCampaign()), saveCampaign(cwd, sampleCampaign())]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await readdir(campaignRoot(cwd))).toEqual(["12345678-1234-4123-8123-123456789abc"]);
  });
});
