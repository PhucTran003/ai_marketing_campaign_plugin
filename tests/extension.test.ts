import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverAndLoadExtensions } from "@earendil-works/pi-coding-agent";
import { validateToolArguments } from "@earendil-works/pi-ai";
import { expect, it } from "vitest";
import { sampleCampaign } from "./fixtures/campaign.js";

it("loads the real Pi extension and validates its four registered tool contracts", async () => {
  const agentDir = await mkdtemp(path.join(os.tmpdir(), "campaignpilot-extension-"));
  try {
    const extensionPath = path.resolve(".pi/extensions/campaignpilot.ts");
    const result = await discoverAndLoadExtensions([extensionPath], process.cwd(), agentDir);
    expect(result.errors).toEqual([]);
    const extension = result.extensions.find((entry) => entry.resolvedPath === extensionPath);
    if (!extension) throw new Error("CampaignPilot did not load");
    expect([...extension.commands.keys()]).toEqual(["campaign"]);
    expect([...extension.tools.keys()].sort()).toEqual(["campaign_load", "campaign_review", "campaign_revise", "campaign_save"]);
    const validId = "12345678-1234-4123-8123-123456789abc";
    for (const name of ["campaign_load", "campaign_review"]) {
      const registered = extension.tools.get(name);
      if (!registered) throw new Error(`Missing ${name}`);
      const tool = registered.definition;
      expect(validateToolArguments(tool, { type: "toolCall", id: "test", name, arguments: { id: validId } }))
        .toEqual({ id: validId });
    }
    const save = extension.tools.get("campaign_save")?.definition;
    const revise = extension.tools.get("campaign_revise")?.definition;
    if (!save?.prepareArguments || !revise?.prepareArguments) throw new Error("Missing campaign compatibility hooks");
    const campaign = sampleCampaign();
    expect(save.prepareArguments({ campaign: JSON.stringify(campaign) })).toEqual({ campaign });
    expect(revise.prepareArguments({ parentId: validId, section: "posts", reason: "Shorter captions", campaign: JSON.stringify(campaign) }))
      .toEqual({ parentId: validId, section: "posts", reason: "Shorter captions", campaign });
  } finally {
    await rm(agentDir, { recursive: true, force: true });
  }
});
