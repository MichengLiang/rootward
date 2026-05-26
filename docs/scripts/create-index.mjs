import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function createIndexForSite(rootDir) {
  const htmlDir = path.join(rootDir, "build", "html");
  await copyFile(path.join(htmlDir, "catalog.html"), path.join(htmlDir, "index.html"));
}

async function main() {
  await createIndexForSite(process.cwd());
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);

if (executedPath === modulePath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
