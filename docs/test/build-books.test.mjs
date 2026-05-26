import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { buildPlanForWorkspace } from "../scripts/build-books.mjs";

test("buildPlanForWorkspace finds book.adoc entries and maps each to its own output directory", async () => {
  const root = path.resolve("tmp", "test-fixtures", `rootward-books-${randomUUID()}`);
  await mkdir(path.join(root, "books", "06-rootward-project-cli-contract"), { recursive: true });
  await mkdir(path.join(root, "books", "07-rootward-reference"), { recursive: true });
  await mkdir(path.join(root, "books", "notes-only"), { recursive: true });
  await writeFile(path.join(root, "books", "06-rootward-project-cli-contract", "book.adoc"), "= Rootward Contract\n");
  await writeFile(path.join(root, "books", "07-rootward-reference", "book.adoc"), "= Rootward Reference\n");

  const plan = await buildPlanForWorkspace(root);

  assert.deepEqual(
    plan.map((entry) => ({
      bookId: entry.bookId,
      input: path.relative(root, entry.input),
      outputDir: path.relative(root, entry.outputDir)
    })),
    [
      {
        bookId: "06-rootward-project-cli-contract",
        input: path.join("books", "06-rootward-project-cli-contract", "book.adoc"),
        outputDir: path.join("build", "html", "books", "06-rootward-project-cli-contract")
      },
      {
        bookId: "07-rootward-reference",
        input: path.join("books", "07-rootward-reference", "book.adoc"),
        outputDir: path.join("build", "html", "books", "07-rootward-reference")
      }
    ]
  );
});
