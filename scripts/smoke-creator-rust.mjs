import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = resolve(repositoryRoot, "temporary", "smoke-creator-rust");
const generatedRoot = resolve(temporaryRoot, "rust-smoke");

async function run(command, args, cwd) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

await rm(temporaryRoot, { recursive: true, force: true });
await mkdir(temporaryRoot, { recursive: true });

try {
  await run(
    "node",
    [
      resolve(repositoryRoot, "packages", "create-rootward", "dist", "bin.mjs"),
      "rust",
      generatedRoot,
      "--cli-name",
      "rust-smoke",
      "--crate-name",
      "rust-smoke-core",
      "--bin-name",
      "rust-smoke",
      "--json",
    ],
    repositoryRoot,
  );
  await run("cargo", ["fmt", "--check"], generatedRoot);
  await run(
    "cargo",
    ["clippy", "--all-targets", "--all-features", "--", "-D", "warnings"],
    generatedRoot,
  );
  await run("cargo", ["test"], generatedRoot);
  await run("cargo", ["build"], generatedRoot);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
