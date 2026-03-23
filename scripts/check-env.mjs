/**
 * Prebuild env-var validation.
 * Reads .env.example for the list of required vars and checks process.env.
 * Exits 1 if any required var is missing — fails the build before Next.js starts.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envExamplePath = resolve(__dirname, "..", ".env.example");

let lines;
try {
  lines = readFileSync(envExamplePath, "utf-8").split("\n");
} catch {
  console.warn("warn: .env.example not found — skipping env validation");
  process.exit(0);
}

// Parse required vars: non-comment, non-empty lines that don't start with "# Optional"
const required = [];
let optional = false;
for (const line of lines) {
  const trimmed = line.trim();
  if (/^#\s*optional/i.test(trimmed)) {
    optional = true;
    continue;
  }
  if (trimmed.startsWith("#") || trimmed === "") continue;
  const key = trimmed.split("=")[0];
  if (!optional) required.push(key);
}

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `\n❌  Build blocked — missing required environment variables:\n` +
      missing.map((v) => `   • ${v}`).join("\n") +
      `\n\nSet them on Vercel (Settings → Environment Variables) or in .env.local\n`
  );
  process.exit(1);
}

console.log("✓ All required env vars present");
