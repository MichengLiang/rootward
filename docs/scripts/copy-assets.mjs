import { cp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function existsDir(dir) {
  try {
    const entries = await readdir(dir);
    return entries.length >= 0;
  } catch {
    return false;
  }
}

export async function assetCopyPlanForWorkspace(rootDir) {
  const plan = [];
  const sharedImages = path.join(rootDir, "shared", "images");
  if (await existsDir(sharedImages)) {
    plan.push({
      from: sharedImages,
      to: path.join(rootDir, "build", "html", "shared", "images")
    });
  }

  const booksDir = path.join(rootDir, "books");
  const entries = await readdir(booksDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const assetsDir = path.join(booksDir, entry.name, "assets");
    if (await existsDir(assetsDir)) {
      plan.push({
        from: assetsDir,
        to: path.join(rootDir, "build", "html", "books", entry.name, "assets")
      });
    }
  }

  return plan;
}

export async function copyAssetPlan(plan) {
  for (const entry of plan) {
    await rm(entry.to, { force: true, recursive: true });
    await cp(entry.from, entry.to, { recursive: true });
  }
}

async function main() {
  const rootDir = process.cwd();
  const plan = await assetCopyPlanForWorkspace(rootDir);
  await copyAssetPlan(plan);
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);

if (executedPath === modulePath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
