import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..", "..");
const packageLocalTemplates = resolve(packageRoot, "templates");
const rustTemplateRoot = resolve(
  repositoryRoot,
  "templates",
  "rust",
  "template",
);
const rustGitignore = await readFile(
  resolve(rustTemplateRoot, ".gitignore"),
  "utf8",
);
for (const pattern of ["/target/", "/temporary/"]) {
  if (!rustGitignore.split(/\r?\n/).includes(pattern)) {
    console.error(
      `templates/rust/template/.gitignore must include ${pattern}.`,
    );
    process.exit(1);
  }
}

try {
  await access(packageLocalTemplates);
} catch {
  process.exit(0);
}

console.error(
  "packages/create-rootward/templates is not a valid source path. Use repository templates/ and generated dist/templates.",
);
process.exit(1);
