import { execFile } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { runCreator } from "../src/index";

const execFileAsync = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "..", "..");
const templatesRoot = join(repositoryRoot, "templates");
const packageLocalTemplatesRoot = join(packageRoot, "templates");
const packagedTemplatesRoot = join(packageRoot, "dist", "templates");
const stageTemplatesScript = join(
  packageRoot,
  "scripts",
  "stage-templates.mjs",
);
const fixtureParent = join(packageRoot, "temporary");
const fixtureRoot = join(fixtureParent, "test-fixtures");
const createdTargets = new Set<string>();

async function makeFixtureDir() {
  await mkdir(fixtureRoot, { recursive: true });
  const root = await mkdtemp(join(fixtureRoot, "target-"));
  createdTargets.add(root);
  return root;
}

async function makeParentDir() {
  await mkdir(fixtureRoot, { recursive: true });
  const root = await mkdtemp(join(fixtureRoot, "parent-"));
  createdTargets.add(root);
  return root;
}

function parseJson(text: string) {
  return JSON.parse(text) as unknown;
}

async function cleanupTargets() {
  await Promise.all(
    Array.from(createdTargets, (target) =>
      rm(target, { recursive: true, force: true }),
    ),
  );
  createdTargets.clear();
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readAllTextFiles(root: string) {
  const texts: string[] = [];

  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      try {
        texts.push(await readFile(fullPath, "utf8"));
      } catch {
        // Binary files do not participate in manifest-token residue checks.
      }
    }
  }

  await walk(root);
  return texts;
}

async function run(args: string[], cwd: string) {
  return runCreator(args, { cwd, templatesRoot });
}

afterEach(async () => {
  await cleanupTargets();
});

afterAll(async () => {
  await rm(fixtureParent, { recursive: true, force: true });
});

describe("create-rootward", () => {
  it("keeps templates as a repository source instead of a package-local source", async () => {
    await expect(
      readFile(join(templatesRoot, "typescript", "manifest.json"), "utf8"),
    ).resolves.toContain('"id": "typescript"');
    expect(await exists(packageLocalTemplatesRoot)).toBe(false);
  });

  it("stages packaged template assets into dist from the repository source", async () => {
    await rm(packagedTemplatesRoot, { recursive: true, force: true });

    await execFileAsync(process.execPath, [stageTemplatesScript], {
      cwd: packageRoot,
    });

    const sourceEntries = await readdir(templatesRoot);
    const packagedEntries = await readdir(packagedTemplatesRoot);
    expect(packagedEntries.sort()).toEqual(sourceEntries.sort());
    await expect(
      readFile(
        join(packagedTemplatesRoot, "typescript", "manifest.json"),
        "utf8",
      ),
    ).resolves.toBe(
      await readFile(
        join(templatesRoot, "typescript", "manifest.json"),
        "utf8",
      ),
    );
  });

  it("creates a TypeScript template with replaced identity and no token residue", async () => {
    const parent = await makeParentDir();

    const result = await run(
      [
        "typescript",
        "my-tool",
        "--cli-name",
        "my-tool",
        "--package-name",
        "@example/my-tool",
        "--json",
      ],
      parent,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(parseJson(result.stdout)).toMatchObject({
      ok: true,
      data: {
        template: "typescript",
        identity: {
          cliName: "my-tool",
          configDirName: ".my-tool",
          packageName: "@example/my-tool",
        },
      },
    });

    const target = join(parent, "my-tool");
    const packageJson = JSON.parse(
      await readFile(join(target, "package.json"), "utf8"),
    ) as {
      name: string;
      bin: Record<string, string>;
    };
    const constants = await readFile(
      join(target, "src", "core", "constants.ts"),
      "utf8",
    );
    const readme = await readFile(join(target, "README.md"), "utf8");
    const workspace = await readFile(
      join(target, "pnpm-workspace.yaml"),
      "utf8",
    );

    expect(packageJson.name).toBe("@example/my-tool");
    expect(packageJson.bin).toEqual({ "my-tool": "./dist/bin.mjs" });
    expect(constants).toContain('export const cliName = "my-tool";');
    expect(constants).toContain('export const configDirName = ".my-tool";');
    expect(readme).toContain("# my-tool");
    expect(workspace).toContain('  - "."');
    expect(constants).not.toContain("__ROOTWARD_");
    expect(readme).not.toContain("__ROOTWARD_");
  });

  it("creates a Rust template with replaced identity and no manifest-token residue", async () => {
    const parent = await makeParentDir();

    const result = await run(
      [
        "rust",
        "rust-tool",
        "--cli-name",
        "rust-tool",
        "--crate-name",
        "rust-tool-core",
        "--bin-name",
        "rust-tool-bin",
        "--json",
      ],
      parent,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(parseJson(result.stdout)).toMatchObject({
      ok: true,
      data: {
        template: "rust",
        identity: {
          cliName: "rust-tool",
          configDirName: ".rust-tool",
          crateName: "rust-tool-core",
          binName: "rust-tool-bin",
        },
      },
    });

    const target = join(parent, "rust-tool");
    const cargoToml = await readFile(join(target, "Cargo.toml"), "utf8");
    const constants = await readFile(
      join(target, "src", "core", "constants.rs"),
      "utf8",
    );
    const readme = await readFile(join(target, "README.md"), "utf8");
    const manifest = JSON.parse(
      await readFile(join(templatesRoot, "rust", "manifest.json"), "utf8"),
    ) as { tokens: Record<string, string> };
    const generatedTexts = await readAllTextFiles(target);

    expect(cargoToml).toContain('name = "rust-tool-core"');
    expect(cargoToml).toContain('name = "rust_tool_core"');
    expect(cargoToml).toContain('name = "rust-tool-bin"');
    expect(constants).toContain('pub const CLI_NAME: &str = "rust-tool";');
    expect(constants).toContain(
      'pub const CONFIG_DIR_NAME: &str = ".rust-tool";',
    );
    expect(readme).toContain("# rust-tool");
    expect(readme).toContain(".rust-tool/config.toml");
    expect(readme).toContain("rust-tool-bin init");
    await expect(
      readFile(join(target, "src", "main.rs"), "utf8"),
    ).resolves.toContain("rust_tool_core::run_cli");
    for (const token of Object.keys(manifest.tokens)) {
      expect(generatedTexts.some((text) => text.includes(token))).toBe(false);
    }
  });

  it("rejects non-empty targets", async () => {
    const target = await makeFixtureDir();
    await writeFile(join(target, "existing.txt"), "content\n");

    const result = await run(
      [
        "typescript",
        target,
        "--cli-name",
        "my-tool",
        "--package-name",
        "my-tool",
        "--json",
      ],
      packageRoot,
    );

    expect(result.exitCode).toBe(3);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim().startsWith("{")).toBe(true);
    expect(parseJson(result.stderr)).toMatchObject({
      ok: false,
      error: { code: "TARGET_NOT_EMPTY" },
    });
  });

  it("rejects symlink targets because they do not form a stable write boundary", async () => {
    const parent = await makeParentDir();
    const linkedDirectory = await makeParentDir();
    const target = join(parent, "linked-target");
    await symlink(linkedDirectory, target, "dir");

    const result = await run(
      [
        "typescript",
        target,
        "--cli-name",
        "linked-tool",
        "--package-name",
        "linked-tool",
        "--json",
      ],
      parent,
    );

    expect(result.exitCode).toBe(3);
    expect(result.stdout).toBe("");
    expect(parseJson(result.stderr)).toMatchObject({
      ok: false,
      error: { code: "TARGET_INVALID" },
    });
  });

  it("allows absolute target directories outside the creator cwd", async () => {
    const cwd = await makeParentDir();
    const targetParent = await makeParentDir();
    const target = join(targetParent, "absolute-tool");

    const result = await run(
      [
        "typescript",
        target,
        "--cli-name",
        "absolute-tool",
        "--package-name",
        "absolute-tool",
        "--json",
      ],
      cwd,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(parseJson(result.stdout)).toMatchObject({
      ok: true,
      data: {
        targetDir: target,
      },
    });
    await expect(
      readFile(join(target, "package.json"), "utf8"),
    ).resolves.toContain('"name": "absolute-tool"');
  });

  it("rejects unknown and reserved templates", async () => {
    const parent = await makeParentDir();

    const unknown = await run(
      ["unknown", "target", "--cli-name", "tool", "--json"],
      parent,
    );
    const reserved = await run(
      ["python", "target", "--cli-name", "tool", "--json"],
      parent,
    );

    expect(unknown.exitCode).toBe(4);
    expect(parseJson(unknown.stderr)).toMatchObject({
      ok: false,
      error: { code: "TEMPLATE_NOT_FOUND" },
    });
    expect(reserved.exitCode).toBe(4);
    expect(parseJson(reserved.stderr)).toMatchObject({
      ok: false,
      error: { code: "TEMPLATE_NOT_IMPLEMENTED" },
    });
  });

  it("rejects manifests with prefix-overlapping identity tokens", async () => {
    const parent = await makeParentDir();
    const templates = join(parent, "templates");
    const template = join(templates, "bad", "template");
    await mkdir(template, { recursive: true });
    await writeFile(join(template, "README.md"), "bad\n");
    await writeFile(
      join(templates, "bad", "manifest.json"),
      JSON.stringify(
        {
          id: "bad",
          language: "bad",
          status: "implemented",
          templateRoot: "template",
          identity: {
            cliName: { required: true, pattern: "^[a-z][a-z0-9-]*$" },
          },
          tokens: {
            "rootward-token": "cliName",
            "rootward-token-cli-name": "cliName",
          },
          exclude: [],
          postcheck: ["README.md"],
          nextCommands: [],
        },
        null,
        2,
      ),
    );

    const result = await runCreator(
      ["bad", "target", "--cli-name", "bad-tool", "--json"],
      { cwd: parent, templatesRoot: templates },
    );

    expect(result.exitCode).toBe(4);
    expect(result.stdout).toBe("");
    expect(parseJson(result.stderr)).toMatchObject({
      ok: false,
      error: { code: "TEMPLATE_INVALID" },
    });
  });

  it("rejects manifests whose tokens reference unknown identity slots", async () => {
    const parent = await makeParentDir();
    const templates = join(parent, "templates");
    const template = join(templates, "bad", "template");
    await mkdir(template, { recursive: true });
    await writeFile(join(template, "README.md"), "rootward-token-cli-name\n");
    await writeFile(
      join(templates, "bad", "manifest.json"),
      JSON.stringify(
        {
          id: "bad",
          language: "bad",
          status: "implemented",
          templateRoot: "template",
          identity: {
            cliName: { required: true, pattern: "^[a-z][a-z0-9-]*$" },
          },
          tokens: {
            "rootward-token-cli-name": "missingIdentity",
          },
          exclude: [],
          postcheck: ["README.md"],
          nextCommands: [],
        },
        null,
        2,
      ),
    );

    const result = await runCreator(
      ["bad", "target", "--cli-name", "bad-tool", "--json"],
      { cwd: parent, templatesRoot: templates },
    );

    expect(result.exitCode).toBe(4);
    expect(result.stdout).toBe("");
    expect(parseJson(result.stderr)).toMatchObject({
      ok: false,
      error: { code: "TEMPLATE_INVALID" },
    });
  });

  it("rejects manifests whose derived identity sources are not declared", async () => {
    const parent = await makeParentDir();
    const templates = join(parent, "templates");
    const template = join(templates, "bad", "template");
    await mkdir(template, { recursive: true });
    await writeFile(join(template, "README.md"), "rootward-token-cli-name\n");
    await writeFile(
      join(templates, "bad", "manifest.json"),
      JSON.stringify(
        {
          id: "bad",
          language: "bad",
          status: "implemented",
          templateRoot: "template",
          identity: {
            cliName: { required: true, pattern: "^[a-z][a-z0-9-]*$" },
            configDirName: { derivedFrom: "missingIdentity" },
          },
          tokens: {
            "rootward-token-cli-name": "cliName",
          },
          exclude: [],
          postcheck: ["README.md"],
          nextCommands: [],
        },
        null,
        2,
      ),
    );

    const result = await runCreator(
      ["bad", "target", "--cli-name", "bad-tool", "--json"],
      { cwd: parent, templatesRoot: templates },
    );

    expect(result.exitCode).toBe(4);
    expect(result.stdout).toBe("");
    expect(parseJson(result.stderr)).toMatchObject({
      ok: false,
      error: { code: "TEMPLATE_INVALID" },
    });
  });

  it("maps usage errors to stable JSON without parser text", async () => {
    const parent = await makeParentDir();

    const missingCliName = await run(
      ["typescript", "target", "--package-name", "pkg", "--json"],
      parent,
    );
    const missingPackageName = await run(
      ["typescript", "target", "--cli-name", "tool", "--json"],
      parent,
    );
    const unknownOption = await run(
      ["typescript", "target", "--cli-name", "tool", "--bad", "--json"],
      parent,
    );
    const missingCrateName = await run(
      ["rust", "target", "--cli-name", "tool", "--bin-name", "tool", "--json"],
      parent,
    );
    const missingBinName = await run(
      [
        "rust",
        "target",
        "--cli-name",
        "tool",
        "--crate-name",
        "tool",
        "--json",
      ],
      parent,
    );
    const reservedRustCrateModule = await run(
      [
        "rust",
        "target",
        "--cli-name",
        "tool",
        "--crate-name",
        "type",
        "--bin-name",
        "tool",
        "--json",
      ],
      parent,
    );

    for (const result of [
      missingCliName,
      missingPackageName,
      unknownOption,
      missingCrateName,
      missingBinName,
      reservedRustCrateModule,
    ]) {
      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe("");
      expect(result.stderr.trim().startsWith("{")).toBe(true);
      expect(parseJson(result.stderr)).toMatchObject({
        ok: false,
        error: { code: "USAGE_ERROR" },
      });
    }
  });
});
