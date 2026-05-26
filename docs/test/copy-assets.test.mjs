import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { assetCopyPlanForWorkspace } from "../scripts/copy-assets.mjs";

test("assetCopyPlanForWorkspace plans shared images and each book asset directory", async () => {
  const root = path.resolve("tmp", "test-fixtures", `rootward-book-assets-${randomUUID()}`);
  await mkdir(path.join(root, "shared", "images"), { recursive: true });
  await mkdir(path.join(root, "books", "06-rootward-project-cli-contract", "assets"), { recursive: true });
  await mkdir(path.join(root, "books", "07-rootward-reference", "assets"), { recursive: true });

  const plan = await assetCopyPlanForWorkspace(root);

  assert.deepEqual(
    plan.map((entry) => ({
      from: path.relative(root, entry.from),
      to: path.relative(root, entry.to)
    })),
    [
      {
        from: path.join("shared", "images"),
        to: path.join("build", "html", "shared", "images")
      },
      {
        from: path.join("books", "06-rootward-project-cli-contract", "assets"),
        to: path.join("build", "html", "books", "06-rootward-project-cli-contract", "assets")
      },
      {
        from: path.join("books", "07-rootward-reference", "assets"),
        to: path.join("build", "html", "books", "07-rootward-reference", "assets")
      }
    ]
  );
});
