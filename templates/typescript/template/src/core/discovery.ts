import type { Stats } from "node:fs";
import { relative, resolve } from "node:path";
import { globby } from "globby";
import createIgnore from "ignore";
import { type FileSystem, nodeFileSystem } from "../io/filesystem";
import type { NormalizedConfig } from "./config";
import { createError } from "./errors";
import type { ProjectContext } from "./project";

export type DiscoveredFile = {
  path: string;
  sourceId: string;
  scanner: string;
};

export type DiscoveredSource = {
  id: string;
  root: string;
  scanner: string;
  include: string[];
  exclude: string[];
  files: DiscoveredFile[];
};

export type DiscoveryResult = {
  sources: DiscoveredSource[];
  totalFiles: number;
};

function toPosixPath(path: string) {
  return path.split("\\").join("/");
}

function isHiddenProjectPath(path: string) {
  return path.split("/").some((segment) => segment.startsWith("."));
}

function sourcePattern(root: string, pattern: string) {
  const normalizedRoot = toPosixPath(root).replace(/\/+$/, "");
  return normalizedRoot === "." ? pattern : `${normalizedRoot}/${pattern}`;
}

function ensureInsideProject(projectRoot: string, absolutePath: string) {
  const relativePath = relative(projectRoot, absolutePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !relativePath.startsWith("/"))
  );
}

async function createProjectGitignoreFilter(
  context: ProjectContext,
  fs: FileSystem,
  enabled: boolean,
) {
  if (!enabled) {
    return () => false;
  }

  const gitignorePath = resolve(context.projectRoot, ".gitignore");
  try {
    const text = await fs.readText(gitignorePath);
    const matcher = createIgnore().add(text);
    return (projectRelativePath: string) =>
      matcher.ignores(projectRelativePath);
  } catch {
    return () => false;
  }
}

function getSelectedSources(
  config: NormalizedConfig,
  sourceId?: string | undefined,
) {
  if (!sourceId) {
    return config.sources;
  }

  const source = config.sources.find((candidate) => candidate.id === sourceId);
  if (!source) {
    throw createError(
      "SOURCE_NOT_FOUND",
      `Source "${sourceId}" is not defined.`,
      {
        sourceId,
      },
    );
  }
  return [source];
}

export async function discoverFiles(
  context: ProjectContext,
  config: NormalizedConfig,
  options: { sourceId?: string | undefined; fs?: FileSystem | undefined } = {},
): Promise<DiscoveryResult> {
  const fs = options.fs ?? nodeFileSystem;
  const sources: DiscoveredSource[] = [];
  const isIgnoredByProject = await createProjectGitignoreFilter(
    context,
    fs,
    config.discovery.respectGitignore,
  );

  for (const source of getSelectedSources(config, options.sourceId)) {
    const sourceRoot = resolve(context.projectRoot, source.root);
    if (!ensureInsideProject(context.projectRoot, sourceRoot)) {
      throw createError("CONFIG_INVALID", "Source root escapes project root.", {
        sourceId: source.id,
        root: source.root,
      });
    }

    let rootStatus: Stats;
    try {
      rootStatus = await fs.stat(sourceRoot);
    } catch {
      throw createError(
        "SOURCE_ROOT_NOT_FOUND",
        "Source root does not exist.",
        {
          sourceId: source.id,
          root: source.root,
          path: sourceRoot,
        },
      );
    }
    if (!rootStatus.isDirectory()) {
      throw createError(
        "SOURCE_ROOT_NOT_FOUND",
        "Source root is not a directory.",
        {
          sourceId: source.id,
          root: source.root,
          path: sourceRoot,
        },
      );
    }

    let matches: string[];
    try {
      matches = await globby(
        source.include.map((pattern) => sourcePattern(source.root, pattern)),
        {
          cwd: context.projectRoot,
          ignore: source.exclude.map((pattern) =>
            sourcePattern(source.root, pattern),
          ),
          absolute: true,
          onlyFiles: true,
          dot: config.discovery.includeHidden,
          followSymbolicLinks: config.discovery.followSymlinks,
          gitignore: false,
        },
      );
    } catch (error) {
      throw createError("DISCOVERY_FAILED", "File discovery failed.", {
        sourceId: source.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    const files: DiscoveredFile[] = [];
    for (const absolutePath of matches.sort()) {
      if (!ensureInsideProject(context.projectRoot, absolutePath)) {
        continue;
      }
      if (!config.discovery.followSymlinks) {
        const fileStatus = await fs.lstat(absolutePath);
        if (fileStatus.isSymbolicLink()) {
          continue;
        }
      } else {
        const realPath = await fs.realpath(absolutePath);
        if (!ensureInsideProject(context.projectRoot, realPath)) {
          continue;
        }
      }

      const projectRelativePath = toPosixPath(
        relative(context.projectRoot, absolutePath),
      );
      if (isIgnoredByProject(projectRelativePath)) {
        continue;
      }
      if (
        !config.discovery.includeHidden &&
        isHiddenProjectPath(projectRelativePath)
      ) {
        continue;
      }
      files.push({
        path: projectRelativePath,
        sourceId: source.id,
        scanner: source.scanner,
      });
    }

    sources.push({
      id: source.id,
      root: source.root,
      scanner: source.scanner,
      include: source.include,
      exclude: source.exclude,
      files,
    });
  }

  return {
    sources,
    totalFiles: sources.reduce((sum, source) => sum + source.files.length, 0),
  };
}
