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

    for (const result of [missingCliName, missingPackageName, unknownOption]) {
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
