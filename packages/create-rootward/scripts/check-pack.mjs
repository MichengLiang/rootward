import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = join(packageRoot, "temporary");
const packDir = join(temporaryRoot, "pack-check");

await rm(packDir, { recursive: true, force: true });
await mkdir(packDir, { recursive: true });

try {
  const { stdout } = await execFileAsync(
    "pnpm",
    ["pack", "--pack-destination", packDir],
    { cwd: packageRoot },
  );

  const tarballName = stdout.trim().split(/\r?\n/).at(-1);
  if (!tarballName) {
    throw new Error("pnpm pack did not report a tarball path.");
  }

  const tarballPath = resolve(packageRoot, tarballName);
  const { stdout: listingText } = await execFileAsync("tar", [
    "-tf",
    tarballPath,
  ]);
  const entries = listingText.trim().split(/\r?\n/);

  const requiredEntries = [
    "package/LICENSE",
    "package/README.md",
    "package/package.json",
    "package/dist/bin.mjs",
    "package/dist/index.mjs",
    "package/dist/templates/typescript/manifest.json",
    "package/dist/templates/typescript/template/package.json",
    "package/dist/templates/rust/manifest.json",
    "package/dist/templates/rust/template/Cargo.toml",
    "package/dist/templates/rust/template/src/main.rs",
    "package/dist/templates/rust/template/src/core/constants.rs",
    "package/dist/templates/rust/template/tests/cli_contract.rs",
  ];

  for (const entry of requiredEntries) {
    if (!entries.includes(entry)) {
      throw new Error(`Package tarball is missing ${entry}.`);
    }
  }

  const forbiddenPrefixes = [
    "package/templates/",
    "package/temporary/",
    "package/node_modules/",
    "package/coverage/",
    "package/dist/templates/rust/template/target/",
  ];

  const forbiddenSegments = ["/target/"];

  for (const entry of entries) {
    if (
      forbiddenPrefixes.some((prefix) => entry.startsWith(prefix)) ||
      forbiddenSegments.some((segment) => entry.includes(segment))
    ) {
      throw new Error(`Package tarball contains forbidden entry ${entry}.`);
    }
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
