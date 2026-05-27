import { createRequire } from "node:module";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Asciidoctor = require("asciidoctor")();
require("@asciidoctor/reducer").register();

const unresolvedIncludeDirective = /^[ \t]*include::/m;

async function existsFile(filePath) {
  try {
    const stats = await stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

export async function adocBuildPlanForWorkspace(rootDir) {
  const catalog = path.join(rootDir, "catalog.adoc");
  if (!await existsFile(catalog)) {
    throw new Error(`missing catalog.adoc in ${rootDir}`);
  }

  const plan = [
    {
      kind: "catalog",
      bookId: null,
      input: catalog,
      output: path.join(rootDir, "build", "adoc", "catalog.adoc")
    }
  ];

  const booksDir = path.join(rootDir, "books");
  const entries = await readdir(booksDir, { withFileTypes: true });
  const bookEntries = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const bookId = entry.name;
    const input = path.join(booksDir, bookId, "book.adoc");
    if (!await existsFile(input)) continue;

    bookEntries.push({
      kind: "book",
      bookId,
      input,
      output: path.join(rootDir, "build", "adoc", "books", `${bookId}.adoc`)
    });
  }

  if (bookEntries.length === 0) {
    throw new Error(`missing book.adoc entries in ${booksDir}`);
  }

  return plan.concat(bookEntries.sort((a, b) => a.bookId.localeCompare(b.bookId)));
}

export function reduceAdocSource(input) {
  const doc = Asciidoctor.loadFile(input, { safe: "unsafe" });
  return doc.getSource();
}

export async function writeReducedAdoc(input, output) {
  const reducedSource = reduceAdocSource(input);
  if (unresolvedIncludeDirective.test(reducedSource)) {
    throw new Error(`reducer left unresolved include directives in ${input}`);
  }

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, reducedSource, "utf8");
  return { output, reducedSource };
}

export async function buildAdocForWorkspace(rootDir) {
  const plan = await adocBuildPlanForWorkspace(rootDir);
  const results = [];
  for (const entry of plan) {
    const result = await writeReducedAdoc(entry.input, entry.output);
    results.push({ ...entry, ...result });
  }
  return results;
}

async function main() {
  const rootDir = process.cwd();
  const results = await buildAdocForWorkspace(rootDir);
  for (const result of results) {
    const relativeOutput = path.relative(rootDir, result.output);
    const lines = result.reducedSource.split("\n").length;
    console.log(`ADOC written: ${relativeOutput} (${lines} lines)`);
  }
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);

if (executedPath === modulePath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
