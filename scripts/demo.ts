import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sampleCampaign } from "../tests/fixtures/campaign.js";
import { campaignRoot, loadCampaign, saveCampaign } from "../src/storage.js";
import { saveRevision } from "../src/revisions.js";
import { reviewCampaign } from "../src/review.js";

// Deliberately offline: the same fictional fixture used by regression tests.
const workspace = await mkdtemp(path.join(os.tmpdir(), "campaignpilot-demo-"));
try {
  const campaign = sampleCampaign();
  const parent = await saveCampaign(workspace, campaign);
  const originalFiles = await Promise.all(["campaign.json", "campaign.md", "calendar.csv"].map(
    (name) => readFile(path.join(parent.folder, name), "utf8"),
  ));
  assert.deepEqual(await loadCampaign(workspace, parent.id), campaign);
  const review = reviewCampaign(campaign);
  assert.equal(review.score, 85);

  const bad = structuredClone(campaign);
  bad.budget[0].amountVnd = 1;
  await assert.rejects(saveCampaign(workspace, bad), /Budget sums/);
  assert.deepEqual(await readdir(campaignRoot(workspace)), [parent.id]);

  const revised = structuredClone(campaign);
  revised.calendar[0].day = 2;
  const revision = await saveRevision(workspace, parent.id, "calendar", revised, "Move the launch post to day two");
  assert.notEqual(revision.id, parent.id);
  assert.deepEqual(await loadCampaign(workspace, revision.id), revised);
  assert.deepEqual(await Promise.all(["campaign.json", "campaign.md", "calendar.csv"].map(
    (name) => readFile(path.join(parent.folder, name), "utf8"),
  )), originalFiles);
  assert.match(await readFile(path.join(revision.folder, "calendar.csv"), "utf8"), /"2","instagram"/);
  assert.equal(JSON.parse(await readFile(path.join(revision.folder, "revision.json"), "utf8")).parentId, parent.id);

  console.log("PASS: offline fictional fixture — no model request or API credentials used.");
  console.log("PASS: validated exports, load, budget rejection, review, and immutable revision.");
  console.log(JSON.stringify({
    workspace, parentId: parent.id, revisionId: revision.id,
    parentFolder: parent.folder, revisionFolder: revision.folder,
    review, diff: revision.summary,
    note: "Score is a heuristic. Temporary demo files are retained for inspection; no real project campaigns were changed.",
  }, null, 2));
} catch (error) {
  await rm(workspace, { recursive: true, force: true });
  throw error;
}
