import { resolve } from "node:path";
import type { DiscoveryOverrides, NormalizedConfig } from "../core/config";
import { applyDiscoveryOverrides, loadConfig } from "../core/config";
import { resolveProjectContext } from "../core/project";
import { type FileSystem, nodeFileSystem } from "../io/filesystem";

export type ProjectCommandOptions = {
  cwd: string;
  project?: string | undefined;
  source?: string | undefined;
  discoveryOverrides?: DiscoveryOverrides | undefined;
  fs?: FileSystem | undefined;
};

export async function loadProject(options: ProjectCommandOptions) {
  const fs = options.fs ?? nodeFileSystem;
  const context = await resolveProjectContext({
    cwd: options.cwd,
    project: options.project,
    fs,
  });
  const config = applyDiscoveryOverrides(
    await loadConfig(context, fs),
    options.discoveryOverrides ?? {},
  );
  return { context, config, fs };
}

export async function sourceStatuses(
  projectRoot: string,
  config: NormalizedConfig,
  fs: FileSystem = nodeFileSystem,
) {
  return Promise.all(
    config.sources.map(async (source) => {
      try {
        const result = await fs.stat(resolve(projectRoot, source.root));
        return {
          id: source.id,
          scanner: source.scanner,
          root: source.root,
          status: result.isDirectory() ? "ok" : "missing",
        };
      } catch {
        return {
          id: source.id,
          scanner: source.scanner,
          root: source.root,
          status: "missing",
        };
      }
    }),
  );
}
