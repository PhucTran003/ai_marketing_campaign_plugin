import type { Campaign } from "./schema.js";

function cell(value: string | number): string {
  let text = String(value);
  // Quote CSV syntax and neutralize spreadsheet formulas, including after whitespace.
  if (/^\s*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function calendarCsv(c: Campaign): string {
  const posts = new Map(c.posts.map((post) => [post.id, post]));
  const rows = [["day", "channel", "post_id", "title", "caption", "cta"]];
  for (const item of c.calendar) {
    const post = posts.get(item.postId);
    if (!post) throw new Error(`Missing post: ${item.postId}`);
    rows.push([String(item.day), item.channel, item.postId, post.title, post.caption, post.cta]);
  }
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
