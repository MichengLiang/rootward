import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const defaultBookPath = "books/06-rootward-project-cli-contract/book.html";

export async function createIndexForSite(rootDir) {
  const htmlDir = path.join(rootDir, "build", "html");
  await writeFile(
    path.join(htmlDir, "index.html"),
    `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=${defaultBookPath}">
  <link rel="canonical" href="${defaultBookPath}">
  <title>Rootward 项目型 CLI 契约</title>
</head>
<body>
  <p><a href="${defaultBookPath}">Rootward 项目型 CLI 契约</a></p>
</body>
</html>
`
  );
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
