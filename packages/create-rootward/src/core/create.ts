import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createError } from "./errors";
import { loadManifest, type TemplateManifest } from "./manifest";
import { ok } from "./result";

export type CreateOptions = {
  cwd: string;
  template: string;
  targetDir: string;
  cliName?: string | undefined;
  packageName?: string | undefined;
  crateName?: string | undefined;
  binName?: string | undefined;
  templatesRoot?: string | undefined;
};

export type CreateData = {
  template: string;
  targetDir: string;
  identity: Record<string, string>;
  filesWritten: number;
  nextCommands: string[];
};

const creatorSourceDir = dirname(fileURLToPath(import.meta.url));
const defaultTemplateRootCandidates = [
  resolve(creatorSourceDir, "templates"),
  resolve(creatorSourceDir, "..", "..", "..", "templates"),
];

function validateCliName(value: string) {
  return /^[a-z][a-z0-9-]*$/.test(value);
}

function optionNameForIdentityKey(identityKey: string) {
  return `--${identityKey.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`;
}

function optionValueForIdentityKey(
  options: CreateOptions,
  identityKey: string,
) {
  switch (identityKey) {
    case "cliName":
      return options.cliName;
    case "packageName":
      return options.packageName;
    case "crateName":
      return options.crateName;
    case "binName":
      return options.binName;
    default:
      return undefined;
  }
}

function formatDerivedIdentity(
  format: string,
  identity: Record<string, string>,
) {
  return format.replaceAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_, key: string) => {
    const value = identity[key];
    if (value === undefined) {
      throw createError("USAGE_ERROR", "Derived identity value is missing.", {
        identityKey: key,
      });
    }
    return value;
  });
}

function validateIdentityPattern(
  identityKey: string,
  value: string,
  pattern: string,
) {
  const regex = new RegExp(pattern);
  if (!regex.test(value)) {
    throw createError("USAGE_ERROR", "Identity value is not valid.", {
      identityKey,
      value,
      pattern,
    });
  }
}

function templateRootFor(templatesRoot: string, manifest: TemplateManifest) {
  return join(templatesRoot, manifest.id, manifest.templateRoot);
}

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureTarget(targetDir: string) {
  if (await pathExists(targetDir)) {
    const linkStat = await lstat(targetDir);
    if (linkStat.isSymbolicLink()) {
      throw createError(
        "TARGET_INVALID",
        "Target path must not be a symbolic link.",
        {
          targetDir,
        },
      );
    }
    const targetStat = await stat(targetDir);
    if (!targetStat.isDirectory()) {
      throw createError("TARGET_INVALID", "Target path is not a directory.", {
        targetDir,
      });
    }
    const entries = await readdir(targetDir);
    if (entries.length > 0) {
      throw createError("TARGET_NOT_EMPTY", "Target directory is not empty.", {
        targetDir,
      });
    }
    return;
  }

  try {
    await mkdir(targetDir, { recursive: true });
  } catch (error) {
    throw createError(
      "TARGET_INVALID",
      "Target directory could not be created.",
      {
        targetDir,
        reason: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

function identityFor(options: CreateOptions, manifest: TemplateManifest) {
  const identity: Record<string, string> = {};

  for (const [identityKey, slot] of Object.entries(manifest.identity)) {
    if (slot.derivedFrom) {
      const sourceValue = identity[slot.derivedFrom];
      if (sourceValue === undefined) {
        throw createError(
          "USAGE_ERROR",
          "Derived identity source is missing.",
          {
            identityKey,
            derivedFrom: slot.derivedFrom,
          },
        );
      }
      identity[identityKey] = slot.format
        ? formatDerivedIdentity(slot.format, identity)
        : sourceValue;
      continue;
    }

    const value = optionValueForIdentityKey(options, identityKey);
    if (slot.required && !value) {
      throw createError(
        "USAGE_ERROR",
        `Missing required option ${optionNameForIdentityKey(identityKey)}.`,
        {
          option: optionNameForIdentityKey(identityKey),
        },
      );
    }
    if (!value) {
      continue;
    }
    if (identityKey === "cliName" && !validateCliName(value)) {
      throw createError("USAGE_ERROR", "CLI name is not valid.", {
        cliName: value,
      });
    }
    if (slot.pattern) {
      validateIdentityPattern(identityKey, value, slot.pattern);
    }
    identity[identityKey] = value;
  }

  return identity;
}

async function rewriteTokens(
  targetDir: string,
  manifest: TemplateManifest,
  identity: Record<string, string>,
) {
  const tokenEntries = Object.entries(manifest.tokens);
  const textExtensions = new Set([
    ".json",
    ".md",
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".cjs",
    ".toml",
    ".yml",
    ".yaml",
    ".rs",
    ".lock",
  ]);

  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      const extension = entry.name.includes(".")
        ? entry.name.slice(entry.name.lastIndexOf("."))
        : "";
      if (!textExtensions.has(extension)) {
        continue;
      }
      let text: string;
      try {
        text = await readFile(fullPath, "utf8");
      } catch (error) {
        throw createError(
          "REWRITE_FAILED",
          "Generated file could not be read.",
          {
            path: fullPath,
            reason: error instanceof Error ? error.message : String(error),
          },
        );
      }
      let next = text;
      for (const [token, identityKey] of tokenEntries) {
        const value = identity[identityKey];
        if (value === undefined) {
          throw createError("REWRITE_FAILED", "Identity value is missing.", {
            token,
            identityKey,
          });
        }
        next = next.split(token).join(value);
      }
      if (next !== text) {
        try {
          await writeFile(fullPath, next);
        } catch (error) {
          throw createError(
            "REWRITE_FAILED",
            "Generated file could not be written.",
            {
              path: fullPath,
              reason: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }
  }

  await walk(targetDir);
}

async function assertNoTokenResidue(
  targetDir: string,
  manifest: TemplateManifest,
) {
  const tokens = Object.keys(manifest.tokens);
  async function walk(
    dir: string,
  ): Promise<{ path: string; token: string } | undefined> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const residue = await walk(fullPath);
        if (residue) {
          return residue;
        }
        continue;
      }
      let text: string;
      try {
        text = await readFile(fullPath, "utf8");
      } catch {
        continue;
      }
      for (const token of tokens) {
        if (text.includes(token)) {
          return { path: fullPath, token };
        }
      }
    }
    return undefined;
  }

  const residue = await walk(targetDir);
  if (residue) {
    throw createError(
      "TOKEN_RESIDUE_FOUND",
      "Generated project contains token residue.",
      {
        path: residue.path,
        token: residue.token,
      },
    );
  }
}

async function runPostcheck(targetDir: string, manifest: TemplateManifest) {
  for (const relativePath of manifest.postcheck) {
    const fullPath = join(targetDir, relativePath);
    if (!(await pathExists(fullPath))) {
      throw createError(
        "POSTCHECK_FAILED",
        "Generated project is missing a required path.",
        {
          path: relativePath,
        },
      );
    }
  }
}

async function countFiles(root: string) {
  let total = 0;
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        total += 1;
      }
    }
  }
  await walk(root);
  return total;
}

export async function createProject(options: CreateOptions) {
  const templatesRoot =
    options.templatesRoot ?? (await resolveDefaultTemplatesRoot());
  const manifest = await loadManifest(templatesRoot, options.template);
  if (manifest.status === "reserved") {
    throw createError(
      "TEMPLATE_NOT_IMPLEMENTED",
      "Template is reserved but not implemented.",
      {
        template: options.template,
      },
    );
  }

  const sourceRoot = templateRootFor(templatesRoot, manifest);
  if (!(await pathExists(sourceRoot))) {
    throw createError("TEMPLATE_INVALID", "Template root does not exist.", {
      template: options.template,
      sourceRoot,
    });
  }

  const targetDir = resolve(options.cwd, options.targetDir);

  const identity = identityFor(options, manifest);
  await ensureTarget(targetDir);

  try {
    await cp(sourceRoot, targetDir, {
      recursive: true,
      filter: (source) => {
        const name = source.split(/[\\/]/).at(-1) ?? "";
        return !manifest.exclude.includes(name);
      },
    });
  } catch (error) {
    throw createError("COPY_FAILED", "Template source could not be copied.", {
      template: options.template,
      sourceRoot,
      targetDir,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  await rewriteTokens(targetDir, manifest, identity);
  await assertNoTokenResidue(targetDir, manifest);
  await runPostcheck(targetDir, manifest);

  return ok<CreateData>({
    template: manifest.id,
    targetDir,
    identity,
    filesWritten: await countFiles(targetDir),
    nextCommands: [`cd ${targetDir}`, ...manifest.nextCommands],
  });
}

async function resolveDefaultTemplatesRoot() {
  for (const candidate of defaultTemplateRootCandidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  throw createError(
    "TEMPLATE_INVALID",
    "Packaged templates directory was not found.",
    {
      candidates: defaultTemplateRootCandidates,
    },
  );
}
