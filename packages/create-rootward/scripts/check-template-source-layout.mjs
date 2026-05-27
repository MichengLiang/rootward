import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageLocalTemplates = resolve(packageRoot, "templates");

try {
  await access(packageLocalTemplates);
} catch {
  process.exit(0);
}

console.error(
  "packages/create-rootward/templates is not a valid source path. Use repository templates/ and generated dist/templates.",
);
process.exit(1);
