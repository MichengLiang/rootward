import { dirname, resolve } from "node:path";
import { type FileSystem, nodeFileSystem } from "../io/filesystem";
import { configDirName, configFileName } from "./constants";
import { createError } from "./errors";

export type ProjectContext = {
  projectRoot: string;
  configDir: string;
  configPath: string;
  discoveryMode: "explicit" | "cwd-upward";
  startDirectory: string;
};

function contextFromRoot(
  projectRoot: string,
  discoveryMode: ProjectContext["discoveryMode"],
  startDirectory: string,
): ProjectContext {
  const configDir = resolve(projectRoot, configDirName);
  return {
    projectRoot,
    configDir,
    configPath: resolve(configDir, configFileName),
    discoveryMode,
    startDirectory,
  };
}

export async function resolveProjectContext(options: {
  cwd: string;
  project?: string | undefined;
  fs?: FileSystem | undefined;
}): Promise<ProjectContext> {
  const fs = options.fs ?? nodeFileSystem;
  if (options.project) {
    const projectRoot = resolve(options.cwd, options.project);
    const context = contextFromRoot(projectRoot, "explicit", projectRoot);
    if (!(await fs.pathExists(context.configPath))) {
      throw createError(
        "PROJECT_CONFIG_NOT_FOUND",
        `No ${configDirName}/${configFileName} exists under the explicit project root.`,
        { projectRoot, configPath: context.configPath },
      );
    }
    return context;
  }

  let current = resolve(options.cwd);
  const startDirectory = current;

  while (true) {
    const context = contextFromRoot(current, "cwd-upward", startDirectory);
    if (await fs.pathExists(context.configPath)) {
      return context;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw createError(
        "PROJECT_NOT_FOUND",
        `No ${configDirName}/${configFileName} was found from the current directory upward.`,
        { startDirectory },
      );
    }
    current = parent;
  }
}
