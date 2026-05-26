import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { assetCopyPlanForWorkspace } from "../scripts/copy-assets.mjs";

test("assetCopyPlanForWorkspace plans shared images and each book asset directory", async () => {
  const root = path.join(tmpdir(), `multi-book-assets-${Date.now()}`);
  await mkdir(path.join(root, "shared", "images"), { recursive: true });
  await mkdir(path.join(root, "books", "01-foundations", "assets"), { recursive: true });
  await mkdir(path.join(root, "books", "02-practice", "assets"), { recursive: true });

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
        from: path.join("books", "01-foundations", "assets"),
        to: path.join("build", "html", "books", "01-foundations", "assets")
      },
      {
        from: path.join("books", "02-practice", "assets"),
        to: path.join("build", "html", "books", "02-practice", "assets")
      }
    ]
  );
});
