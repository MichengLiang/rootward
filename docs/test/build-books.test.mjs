import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { buildPlanForWorkspace } from "../scripts/build-books.mjs";

test("buildPlanForWorkspace finds book.adoc entries and maps each to its own output directory", async () => {
  const root = path.join(tmpdir(), `multi-book-${Date.now()}`);
  await mkdir(path.join(root, "books", "01-foundations"), { recursive: true });
  await mkdir(path.join(root, "books", "02-practice"), { recursive: true });
  await mkdir(path.join(root, "books", "notes-only"), { recursive: true });
  await writeFile(path.join(root, "books", "01-foundations", "book.adoc"), "= Foundations\n");
  await writeFile(path.join(root, "books", "02-practice", "book.adoc"), "= Practice\n");

  const plan = await buildPlanForWorkspace(root);

  assert.deepEqual(
    plan.map((entry) => ({
      bookId: entry.bookId,
      input: path.relative(root, entry.input),
      outputDir: path.relative(root, entry.outputDir)
    })),
    [
      {
        bookId: "01-foundations",
        input: path.join("books", "01-foundations", "book.adoc"),
        outputDir: path.join("build", "html", "books", "01-foundations")
      },
      {
        bookId: "02-practice",
        input: path.join("books", "02-practice", "book.adoc"),
        outputDir: path.join("build", "html", "books", "02-practice")
      }
    ]
  );
});
