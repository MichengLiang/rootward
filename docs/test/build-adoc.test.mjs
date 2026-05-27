import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  adocBuildPlanForWorkspace,
  buildAdocForWorkspace
} from "../scripts/build-adoc.mjs";

test("adocBuildPlanForWorkspace maps the catalog and contract book to the adoc output tree", async () => {
  const root = path.resolve("tmp", "test-fixtures", `rootward-adoc-plan-${randomUUID()}`);
  const bookDir = path.join(root, "books", "06-rootward-project-cli-contract");
  await mkdir(bookDir, { recursive: true });
  await writeFile(path.join(root, "catalog.adoc"), "= Catalog\n");
  await writeFile(path.join(bookDir, "book.adoc"), "= Rootward Contract\n");

  const plan = await adocBuildPlanForWorkspace(root);

  assert.deepEqual(
    plan.map((entry) => ({
      kind: entry.kind,
      bookId: entry.bookId,
      input: path.relative(root, entry.input),
      output: path.relative(root, entry.output)
    })),
    [
      {
        kind: "catalog",
        bookId: null,
        input: "catalog.adoc",
        output: path.join("build", "adoc", "catalog.adoc")
      },
      {
        kind: "book",
        bookId: "06-rootward-project-cli-contract",
        input: path.join("books", "06-rootward-project-cli-contract", "book.adoc"),
        output: path.join("build", "adoc", "books", "06-rootward-project-cli-contract.adoc")
      }
    ]
  );
});

test("buildAdocForWorkspace expands the contract book and catalog into pure text files", async () => {
  const root = path.resolve("tmp", "test-fixtures", `rootward-adoc-build-${randomUUID()}`);
  const bookDir = path.join(root, "books", "06-rootward-project-cli-contract");
  await mkdir(path.join(bookDir, "frontmatter"), { recursive: true });
  await mkdir(path.join(root, "shared"), { recursive: true });
  await writeFile(path.join(root, "catalog.adoc"), "= Catalog\n\n* xref:books/06-rootward-project-cli-contract/book.adoc[Contract]\n");
  await writeFile(
    path.join(bookDir, "book.adoc"),
    [
      "= Rootward Contract",
      "",
      "include::../../shared/attributes.adoc[]",
      "",
      "include::frontmatter/preface.adoc[]"
    ].join("\n")
  );
  await writeFile(path.join(root, "shared", "attributes.adoc"), ":series-name: Rootward CLI Templates\n");
  await writeFile(path.join(bookDir, "frontmatter", "preface.adoc"), "== Preface\nHello reducer.\n");

  await buildAdocForWorkspace(root);

  const catalog = await readFile(path.join(root, "build", "adoc", "catalog.adoc"), "utf8");
  const contract = await readFile(path.join(root, "build", "adoc", "books", "06-rootward-project-cli-contract.adoc"), "utf8");
  assert.match(catalog, /xref:books\/06-rootward-project-cli-contract\/book\.adoc/);
  assert.match(contract, /:series-name: Rootward CLI Templates/);
  assert.match(contract, /Hello reducer\./);
  assert.doesNotMatch(`${catalog}\n${contract}`, /^[ \t]*include::/m);
});
