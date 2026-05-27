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
  configDir: string;
  configPath: string;
  created: Array<"config" | "cache" | "state">;
  overwritten: boolean;
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
  const configExisted = await fs.pathExists(configPath);
  const cacheExisted = await fs.pathExists(cacheDir);
  const stateExisted = await fs.pathExists(stateDir);

  if (!options.force) {
    if (configExisted) {
      throw createError(
        "PROJECT_ALREADY_INITIALIZED",
        `Project already contains a ${configDirName} config file.`,
        { configPath },
      );
    }
  }

  await fs.mkdirp(cacheDir);
  await fs.mkdirp(stateDir);
  await fs.writeText(configPath, defaultConfigToml);
  await fs.writeText(resolve(cacheDir, ".gitignore"), runtimeGitignore);
  await fs.writeText(resolve(stateDir, ".gitignore"), runtimeGitignore);

  return ok({
    projectRoot,
    configDir,
    configPath,
    created: [
      ...(!configExisted ? (["config"] as const) : []),
      ...(!cacheExisted ? (["cache"] as const) : []),
      ...(!stateExisted ? (["state"] as const) : []),
    ],
    overwritten: options.force === true && configExisted,
  });
}
