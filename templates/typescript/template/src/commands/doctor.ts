import { resolve } from "node:path";
import { discoverFiles } from "../core/discovery";
import { fail, ok } from "../core/result";
import { scannerRegistry } from "../core/scanners";
import { loadProject, type ProjectCommandOptions } from "./shared";

export type Diagnostic = {
  level: "info" | "warning" | "error";
  code: string;
  message: string;
  sourceId?: string;
};

export async function doctorCommand(options: ProjectCommandOptions) {
  const { context, config, fs } = await loadProject(options);
  const diagnostics: Diagnostic[] = [
    {
      level: "info",
      code: "CONFIG_OK",
      message: "Config parsed and validated.",
    },
  ];

  for (const source of config.sources) {
    try {
      const sourceRoot = resolve(context.projectRoot, source.root);
      const sourceStat = await fs.stat(sourceRoot);
      if (!sourceStat.isDirectory()) {
        diagnostics.push({
          level: "error",
          code: "SOURCE_ROOT_NOT_FOUND",
          message: "Source root is not a directory.",
          sourceId: source.id,
        });
        continue;
      }
    } catch {
      diagnostics.push({
        level: "error",
        code: "SOURCE_ROOT_NOT_FOUND",
        message: "Source root does not exist.",
        sourceId: source.id,
      });
      continue;
    }

    if (!scannerRegistry[source.scanner]) {
      diagnostics.push({
        level: "error",
        code: "SCANNER_NOT_REGISTERED",
        message: `Scanner "${source.scanner}" is not registered.`,
        sourceId: source.id,
      });
      continue;
    }

    const discovery = await discoverFiles(context, config, {
      sourceId: source.id,
      fs,
    });
    if (discovery.totalFiles === 0) {
      diagnostics.push({
        level: "warning",
        code: "SOURCE_EMPTY",
        message: "Source matched no files.",
        sourceId: source.id,
      });
    }
  }

  const errorDiagnostics = diagnostics.filter(
    (diagnostic) => diagnostic.level === "error",
  );
  if (errorDiagnostics.length > 0) {
    const primary = errorDiagnostics[0] as Diagnostic;
    return fail(5, {
      code:
        primary.code === "SCANNER_NOT_REGISTERED"
          ? "SCANNER_NOT_REGISTERED"
          : "SOURCE_ROOT_NOT_FOUND",
      message: "Project health checks found blocking errors.",
      details: { diagnostics },
    });
  }

  return ok({ ok: true, diagnostics });
}
