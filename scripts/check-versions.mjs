import { readFile } from "node:fs/promises";

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const creatorPackage = JSON.parse(
  await readFile("packages/create-rootward/package.json", "utf8"),
);
const docsPackage = JSON.parse(await readFile("docs/package.json", "utf8"));
const book = await readFile(
  "docs/books/06-rootward-project-cli-contract/book.adoc",
  "utf8",
);

const version = rootPackage.version;
const mismatches = [
  ["packages/create-rootward/package.json", creatorPackage.version],
  ["docs/package.json", docsPackage.version],
].filter(([, candidate]) => candidate !== version);

if (!book.includes(`v${version}, 2026-05`)) {
  mismatches.push([
    "docs/books/06-rootward-project-cli-contract/book.adoc",
    "missing matching book version",
  ]);
}

if (mismatches.length > 0) {
  for (const [path, candidate] of mismatches) {
    console.error(`${path} version mismatch: ${candidate} !== ${version}`);
  }
  process.exit(1);
}
