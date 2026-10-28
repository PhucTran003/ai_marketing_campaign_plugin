import { truncateHead } from "@earendil-works/pi-coding-agent";
import { campaignRoot, loadCampaign } from "./storage.js";
import path from "node:path";

export async function loadCampaignPreview(cwd: string, id: string) {
  const campaign = await loadCampaign(cwd, id);
  const preview = truncateHead(JSON.stringify(campaign, null, 2), { maxBytes: 20_000, maxLines: 500 });
  const filename = path.join(campaignRoot(cwd), id, "campaign.json");
  return {
    text: preview.truncated
      ? `${preview.content}\n\n[Truncated campaign preview. Full validated campaign: ${filename}. Read the full file before revising; do not reconstruct missing fields.]`
      : preview.content,
    truncated: preview.truncated,
    filename,
  };
}
