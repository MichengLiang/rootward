import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = resolve(repositoryRoot, "templates", "rust", "template");

const commands = [
  ["cargo", ["fmt", "--check"]],
  ["cargo", ["clippy", "--all-targets", "--all-features", "--", "-D", "warnings"]],
  ["cargo", ["test"]],
  ["cargo", ["build"]],
];

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

for (const [command, args] of commands) {
  await run(command, args, templateRoot);
}
