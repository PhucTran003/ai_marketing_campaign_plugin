import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { campaignRoot, loadCampaign, saveCampaign } from "../src/storage.js";
import { sampleCampaign } from "./fixtures/campaign.js";

describe("campaign storage", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(path.join(os.tmpdir(), "campaignpilot-storage-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("saves JSON and Markdown under a generated ID and loads the persisted data", async () => {
    const campaign = sampleCampaign();
    const saved = await saveCampaign(cwd, campaign);
    expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(saved.folder).toBe(path.join(campaignRoot(cwd), saved.id));
    expect((await readdir(saved.folder)).sort()).toEqual(["campaign.json", "campaign.md"]);
    expect(JSON.parse(await readFile(path.join(saved.folder, "campaign.json"), "utf8"))).toEqual(campaign);
    const markdown = await readFile(path.join(saved.folder, "campaign.md"), "utf8");
    for (const heading of ["# Matcha Moments", "## Brief", "## Strategy", "## Content", "## Calendar", "## Budget", "## KPIs", "## Assumptions"]) {
      expect(markdown).toContain(heading);
    }
    campaign.brief.brand = "Changed after saving";
    expect((await loadCampaign(cwd, saved.id)).brief.brand).toBe("Bean & Brew");
  });

  it("uses different IDs for repeated saves and preserves the original files", async () => {
    const campaign = sampleCampaign();
    const first = await saveCampaign(cwd, campaign);
    const originalJson = await readFile(path.join(first.folder, "campaign.json"), "utf8");
    const originalMarkdown = await readFile(path.join(first.folder, "campaign.md"), "utf8");
    campaign.strategy.campaignName = "Another Matcha Campaign";
    const second = await saveCampaign(cwd, campaign);
    expect(second.id).not.toBe(first.id);
    expect((await readdir(campaignRoot(cwd))).sort()).toEqual([first.id, second.id].sort());
    expect(await readFile(path.join(first.folder, "campaign.json"), "utf8")).toBe(originalJson);
    expect(await readFile(path.join(first.folder, "campaign.md"), "utf8")).toBe(originalMarkdown);
    expect((await loadCampaign(cwd, second.id)).strategy.campaignName).toBe("Another Matcha Campaign");
  });

  it("does not create campaign files for invalid schema or budget data", async () => {
    const campaign = sampleCampaign();
    campaign.budget[0].amountVnd = 1;
    await expect(saveCampaign(cwd, campaign)).rejects.toThrow(/Budget sums/);
    await expect(saveCampaign(cwd, {})).rejects.toThrow();
    expect(await readdir(cwd)).toEqual([]);
  });

  it.each([
    "", "not-an-id", "..", "../outside", "/tmp/outside", "..\\outside",
    "12345678-1234-4123-8123-123456789abc/../../outside",
    "12345678-1234-4123-8123-123456789abc\\..\\outside",
    "12345678-1234-4123-8123-123456789abc%2f..%2foutside",
  ])("rejects invalid campaign ID paths before reading: %j", async (id) => {
    await expect(loadCampaign(cwd, id)).rejects.toThrow("Invalid campaign ID");
    expect(await readdir(cwd)).toEqual([]);
  });

  it("revalidates persisted campaign data when loading", async () => {
    const campaign = sampleCampaign();
    const saved = await saveCampaign(cwd, campaign);
    campaign.budget[0].amountVnd = 1;
    await writeFile(path.join(saved.folder, "campaign.json"), JSON.stringify(campaign));
    await expect(loadCampaign(cwd, saved.id)).rejects.toThrow(/Budget sums/);
  });
});
