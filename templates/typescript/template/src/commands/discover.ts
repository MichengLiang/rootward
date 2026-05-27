import { discoverFiles } from "../core/discovery";
import { ok } from "../core/result";
import { loadProject, type ProjectCommandOptions } from "./shared";

export async function discoverCommand(
  options: ProjectCommandOptions & { list?: boolean | undefined },
) {
  const { context, config, fs } = await loadProject(options);
  const discovery = await discoverFiles(context, config, {
    sourceId: options.source,
    fs,
  });

  return ok({
    projectRoot: context.projectRoot,
    configPath: context.configPath,
    list: options.list ?? false,
    ...discovery,
  });
}
