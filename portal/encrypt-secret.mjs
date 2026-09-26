import { createCipheriv, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// Usage: node encrypt-secret.mjs [envFile] [variable]
// Encrypts the variable in place with DATAVERSE_SECRET_KEY, creating a key if none is set
const file = process.argv[2] ?? ".env.local";
const name = process.argv[3] ?? "DATAVERSE_PASSWORD";

// Use the existing key or generate a new one
let keyText = process.env.DATAVERSE_SECRET_KEY?.trim();
const created = !keyText;
if (created) keyText = randomBytes(32).toString("base64");
const key = Buffer.from(keyText, "base64");
if (key.length !== 32) throw new Error("DATAVERSE_SECRET_KEY must be a 32-byte base64 key");

// Find the plain value in the env file
const lines = readFileSync(file, "utf8").split(/\r?\n/);
const index = lines.findIndex((l) => l.startsWith(`${name}=`));
if (index < 0) throw new Error(`${name} not found in ${file}`);
const plain = lines[index].slice(name.length + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
if (plain.startsWith("enc:v1:")) throw new Error(`${name} is already encrypted`);

// AES-256-GCM: enc:v1:<iv>:<tag>:<ciphertext>
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
const b64 = (b) => b.toString("base64");
lines[index] = `${name}=enc:v1:${b64(iv)}:${b64(cipher.getAuthTag())}:${b64(data)}`;
writeFileSync(file, lines.join("\n"));

console.log(`${name} in ${file} is now encrypted.`);
if (created) console.log(`New key (keep it out of the project, set it as DATAVERSE_SECRET_KEY):\n${keyText}`);
