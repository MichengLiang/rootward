import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  extractLocalTargets,
  findMissingLocalResources
} from "../scripts/check-html-local-resources.mjs";

test("extractLocalTargets skips external links and keeps local resources", () => {
  const html = [
    '<a href="https://example.com">external</a>',
    '<a href="#local">anchor</a>',
    '<a href="../books/06-rootward-project-cli-contract/book.html#configuration-model">book</a>',
    '<img src="shared/images/rootward-map.svg">',
    '<script src="data:text/plain,ignore"></script>',
    '<a href="//example.com/path">scheme-relative</a>'
  ].join("\n");

  assert.deepEqual(extractLocalTargets(html), [
    "../books/06-rootward-project-cli-contract/book.html#configuration-model",
    "shared/images/rootward-map.svg"
  ]);
});

test("findMissingLocalResources reports only missing local files", async () => {
  const root = path.resolve("tmp", "test-fixtures", `html-check-${randomUUID()}`);
  const htmlDir = path.join(root, "build", "html");
  const imageDir = path.join(root, "build", "html", "shared", "images");
  await mkdir(imageDir, { recursive: true });
  await writeFile(path.join(imageDir, "rootward-map.svg"), "<svg></svg>");
  await writeFile(
    path.join(htmlDir, "index.html"),
    [
      '<a href="shared/images/rootward-map.svg">ok</a>',
      '<a href="books/06-rootward-project-cli-contract/book.html#configuration-model">missing book</a>'
    ].join("\n")
  );

  const missing = await findMissingLocalResources(htmlDir);

  assert.deepEqual(missing.map((entry) => ({
    target: entry.target,
    resolvedPath: path.relative(root, entry.resolvedPath)
  })), [
    {
      target: "books/06-rootward-project-cli-contract/book.html#configuration-model",
      resolvedPath: path.join("build", "html", "books", "06-rootward-project-cli-contract", "book.html")
    }
  ]);
});
