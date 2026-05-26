import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCAL_TARGET_PATTERN = /\b(?:href|src)="([^"]+)"/g;
const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

async function existsFile(filePath) {
  try {
    const stats = await stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

export async function collectHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectHtmlFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

export function extractLocalTargets(html) {
  const targets = [];
  for (const match of html.matchAll(LOCAL_TARGET_PATTERN)) {
    const rawTarget = match[1];
    if (
      rawTarget === "" ||
      rawTarget.startsWith("#") ||
      rawTarget.startsWith("//") ||
      SCHEME_PATTERN.test(rawTarget)
    ) {
      continue;
    }

    const targetWithoutFragment = rawTarget.split("#", 1)[0].split("?", 1)[0];
    if (targetWithoutFragment !== "") {
      targets.push(rawTarget);
    }
  }

  return targets;
}

export async function findMissingLocalResources(rootDir) {
  const htmlFiles = await collectHtmlFiles(rootDir);
  const missing = [];

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, "utf8");
    for (const target of extractLocalTargets(html)) {
      const targetPath = target.split("#", 1)[0].split("?", 1)[0];
      const resolvedPath = path.resolve(path.dirname(htmlFile), targetPath);
      if (!await existsFile(resolvedPath)) {
        missing.push({ htmlFile, target, resolvedPath });
      }
    }
  }

  return missing;
}

async function main() {
  const rootDir = path.resolve(process.argv[2] ?? "build/html");
  const missing = await findMissingLocalResources(rootDir);
  if (missing.length === 0) return;

  for (const entry of missing) {
    console.error(`${path.relative(rootDir, entry.htmlFile)} -> ${entry.target}`);
  }
  throw new Error(`missing ${missing.length} local HTML resource(s)`);
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);

if (executedPath === modulePath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
