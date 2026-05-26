import assert from "node:assert/strict";
import { test } from "node:test";

import { addHomeLinkToBookHtml } from "../scripts/add-home-links.mjs";

test("addHomeLinkToBookHtml inserts the catalog link before the TOC title", () => {
  const html = [
    '<body class="book toc2 toc-left">',
    '<div id="toc" class="toc2">',
    '<div id="toctitle">Table of Contents</div>',
    "</div>",
    "</body>"
  ].join("\n");

  const updated = addHomeLinkToBookHtml(html, "../../catalog.html");

  assert.match(updated, /data-rootward-doc-home/);
  assert.match(updated, /href="\.\.\/\.\.\/catalog\.html"/);
  assert.match(updated, /Rootward 文档首页/);
  assert.match(updated, /Rootward 契约书库/);
  assert.ok(
    updated.indexOf("data-rootward-doc-home") < updated.indexOf('<div id="toctitle">'),
    "home link should appear before the TOC title"
  );
});

test("addHomeLinkToBookHtml is idempotent", () => {
  const html = [
    '<body class="book toc2 toc-left">',
    '<div id="toc" class="toc2">',
    '<div id="toctitle">Table of Contents</div>',
    "</div>",
    "</body>"
  ].join("\n");

  const once = addHomeLinkToBookHtml(html, "../../catalog.html");
  const twice = addHomeLinkToBookHtml(once, "../../catalog.html");

  assert.equal(twice.match(/data-rootward-doc-home/g).length, 1);
});

test("addHomeLinkToBookHtml fails when the TOC container is missing", () => {
  assert.throws(
    () => addHomeLinkToBookHtml("<body></body>", "../../catalog.html"),
    /TOC container/
  );
});
