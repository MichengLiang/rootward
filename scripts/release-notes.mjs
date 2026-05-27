import { readFile } from "node:fs/promises";

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/release-notes.mjs <version>");
  process.exit(2);
}

const changelog = await readFile("CHANGELOG.md", "utf8");
const heading = `## ${version}`;
const start = changelog.indexOf(heading);
if (start === -1) {
  console.error(`CHANGELOG.md does not contain ${heading}.`);
  process.exit(1);
}

const next = changelog.indexOf("\n## ", start + heading.length);
const section = changelog.slice(start, next === -1 ? undefined : next).trim();
process.stdout.write(`${section}\n`);
