import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export async function buildPlanForWorkspace(rootDir) {
  const booksDir = path.join(rootDir, "books");
  const entries = await readdir(booksDir, { withFileTypes: true });

  const plan = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const bookId = entry.name;
    const input = path.join(booksDir, bookId, "book.adoc");
    const outputDir = path.join(rootDir, "build", "html", "books", bookId);

    try {
      const inputStats = await stat(input);
      if (!inputStats.isFile()) continue;
      plan.push({ bookId, input, outputDir, cwd: path.dirname(input) });
    } catch {
      continue;
    }
  }

  return plan.sort((a, b) => a.bookId.localeCompare(b.bookId));
}

export function runAsciidoctorForBook(book) {
  const result = spawnSync(
    "asciidoctor",
    ["book.adoc", "-D", book.outputDir],
    {
      cwd: book.cwd,
      encoding: "utf8",
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    throw new Error(`asciidoctor failed for ${book.bookId}`);
  }
}

async function main() {
  const rootDir = process.cwd();
  const plan = await buildPlanForWorkspace(rootDir);
  for (const book of plan) {
    runAsciidoctorForBook(book);
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
