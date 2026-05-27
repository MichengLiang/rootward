import type { Stats } from "node:fs";
import { resolve } from "node:path";
import {
  configDirName,
  configFileName,
  defaultConfigToml,
  runtimeGitignore,
} from "../core/constants";
import { createError } from "../core/errors";
import { ok } from "../core/result";
import { type FileSystem, nodeFileSystem } from "../io/filesystem";

export type InitData = {
  projectRoot: string;
  configPath: string;
  created: string[];
};

export async function initCommand(options: {
  cwd: string;
  path?: string | undefined;
  force?: boolean | undefined;
  fs?: FileSystem | undefined;
}) {
  const fs = options.fs ?? nodeFileSystem;
  const projectRoot = resolve(options.cwd, options.path ?? ".");
  let targetStat: Stats;
  try {
    targetStat = await fs.stat(projectRoot);
  } catch {
    throw createError("INIT_TARGET_INVALID", "Init target does not exist.", {
      projectRoot,
    });
  }
  if (!targetStat.isDirectory()) {
    throw createError(
      "INIT_TARGET_INVALID",
      "Init target is not a directory.",
      {
        projectRoot,
      },
    );
  }

  const configDir = resolve(projectRoot, configDirName);
  const configPath = resolve(configDir, configFileName);
  const cacheDir = resolve(configDir, "cache");
  const stateDir = resolve(configDir, "state");

  if (!options.force) {
    try {
      await fs.stat(configPath);
      throw createError(
        "PROJECT_ALREADY_INITIALIZED",
        `Project already contains a ${configDirName} config file.`,
        { configPath },
      );
    } catch (error) {
      if (error instanceof Error && error.name === "CliFailure") {
        throw error;
      }
    }
  }

  await fs.mkdirp(cacheDir);
  await fs.mkdirp(stateDir);
  await fs.writeText(configPath, defaultConfigToml);
  await fs.writeText(resolve(cacheDir, ".gitignore"), runtimeGitignore);
  await fs.writeText(resolve(stateDir, ".gitignore"), runtimeGitignore);

  return ok({
    projectRoot,
    configPath,
    created: [
      `${configDirName}/${configFileName}`,
      `${configDirName}/cache/.gitignore`,
      `${configDirName}/state/.gitignore`,
    ],
  });
}
