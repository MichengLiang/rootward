import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { configDirName } from "./core/constants";
import { defaultConfigToml, runCli } from "./index";

const templateRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureParent = join(templateRoot, "temporary");
const fixtureRoot = join(fixtureParent, "test-fixtures");
const packageJsonPath = join(templateRoot, "package.json");
const createdProjects = new Set<string>();

async function makeTempProject() {
  await mkdir(fixtureRoot, { recursive: true });
  const root = await mkdtemp(join(fixtureRoot, "project-"));
  createdProjects.add(root);
  return root;
}

async function createProject(files: Record<string, string> = {}) {
  const root = await makeTempProject();
  const init = await runCli(["init"], { cwd: root });
  expect(init.exitCode).toBe(0);

  for (const [path, content] of Object.entries(files)) {
    const absolutePath = join(root, path);
    await mkdir(join(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, content);
  }

  return root;
}

async function writeConfig(root: string, config: string) {
  await mkdir(join(root, configDirName), { recursive: true });
  await writeFile(join(root, configDirName, "config.toml"), config);
}

function parseJson(stdout: string) {
  return JSON.parse(stdout) as unknown;
}

async function cleanupProjects() {
  await Promise.all(
    Array.from(createdProjects, (project) =>
      rm(project, { recursive: true, force: true }),
    ),
  );
  createdProjects.clear();
}

afterEach(async () => {
  await cleanupProjects();
});

afterAll(async () => {
  await rm(fixtureParent, { recursive: true, force: true });
});

describe("__ROOTWARD_CLI_NAME__ project template", () => {
  it("runs the real CLI entry in development mode", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.dev).toBe("tsx src/bin.ts");
  });

  it("creates and cleans temporary projects inside the template tmp directory", async () => {
    const root = await makeTempProject();
    const marker = join(root, "marker.txt");
    await writeFile(marker, "fixture\n");

    expect(root.startsWith(`${fixtureRoot}/`)).toBe(true);
    await cleanupProjects();
    await expect(readFile(marker, "utf8")).rejects.toThrow();
  });

  it("initializes a project context with config, cache, and state directories", async () => {
    const root = await makeTempProject();

    const result = await runCli(["init"], { cwd: root });

    expect(result).toMatchObject({ exitCode: 0, stderr: "" });
    await expect(
      readFile(join(root, configDirName, "config.toml"), "utf8"),
    ).resolves.toBe(defaultConfigToml);
    await expect(
      readFile(join(root, configDirName, "cache", ".gitignore"), "utf8"),
    ).resolves.toBe("*\n!.gitignore\n");
    await expect(
      readFile(join(root, configDirName, "state", ".gitignore"), "utf8"),
    ).resolves.toBe("*\n!.gitignore\n");
  });

  it("rejects repeated init unless --force is passed", async () => {
    const root = await createProject();
    await writeFile(
      join(root, configDirName, "config.toml"),
      "broken = true\n",
    );

    const rejected = await runCli(["init", "--json"], { cwd: root });
    const forced = await runCli(["init", "--force"], { cwd: root });

    expect(rejected.exitCode).toBe(3);
    expect(parseJson(rejected.stderr)).toMatchObject({
      ok: false,
      error: { code: "PROJECT_ALREADY_INITIALIZED" },
    });
    expect(forced.exitCode).toBe(0);
    await expect(
      readFile(join(root, configDirName, "config.toml"), "utf8"),
    ).resolves.toBe(defaultConfigToml);
  });

  it("rejects init targets that do not exist or are not directories", async () => {
    const root = await makeTempProject();
    const fileTarget = join(root, "target.txt");
    await writeFile(fileTarget, "not a directory\n");

    const missing = await runCli(["init", join(root, "missing"), "--json"], {
      cwd: root,
    });
    const notDirectory = await runCli(["init", fileTarget, "--json"], {
      cwd: root,
    });

    expect(missing.exitCode).toBe(3);
    expect(parseJson(missing.stderr)).toMatchObject({
      ok: false,
      error: { code: "INIT_TARGET_INVALID" },
    });
    expect(notDirectory.exitCode).toBe(3);
    expect(parseJson(notDirectory.stderr)).toMatchObject({
      ok: false,
      error: { code: "INIT_TARGET_INVALID" },
    });
  });

  it("locates projects from the root, child directories, and explicit --project", async () => {
    const root = await createProject();
    const child = join(root, "docs", "nested");
    await mkdir(child, { recursive: true });
    const other = await makeTempProject();

    const fromRoot = await runCli(["status", "--json"], { cwd: root });
    const fromChild = await runCli(["status", "--json"], { cwd: child });
    const explicit = await runCli(["status", "--project", root, "--json"], {
      cwd: other,
    });

    expect(parseJson(fromRoot.stdout)).toMatchObject({
      ok: true,
      data: { projectRoot: root, discoveryMode: "cwd-upward", sourceCount: 2 },
    });
    expect(parseJson(fromChild.stdout)).toMatchObject({
      ok: true,
      data: { projectRoot: root, discoveryMode: "cwd-upward" },
    });
    expect(parseJson(explicit.stdout)).toMatchObject({
      ok: true,
      data: { projectRoot: root, discoveryMode: "explicit" },
    });
  });

  it("returns stable project discovery errors", async () => {
    const root = await makeTempProject();
    const wrongProject = join(root, "wrong");
    await mkdir(wrongProject);

    const upward = await runCli(["status", "--json"], { cwd: root });
    const explicit = await runCli(
      ["status", "--project", wrongProject, "--json"],
      { cwd: root },
    );

    expect(upward.exitCode).toBe(3);
    expect(parseJson(upward.stderr)).toMatchObject({
      ok: false,
      error: { code: "PROJECT_NOT_FOUND" },
    });
    expect(explicit.exitCode).toBe(3);
    expect(parseJson(explicit.stderr)).toMatchObject({
      ok: false,
      error: { code: "PROJECT_CONFIG_NOT_FOUND" },
    });
  });

  it("maps TOML parse and schema errors to config errors", async () => {
    const parseRoot = await makeTempProject();
    await writeConfig(parseRoot, "[discovery\n");
    const schemaRoot = await makeTempProject();
    await writeConfig(
      schemaRoot,
      `[discovery]
respect_gitignore = true
follow_symlinks = false
include_hidden = false

[[sources]]
id = "docs"
root = "/outside"
include = ["**/*.md"]
exclude = []
scanner = "text"
`,
    );

    const parseFailed = await runCli(["status", "--json"], { cwd: parseRoot });
    const invalid = await runCli(["status", "--json"], { cwd: schemaRoot });

    expect(parseFailed.exitCode).toBe(4);
    expect(parseJson(parseFailed.stderr)).toMatchObject({
      ok: false,
      error: { code: "CONFIG_PARSE_FAILED" },
    });
    expect(invalid.exitCode).toBe(4);
    expect(parseJson(invalid.stderr)).toMatchObject({
      ok: false,
      error: { code: "CONFIG_INVALID" },
    });
  });

  it("validates duplicate source ids and parent-traversing roots", async () => {
    const duplicateRoot = await makeTempProject();
    await writeConfig(
      duplicateRoot,
      defaultConfigToml.replace('id = "python"', 'id = "docs"'),
    );
    const outsideRoot = await makeTempProject();
    await writeConfig(
      outsideRoot,
      defaultConfigToml.replace('root = "docs"', 'root = "../docs"'),
    );

    const duplicate = await runCli(["config", "print", "--json"], {
      cwd: duplicateRoot,
    });
    const outside = await runCli(["config", "print", "--json"], {
      cwd: outsideRoot,
    });

    expect(duplicate.exitCode).toBe(4);
    expect(parseJson(duplicate.stderr)).toMatchObject({
      ok: false,
      error: { code: "CONFIG_INVALID" },
    });
    expect(outside.exitCode).toBe(4);
    expect(parseJson(outside.stderr)).toMatchObject({
      ok: false,
      error: { code: "CONFIG_INVALID" },
    });
  });

  it("rejects backslash separators in source roots and glob patterns", async () => {
    const rootBackslash = await makeTempProject();
    await writeConfig(
      rootBackslash,
      defaultConfigToml.replace('root = "docs"', 'root = "docs\\\\drafts"'),
    );
    const includeBackslash = await makeTempProject();
    await writeConfig(
      includeBackslash,
      defaultConfigToml.replace(
        'include = ["**/*.{md,mdx,rst,adoc,txt}"]',
        'include = ["**\\\\*.md"]',
      ),
    );

    const rootResult = await runCli(["config", "print", "--json"], {
      cwd: rootBackslash,
    });
    const includeResult = await runCli(["config", "print", "--json"], {
      cwd: includeBackslash,
    });

    expect(rootResult.exitCode).toBe(4);
    expect(parseJson(rootResult.stderr)).toMatchObject({
      ok: false,
      error: { code: "CONFIG_INVALID" },
    });
    expect(includeResult.exitCode).toBe(4);
    expect(parseJson(includeResult.stderr)).toMatchObject({
      ok: false,
      error: { code: "CONFIG_INVALID" },
    });
  });

  it("discovers included files, excludes configured files, and filters by source", async () => {
    const root = await createProject({
      "docs/index.md": "hello\n",
      "docs/private/skip.md": "skip\n",
      "src/main.py": "print('hi')\n",
    });
    await writeConfig(
      root,
      defaultConfigToml.replace("exclude = []", 'exclude = ["private/**"]'),
    );

    const result = await runCli(
      ["discover", "--source", "docs", "--list", "--json"],
      {
        cwd: root,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(parseJson(result.stdout)).toMatchObject({
      ok: true,
      data: {
        sources: [
          {
            id: "docs",
            files: [{ path: "docs/index.md" }],
          },
        ],
        totalFiles: 1,
      },
    });
    expect(result.stdout).not.toContain("private/skip.md");
    expect(result.stdout).not.toContain("src/main.py");
  });

  it("applies gitignore and hidden discovery defaults with CLI overrides", async () => {
    const root = await createProject({
      "docs/visible.md": "visible\n",
      "docs/ignored.md": "ignored\n",
      "docs/.hidden.md": "hidden\n",
      ".gitignore": "docs/ignored.md\n",
    });

    const defaults = await runCli(
      ["discover", "--source", "docs", "--list", "--json"],
      {
        cwd: root,
      },
    );
    const overridden = await runCli(
      [
        "discover",
        "--source",
        "docs",
        "--list",
        "--no-respect-gitignore",
        "--include-hidden",
        "--json",
      ],
      { cwd: root },
    );

    expect(defaults.stdout).toContain("docs/visible.md");
    expect(defaults.stdout).not.toContain("docs/ignored.md");
    expect(defaults.stdout).not.toContain("docs/.hidden.md");
    expect(overridden.stdout).toContain("docs/ignored.md");
    expect(overridden.stdout).toContain("docs/.hidden.md");
  });

  it("keeps symlink files out by default and excludes external targets when following symlinks", async () => {
    const root = await createProject({
      "docs/visible.md": "visible\n",
    });
    const external = await makeTempProject();
    await writeFile(join(external, "external.md"), "outside\n");
    await symlink(
      join(external, "external.md"),
      join(root, "docs", "external.md"),
    );
    await symlink(
      join(root, "docs", "visible.md"),
      join(root, "docs", "linked.md"),
    );

    const defaults = await runCli(
      ["discover", "--source", "docs", "--list", "--json"],
      { cwd: root },
    );
    const follow = await runCli(
      ["discover", "--source", "docs", "--list", "--follow-symlinks", "--json"],
      { cwd: root },
    );

    expect(defaults.stdout).toContain("docs/visible.md");
    expect(defaults.stdout).not.toContain("docs/linked.md");
    expect(defaults.stdout).not.toContain("docs/external.md");
    expect(follow.stdout).toContain("docs/visible.md");
    expect(follow.stdout).not.toContain("external.md");
  });

  it("fails discover when source roots or source ids do not exist", async () => {
    const root = await createProject();

    const missingSource = await runCli(
      ["discover", "--source", "missing", "--json"],
      {
        cwd: root,
      },
    );
    const missingRoot = await runCli(
      ["discover", "--source", "docs", "--json"],
      {
        cwd: root,
      },
    );

    expect(missingSource.exitCode).toBe(4);
    expect(parseJson(missingSource.stderr)).toMatchObject({
      ok: false,
      error: { code: "SOURCE_NOT_FOUND" },
    });
    expect(missingRoot.exitCode).toBe(5);
    expect(parseJson(missingRoot.stderr)).toMatchObject({
      ok: false,
      error: { code: "SOURCE_ROOT_NOT_FOUND" },
    });
  });

  it("allows empty sources in discover and reports them in doctor", async () => {
    const root = await createProject();
    await mkdir(join(root, "docs"), { recursive: true });
    await mkdir(join(root, "src"), { recursive: true });

    const discover = await runCli(["discover", "--json"], { cwd: root });
    const doctor = await runCli(["doctor", "--json"], { cwd: root });

    expect(discover.exitCode).toBe(0);
    expect(parseJson(discover.stdout)).toMatchObject({
      ok: true,
      data: { totalFiles: 0 },
    });
    expect(parseJson(doctor.stdout)).toMatchObject({
      ok: true,
      data: {
        ok: true,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            level: "warning",
            code: "SOURCE_EMPTY",
            sourceId: "docs",
          }),
        ]),
      },
    });
  });

  it("fails doctor when source roots are missing while preserving diagnostics", async () => {
    const root = await createProject();

    const doctor = await runCli(["doctor", "--json"], { cwd: root });

    expect(doctor.exitCode).toBe(5);
    expect(parseJson(doctor.stderr)).toMatchObject({
      ok: false,
      error: {
        code: "SOURCE_ROOT_NOT_FOUND",
        details: {
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              level: "error",
              code: "SOURCE_ROOT_NOT_FOUND",
              sourceId: "docs",
            }),
          ]),
        },
      },
    });
  });

  it("fails doctor when a source uses an unregistered scanner", async () => {
    const root = await createProject();
    await mkdir(join(root, "docs"), { recursive: true });
    await mkdir(join(root, "src"), { recursive: true });
    await writeConfig(
      root,
      defaultConfigToml.replace('scanner = "text"', 'scanner = "unknown"'),
    );

    const doctor = await runCli(["doctor", "--json"], { cwd: root });

    expect(doctor.exitCode).toBe(5);
    expect(parseJson(doctor.stderr)).toMatchObject({
      ok: false,
      error: {
        code: "SCANNER_NOT_REGISTERED",
        details: {
          diagnostics: expect.arrayContaining([
            expect.objectContaining({
              level: "error",
              code: "SCANNER_NOT_REGISTERED",
              sourceId: "docs",
            }),
          ]),
        },
      },
    });
  });

  it("prints normalized config with discovery overrides", async () => {
    const root = await createProject();

    const result = await runCli(
      [
        "config",
        "print",
        "--no-respect-gitignore",
        "--follow-symlinks",
        "--include-hidden",
        "--json",
      ],
      { cwd: root },
    );

    expect(result.exitCode).toBe(0);
    expect(parseJson(result.stdout)).toMatchObject({
      ok: true,
      data: {
        discovery: {
          respectGitignore: false,
          followSymlinks: true,
          includeHidden: true,
        },
      },
    });
  });

  it("scans discovered sources with registered text and python scanners", async () => {
    const root = await createProject({
      "docs/index.md": "hello\nworld\n",
      "src/main.py": "print('hi')\n",
    });

    const result = await runCli(["scan", "--json"], { cwd: root });

    expect(result.exitCode).toBe(0);
    expect(parseJson(result.stdout)).toMatchObject({
      ok: true,
      data: {
        results: expect.arrayContaining([
          expect.objectContaining({
            sourceId: "docs",
            scanner: "text",
            files: 1,
            bytes: 12,
            lines: 2,
          }),
          expect.objectContaining({
            sourceId: "python",
            scanner: "python",
            files: 1,
            bytes: 12,
            lines: 1,
          }),
        ]),
        totals: { files: 2, bytes: 24, lines: 3 },
      },
    });
  });

  it("reports unregistered scanners as scan errors", async () => {
    const root = await createProject({
      "docs/index.md": "hello\n",
    });
    await writeConfig(
      root,
      defaultConfigToml.replace('scanner = "text"', 'scanner = "unknown"'),
    );

    const result = await runCli(["scan", "--source", "docs", "--json"], {
      cwd: root,
    });

    expect(result.exitCode).toBe(5);
    expect(parseJson(result.stderr)).toMatchObject({
      ok: false,
      error: { code: "SCANNER_NOT_REGISTERED" },
    });
  });

  it("maps usage errors to stable JSON and human output without stack traces", async () => {
    const root = await makeTempProject();

    const json = await runCli(["discover", "--source", "--json"], {
      cwd: root,
    });
    const human = await runCli(["discover", "--source"], { cwd: root });
    const missingProject = await runCli(["status", "--project", "--json"], {
      cwd: root,
    });
    const unknownCommand = await runCli(["missing", "--json"], { cwd: root });
    const unknownOption = await runCli(["status", "--bad", "--json"], {
      cwd: root,
    });

    expect(json.exitCode).toBe(2);
    expect(parseJson(json.stderr)).toMatchObject({
      ok: false,
      error: { code: "USAGE_ERROR" },
    });
    expect(missingProject.exitCode).toBe(2);
    expect(parseJson(missingProject.stderr)).toMatchObject({
      ok: false,
      error: { code: "USAGE_ERROR" },
    });
    expect(unknownCommand.exitCode).toBe(2);
    expect(unknownCommand.stderr.trim().startsWith("{")).toBe(true);
    expect(parseJson(unknownCommand.stderr)).toMatchObject({
      ok: false,
      error: { code: "USAGE_ERROR" },
    });
    expect(unknownOption.exitCode).toBe(2);
    expect(unknownOption.stderr.trim().startsWith("{")).toBe(true);
    expect(parseJson(unknownOption.stderr)).toMatchObject({
      ok: false,
      error: { code: "USAGE_ERROR" },
    });
    expect(human.exitCode).toBe(2);
    expect(human.stderr).toContain("USAGE_ERROR");
    expect(human.stderr).not.toContain(" at ");
  });
});
