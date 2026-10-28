import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { saveRevision, SectionSchema, type Section } from "../src/revisions.js";
import type { Campaign } from "../src/schema.js";
import { campaignRoot, loadCampaign, saveCampaign } from "../src/storage.js";
import { sampleCampaign } from "./fixtures/campaign.js";

function changeSection(campaign: Campaign, section: Section) {
  switch (section) {
    case "strategy": campaign.strategy.keyMessage = "Make time for a matcha break"; break;
    case "posts": campaign.posts[0].caption = "Take a fresh matcha break after your next class."; break;
    case "calendar": campaign.calendar[0].day = 2; break;
    case "budget":
      campaign.budget[0].amountVnd -= 100000;
      campaign.budget[1].amountVnd += 100000;
      break;
    case "kpis": campaign.kpis[0].target = "Proposed: 12000"; break;
  }
}

describe("immutable campaign revisions", () => {
  let cwd: string;
  let parentId: string;
  let parentFolder: string;

  beforeEach(async () => {
    cwd = await mkdtemp(path.join(os.tmpdir(), "campaignpilot-revisions-"));
    const saved = await saveCampaign(cwd, sampleCampaign());
    parentId = saved.id;
    parentFolder = saved.folder;
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it.each(SectionSchema.options)("revises %s without altering original files or unrelated data", async (section) => {
    const originalJson = await readFile(path.join(parentFolder, "campaign.json"), "utf8");
    const originalMarkdown = await readFile(path.join(parentFolder, "campaign.md"), "utf8");
    const revised = sampleCampaign();
    changeSection(revised, section);
    const saved = await saveRevision(cwd, parentId, section, revised, "  Requested update  ");
    expect(saved.id).not.toBe(parentId);
    expect(await loadCampaign(cwd, saved.id)).toEqual(revised);
    expect(saved.metadata).toEqual({ parentId, section, reason: "Requested update", createdAt: expect.any(String) });
    expect(Number.isNaN(Date.parse(saved.metadata.createdAt))).toBe(false);
    expect(JSON.parse(await readFile(path.join(saved.folder, "revision.json"), "utf8"))).toEqual(saved.metadata);
    expect(saved.summary).toContain(section);
    expect(saved.summary).toContain("→");
    expect(await readFile(path.join(parentFolder, "campaign.json"), "utf8")).toBe(originalJson);
    expect(await readFile(path.join(parentFolder, "campaign.md"), "utf8")).toBe(originalMarkdown);
    expect((await readdir(parentFolder)).sort()).toEqual(["campaign.json", "campaign.md"]);
  });

  it("rejects changing the brief before creating a revision directory", async () => {
    const revised = sampleCampaign();
    revised.brief.brand = "Another Brand";
    await expect(saveRevision(cwd, parentId, "strategy", revised, "New brand")).rejects.toThrow(/Brief cannot change/);
    expect(await readdir(campaignRoot(cwd))).toEqual([parentId]);
    expect(await loadCampaign(cwd, parentId)).toEqual(sampleCampaign());
  });

  it.each(SectionSchema.options)("rejects every unrelated section when revising %s", async (section) => {
    for (const other of SectionSchema.options.filter((key) => key !== section)) {
      const revised = sampleCampaign();
      changeSection(revised, section);
      changeSection(revised, other);
      await expect(saveRevision(cwd, parentId, section, revised, "Unrelated edit"))
        .rejects.toThrow(`Unexpected change to ${other}`);
    }
    expect(await readdir(campaignRoot(cwd))).toEqual([parentId]);
    expect(await loadCampaign(cwd, parentId)).toEqual(sampleCampaign());
  });

  it("preserves assumptions outside the editable sections", async () => {
    const revised = sampleCampaign();
    revised.assumptions = [];
    await expect(saveRevision(cwd, parentId, "strategy", revised, "Remove warnings"))
      .rejects.toThrow(/Unexpected change to assumptions/);
    expect(await readdir(campaignRoot(cwd))).toEqual([parentId]);
  });

  it("rejects post revisions that remove a calendar-referenced ID", async () => {
    const revised = sampleCampaign();
    revised.posts[0].id = "new-id";
    await expect(saveRevision(cwd, parentId, "posts", revised, "Rename post"))
      .rejects.toThrow(/Unknown post ID post-1/);
    expect(await readdir(campaignRoot(cwd))).toEqual([parentId]);
  });

  it("rejects post revisions that change a calendar-referenced channel", async () => {
    const revised = sampleCampaign();
    revised.posts[0].channel = "tiktok";
    await expect(saveRevision(cwd, parentId, "posts", revised, "Change platform"))
      .rejects.toThrow(/Channel mismatch for post-1/);
    expect(await readdir(campaignRoot(cwd))).toEqual([parentId]);
  });

  it("validates revised budget totals before writing", async () => {
    const revised = sampleCampaign();
    revised.budget[0].amountVnd = 1;
    await expect(saveRevision(cwd, parentId, "budget", revised, "Overspend"))
      .rejects.toThrow(/Budget sums/);
    expect(await readdir(campaignRoot(cwd))).toEqual([parentId]);
  });

  it.each(["../outside", "/tmp/outside"])("rejects an unsafe parent ID: %s", async (id) => {
    await expect(saveRevision(cwd, id, "strategy", sampleCampaign(), "Update"))
      .rejects.toThrow("Invalid campaign ID");
    expect(await readdir(campaignRoot(cwd))).toEqual([parentId]);
  });

  it("requires a nonempty revision reason", async () => {
    await expect(saveRevision(cwd, parentId, "strategy", sampleCampaign(), "   ")).rejects.toThrow();
    expect(await readdir(campaignRoot(cwd))).toEqual([parentId]);
  });

  it("can revise a revision while preserving its campaign and metadata", async () => {
    const firstCampaign = sampleCampaign();
    changeSection(firstCampaign, "strategy");
    const first = await saveRevision(cwd, parentId, "strategy", firstCampaign, "First revision");
    const originals = await Promise.all(["campaign.json", "campaign.md", "revision.json"].map(
      (filename) => readFile(path.join(first.folder, filename), "utf8"),
    ));
    const nextCampaign = structuredClone(firstCampaign);
    changeSection(nextCampaign, "calendar");
    const next = await saveRevision(cwd, first.id, "calendar", nextCampaign, "Reschedule");
    expect(next.id).not.toBe(first.id);
    expect(next.metadata.parentId).toBe(first.id);
    expect(await loadCampaign(cwd, next.id)).toEqual(nextCampaign);
    expect(await Promise.all(["campaign.json", "campaign.md", "revision.json"].map(
      (filename) => readFile(path.join(first.folder, filename), "utf8"),
    ))).toEqual(originals);
    expect(await loadCampaign(cwd, parentId)).toEqual(sampleCampaign());
  });

  it("bounds the review diff while retaining an indication of omitted edits", async () => {
    const revised = sampleCampaign();
    revised.posts[0].caption = "Updated caption. ".repeat(100);
    revised.posts.push(...Array.from({ length: 12 }, (_, i) => ({
      ...revised.posts[0], id: `new-${i}`,
    })));
    const saved = await saveRevision(cwd, parentId, "posts", revised, "Add creative variations");
    expect(saved.summary).toContain("posts[0].caption");
    expect(saved.summary).toContain("more changed fields");
    expect(saved.summary.length).toBeLessThan(4000);
  });
});
