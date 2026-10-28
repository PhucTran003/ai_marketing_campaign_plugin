import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateToolArguments } from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { loadCampaignPreview } from "../src/load-preview.js";
import { saveCampaign } from "../src/storage.js";
import { LoadInput, ReviseInput, prepareRevisionArguments } from "../src/tool-input.js";
import { sampleCampaign } from "./fixtures/campaign.js";

describe("V1 tool inputs", () => {
  it("preserves revision metadata while decoding a JSON-string campaign", () => {
    const campaign = sampleCampaign();
    const info = { parentId: "12345678-1234-4123-8123-123456789abc", section: "posts", reason: "Improve captions" };
    const params = prepareRevisionArguments({ ...info, campaign: JSON.stringify(campaign) });
    expect(params).toEqual({ ...info, campaign });
    expect(validateToolArguments(
      { name: "campaign_revise", description: "Revise campaign", parameters: ReviseInput },
      { type: "toolCall", id: "test", name: "campaign_revise", arguments: z.record(z.string(), z.json()).parse(params) },
    )).toEqual(params);
  });

  it("supports native campaign objects", () => {
    const campaign = sampleCampaign();
    expect(prepareRevisionArguments({ parentId: "id", section: "strategy", reason: "Update", campaign }).campaign)
      .toBe(campaign);
  });

  it.each(["brief", "assumptions", "../outside"])("rejects an uneditable section: %s", (section) => {
    expect(() => prepareRevisionArguments({ parentId: "id", section, reason: "Update", campaign: sampleCampaign() }))
      .toThrow();
  });

  it("exposes IDs and campaign data rather than filesystem path parameters", () => {
    expect(Object.keys(LoadInput.properties)).toEqual(["id"]);
    expect(Object.keys(ReviseInput.properties).sort()).toEqual(["campaign", "parentId", "reason", "section"]);
  });
});

describe("campaign load previews", () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await mkdtemp(path.join(os.tmpdir(), "campaignpilot-preview-"));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("returns complete validated JSON for a small campaign", async () => {
    const campaign = sampleCampaign();
    const saved = await saveCampaign(cwd, campaign);
    const result = await loadCampaignPreview(cwd, saved.id);
    expect(result.truncated).toBe(false);
    expect(JSON.parse(result.text)).toEqual(campaign);
  });

  it("bounds a large preview and preserves the complete file on disk", async () => {
    const campaign = sampleCampaign();
    campaign.posts = Array.from({ length: 100 }, (_, i) => ({
      ...campaign.posts[0], id: `post-${i + 1}`, caption: "Fresh matcha for a study break. ".repeat(90),
    }));
    const saved = await saveCampaign(cwd, campaign);
    const result = await loadCampaignPreview(cwd, saved.id);
    expect(result.truncated).toBe(true);
    expect(result.text).toContain("Truncated campaign preview");
    expect(result.text).toContain("Read the full file before revising");
    expect(Buffer.byteLength(result.text)).toBeLessThan(21_000);
    expect(JSON.parse(await readFile(result.filename, "utf8"))).toEqual(campaign);
  });

  it("rejects path traversal IDs", async () => {
    await expect(loadCampaignPreview(cwd, "../outside")).rejects.toThrow("Invalid campaign ID");
  });
});
