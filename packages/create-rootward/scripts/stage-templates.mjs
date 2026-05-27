import { cp, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..", "..");
const sourceRoot = resolve(repositoryRoot, "templates");
const targetRoot = resolve(packageRoot, "dist", "templates");

const excludedNames = new Set([
  "node_modules",
  "dist",
  "coverage",
  "temporary",
  "target",
  ".turbo",
]);

await rm(targetRoot, { recursive: true, force: true });
await cp(sourceRoot, targetRoot, {
  recursive: true,
  filter: (source) => {
    const name = source.split(/[\\/]/).at(-1) ?? "";
    return !excludedNames.has(name);
  },
});
