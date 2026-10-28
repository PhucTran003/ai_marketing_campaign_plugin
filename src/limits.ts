export const MAX_CAMPAIGN_BYTES = 2 * 1024 * 1024;

export function assertPayloadSize(input: unknown): void {
  let json: string | undefined;
  try {
    json = JSON.stringify(input);
  } catch {
    throw new Error("Campaign input must be JSON-serializable");
  }
  if (json === undefined || Buffer.byteLength(json) > MAX_CAMPAIGN_BYTES) {
    throw new Error("Campaign input exceeds the 2 MiB limit or is not JSON-serializable");
  }
}
