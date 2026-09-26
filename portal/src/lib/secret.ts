import { createDecipheriv } from "node:crypto";

const PREFIX = "enc:v1:";

// Decrypt an "enc:v1:" value with DATAVERSE_SECRET_KEY; plain values pass through
export function reveal(value: string | undefined): string | undefined {
  if (!value || !value.startsWith(PREFIX)) return value;
  const key = Buffer.from(process.env.DATAVERSE_SECRET_KEY?.trim() ?? "", "base64");
  if (key.length !== 32) throw new Error("DATAVERSE_SECRET_KEY is missing or not a 32-byte base64 key");
  const [iv, tag, data] = value.slice(PREFIX.length).split(":").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
