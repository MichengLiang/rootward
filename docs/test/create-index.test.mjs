import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createIndexForSite } from "../scripts/create-index.mjs";

test("createIndexForSite copies catalog.html to index.html", async () => {
  const root = path.join(tmpdir(), `rootward-index-${Date.now()}`);
  await mkdir(path.join(root, "build", "html"), { recursive: true });
  await writeFile(path.join(root, "build", "html", "catalog.html"), "<h1>Catalog</h1>\n");

  await createIndexForSite(root);

  assert.equal(
    await readFile(path.join(root, "build", "html", "index.html"), "utf8"),
    "<h1>Catalog</h1>\n"
  );
});
