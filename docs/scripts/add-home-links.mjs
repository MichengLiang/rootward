import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOME_MARKER = "data-multi-book-home";
const TOC_PATTERN = /<div id="toc" class="toc2">/;

function escapeHtmlAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function addHomeLinkToBookHtml(html, href) {
  if (html.includes(HOME_MARKER)) return html;

  const tocMatch = html.match(TOC_PATTERN);
  if (!tocMatch || tocMatch.index === undefined) {
    throw new Error("book HTML is missing the left TOC container");
  }

  const insertAt = tocMatch.index + tocMatch[0].length;
  const escapedHref = escapeHtmlAttribute(href);
  const homeBlock = `
<style>
.multi-book-home {
  margin: 0 0 1rem;
  padding-bottom: .75rem;
  border-bottom: 1px solid #e5e7eb;
}
.multi-book-home a {
  color: #1f2937;
  display: block;
  font-weight: 600;
  line-height: 1.35;
  text-decoration: none;
}
.multi-book-home a:hover {
  color: #0f766e;
  text-decoration: underline;
}
.multi-book-home span {
  color: #64748b;
  display: block;
  font-size: .78rem;
  font-weight: 400;
  margin-top: .15rem;
}
</style>
<div class="multi-book-home" ${HOME_MARKER}>
  <a href="${escapedHref}">← 书库首页<span>AsciiDoc 多本书工作区</span></a>
</div>`;

  return `${html.slice(0, insertAt)}${homeBlock}${html.slice(insertAt)}`;
}

export async function bookHtmlFiles(rootDir) {
  const booksDir = path.join(rootDir, "books");
  const entries = await readdir(booksDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    files.push(path.join(booksDir, entry.name, "book.html"));
  }

  return files.sort();
}

export async function addHomeLinksToWorkspace(rootDir) {
  const files = await bookHtmlFiles(rootDir);

  for (const file of files) {
    const html = await readFile(file, "utf8");
    const href = path.relative(path.dirname(file), path.join(rootDir, "catalog.html"));
    const updated = addHomeLinkToBookHtml(html, href);
    if (updated !== html) {
      await writeFile(file, updated);
    }
  }
}

async function main() {
  const rootDir = path.resolve(process.argv[2] ?? "build/html");
  await addHomeLinksToWorkspace(rootDir);
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);

if (executedPath === modulePath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
