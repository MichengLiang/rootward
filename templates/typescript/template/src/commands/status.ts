import { ok } from "../core/result";
import {
  loadProject,
  type ProjectCommandOptions,
  sourceStatuses,
} from "./shared";

export async function statusCommand(options: ProjectCommandOptions) {
  const { context, config, fs } = await loadProject(options);
  return ok({
    projectRoot: context.projectRoot,
    configPath: context.configPath,
    discoveryMode: context.discoveryMode,
    startDirectory: context.startDirectory,
    sourceCount: config.sources.length,
    sources: await sourceStatuses(context.projectRoot, config, fs),
  });
}
