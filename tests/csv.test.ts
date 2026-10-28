import { describe, expect, it } from "vitest";
import { calendarCsv } from "../src/csv.js";
import { sampleCampaign } from "./fixtures/campaign.js";

describe("calendar CSV", () => {
  it("exports the header and calendar references using CRLF rows", () => {
    expect(calendarCsv(sampleCampaign())).toBe(
      '"day","channel","post_id","title","caption","cta"\r\n' +
      '"1","instagram","post-1","Matcha break","A fresh matcha latte for your study break.","Visit us"\r\n',
    );
  });

  it("escapes commas, quotes, and embedded line breaks without splitting cells", () => {
    const campaign = sampleCampaign();
    campaign.posts[0].title = 'Fresh, "matcha"';
    campaign.posts[0].caption = 'First line\nSecond "quoted" line\r\nThird, final line';
    campaign.posts[0].cta = 'Say "hello", today';
    expect(calendarCsv(campaign)).toBe(
      '"day","channel","post_id","title","caption","cta"\r\n' +
      '"1","instagram","post-1","Fresh, ""matcha""","First line\nSecond ""quoted"" line\r\nThird, final line","Say ""hello"", today"\r\n',
    );
  });

  it.each([
    "=SUM(1,2)", "+SUM(1,2)", "-1+2", "@SUM(1,2)",
    "  =1+1", "\t+1+1", "\r-1+1", "\n@SUM(1,2)", "\u00a0=1+1",
  ])("neutralizes spreadsheet formulas in every creative text column: %j", (text) => {
    const campaign = sampleCampaign();
    campaign.posts[0].title = text;
    campaign.posts[0].caption = text;
    campaign.posts[0].cta = text;
    expect(calendarCsv(campaign)).toBe(
      '"day","channel","post_id","title","caption","cta"\r\n' +
      `"1","instagram","post-1","'${text}","'${text}","'${text}"\r\n`,
    );
  });

  it("escapes quotes after adding the formula safety prefix", () => {
    const campaign = sampleCampaign();
    campaign.posts[0].title = '=HYPERLINK("https://example.com","click")';
    expect(calendarCsv(campaign)).toContain('"\'=HYPERLINK(""https://example.com"",""click"")"');
  });

  it("does not alter harmless internal operators or Vietnamese text", () => {
    const campaign = sampleCampaign();
    campaign.posts[0].title = "Trà matcha — Bean & Brew";
    campaign.posts[0].caption = "Email us at hello@example.com. Sweetness = your choice.";
    expect(calendarCsv(campaign)).toContain('"Trà matcha — Bean & Brew","Email us at hello@example.com. Sweetness = your choice."');
  });

  it("uses calendar order and day offsets, including repeated post references", () => {
    const campaign = sampleCampaign();
    campaign.calendar = [
      { day: 14, postId: "post-1", channel: "instagram" },
      { day: 2, postId: "post-1", channel: "instagram" },
    ];
    const rows = calendarCsv(campaign).split("\r\n");
    expect(rows[1]).toMatch(/^"14","instagram","post-1",/);
    expect(rows[2]).toMatch(/^"2","instagram","post-1",/);
    expect(rows).toHaveLength(4);
  });

  it("rejects missing referenced posts", () => {
    const campaign = sampleCampaign();
    campaign.calendar[0].postId = "missing";
    expect(() => calendarCsv(campaign)).toThrow("Missing post: missing");
  });

  it("does not mutate the campaign", () => {
    const campaign = sampleCampaign();
    const before = structuredClone(campaign);
    expect(calendarCsv(campaign)).toBe(calendarCsv(campaign));
    expect(campaign).toEqual(before);
  });
});
