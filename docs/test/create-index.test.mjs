import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { createIndexForSite, defaultBookPath } from "../scripts/create-index.mjs";

test("createIndexForSite points index.html at the current contract book", async () => {
  const root = path.resolve("tmp", "test-fixtures", `rootward-index-${randomUUID()}`);
  await mkdir(path.join(root, "build", "html"), { recursive: true });
  await writeFile(path.join(root, "build", "html", "catalog.html"), "<h1>Catalog</h1>\n");

  await createIndexForSite(root);

  const indexHtml = await readFile(path.join(root, "build", "html", "index.html"), "utf8");
  assert.match(indexHtml, new RegExp(`url=${defaultBookPath}`));
  assert.match(indexHtml, new RegExp(`href="${defaultBookPath}"`));
});
