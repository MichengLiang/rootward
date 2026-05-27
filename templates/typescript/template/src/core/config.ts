import { isAbsolute } from "node:path";
import { parse, stringify } from "smol-toml";
import { z } from "zod";
import { type FileSystem, nodeFileSystem } from "../io/filesystem";
import { defaultConfigToml } from "./constants";
import { createError } from "./errors";
import type { ProjectContext } from "./project";

const discoverySchema = z
  .object({
    respect_gitignore: z.boolean().default(true),
    follow_symlinks: z.boolean().default(false),
    include_hidden: z.boolean().default(false),
  })
  .default({
    respect_gitignore: true,
    follow_symlinks: false,
    include_hidden: false,
  });

const sourceSchema = z.object({
  id: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "source id must be a CLI identifier"),
  root: z
    .string()
    .min(1)
    .refine(
      (value) => !containsBackslash(value),
      "source root must use POSIX separators",
    )
    .refine((value) => !isAbsolute(value), "source root must be relative")
    .refine(
      (value) => !containsParentTraversal(value),
      "source root must stay inside the project",
    ),
  include: z.array(
    z
      .string()
      .min(1)
      .refine(
        (value) => !containsBackslash(value),
        "include pattern must use POSIX separators",
      ),
  ),
  exclude: z
    .array(
      z
        .string()
        .refine(
          (value) => !containsBackslash(value),
          "exclude pattern must use POSIX separators",
        ),
    )
    .default([]),
  scanner: z.string().min(1),
});

const configSchema = z
  .object({
    discovery: discoverySchema,
    sources: z.array(sourceSchema).min(1),
  })
  .superRefine((config, context) => {
    const seen = new Set<string>();
    for (const [index, source] of config.sources.entries()) {
      if (seen.has(source.id)) {
        context.addIssue({
          code: "custom",
          path: ["sources", index, "id"],
          message: `duplicate source id "${source.id}"`,
        });
      }
      seen.add(source.id);
    }
  });

export type NormalizedConfig = {
  discovery: {
    respectGitignore: boolean;
    followSymlinks: boolean;
    includeHidden: boolean;
  };
  sources: Array<{
    id: string;
    root: string;
    include: string[];
    exclude: string[];
    scanner: string;
  }>;
};

export type DiscoveryOverrides = {
  respectGitignore?: boolean | undefined;
  followSymlinks?: boolean | undefined;
  includeHidden?: boolean | undefined;
};

function containsBackslash(value: string) {
  return value.includes("\\");
}

function containsParentTraversal(value: string) {
  return value.split("/").includes("..");
}

function normalizeConfig(input: unknown): NormalizedConfig {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) {
    throw createError("CONFIG_INVALID", "Config schema validation failed.", {
      issues: parsed.error.issues,
    });
  }

  return {
    discovery: {
      respectGitignore: parsed.data.discovery.respect_gitignore,
      followSymlinks: parsed.data.discovery.follow_symlinks,
      includeHidden: parsed.data.discovery.include_hidden,
    },
    sources: parsed.data.sources.map((source) => ({
      id: source.id,
      root: source.root,
      include: source.include,
      exclude: source.exclude,
      scanner: source.scanner,
    })),
  };
}

export async function loadConfig(
  context: ProjectContext,
  fs: FileSystem = nodeFileSystem,
) {
  let text: string;
  try {
    text = await fs.readText(context.configPath);
  } catch (error) {
    throw createError("CONFIG_READ_FAILED", "Config file could not be read.", {
      configPath: context.configPath,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  let raw: unknown;
  try {
    raw = parse(text);
  } catch (error) {
    throw createError("CONFIG_PARSE_FAILED", "Config file is not valid TOML.", {
      configPath: context.configPath,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  return normalizeConfig(raw);
}

export function applyDiscoveryOverrides(
  config: NormalizedConfig,
  overrides: DiscoveryOverrides,
): NormalizedConfig {
  return {
    ...config,
    discovery: {
      respectGitignore:
        overrides.respectGitignore ?? config.discovery.respectGitignore,
      followSymlinks:
        overrides.followSymlinks ?? config.discovery.followSymlinks,
      includeHidden: overrides.includeHidden ?? config.discovery.includeHidden,
    },
  };
}

export function serializeConfig(config: NormalizedConfig) {
  return stringify({
    discovery: {
      respect_gitignore: config.discovery.respectGitignore,
      follow_symlinks: config.discovery.followSymlinks,
      include_hidden: config.discovery.includeHidden,
    },
    sources: config.sources.map((source) => ({
      id: source.id,
      root: source.root,
      include: source.include,
      exclude: source.exclude,
      scanner: source.scanner,
    })),
  });
}

export { defaultConfigToml };
