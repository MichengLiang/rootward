import { discoverFiles } from "../core/discovery";
import { ok } from "../core/result";
import { scanSource } from "../core/scanners";
import { loadProject, type ProjectCommandOptions } from "./shared";

export async function scanCommand(options: ProjectCommandOptions) {
  const { context, config, fs } = await loadProject(options);
  const discovery = await discoverFiles(context, config, {
    sourceId: options.source,
    fs,
  });
  const results = [];

  for (const source of discovery.sources) {
    results.push(
      await scanSource({ projectRoot: context.projectRoot, source, fs }),
    );
  }

  return ok({
    projectRoot: context.projectRoot,
    configPath: context.configPath,
    results,
    totals: {
      sources: results.length,
      files: results.reduce((sum, result) => sum + result.files, 0),
      bytes: results.reduce((sum, result) => sum + result.bytes, 0),
      lines: results.reduce((sum, result) => sum + result.lines, 0),
    },
  });
}
