import { serializeConfig } from "../core/config";
import type { CliError } from "../core/errors";
import type { CommandResult } from "../core/result";

export type CliRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export function projectJson<T>(result: CommandResult<T>): CliRunResult {
  if (result.ok) {
    return {
      exitCode: 0,
      stdout: `${JSON.stringify({ ok: true, data: result.data })}\n`,
      stderr: "",
    };
  }

  return {
    exitCode: result.code,
    stdout: "",
    stderr: `${JSON.stringify({ ok: false, error: result.error })}\n`,
  };
}

function formatError(error: CliError) {
  const details = error.details
    ? `\nDetails: ${JSON.stringify(error.details)}`
    : "";
  return `${error.code}: ${error.message}${details}\n`;
}

export function projectHuman<T>(
  result: CommandResult<T>,
  formatter: (data: T) => string,
): CliRunResult {
  if (result.ok) {
    return { exitCode: 0, stdout: formatter(result.data), stderr: "" };
  }

  return {
    exitCode: result.code,
    stdout: "",
    stderr: formatError(result.error),
  };
}

export function formatStatus(data: {
  projectRoot: string;
  configPath: string;
  discoveryMode: string;
  sources: Array<{ id: string; scanner: string; root: string; status: string }>;
}) {
  const sourceLines = data.sources
    .map(
      (source) =>
        `  ${source.id}\t${source.scanner}\t${source.root}\t${source.status}`,
    )
    .join("\n");
  return `Project: ${data.projectRoot}
Config:  ${data.configPath}
Mode:    ${data.discoveryMode}

Sources:
${sourceLines}
`;
}

export function formatDiscover(data: {
  projectRoot: string;
  configPath: string;
  sources: Array<{
    id: string;
    scanner: string;
    root: string;
    files: Array<{ path: string }>;
  }>;
  list: boolean;
}) {
  const rows = data.sources
    .map(
      (source) =>
        `${source.id}\t${source.scanner}\t${source.root}\t${source.files.length}`,
    )
    .join("\n");
  const list = data.list
    ? `\n\n${data.sources
        .map(
          (source) =>
            `${source.id}\n${source.files.map((file) => `  ${file.path}`).join("\n")}`,
        )
        .join("\n\n")}\n`
    : "\n";

  return `Project: ${data.projectRoot}
Config:  ${data.configPath}

Source\tScanner\tRoot\tFiles
${rows}${list}`;
}

export function formatConfigPrint(data: Parameters<typeof serializeConfig>[0]) {
  return serializeConfig(data);
}

export function formatScan(data: {
  results: Array<{
    sourceId: string;
    scanner: string;
    files: number;
    bytes: number;
    lines: number;
  }>;
  totals: { files: number; bytes: number; lines: number };
}) {
  const rows = data.results
    .map(
      (result) =>
        `${result.sourceId}\t${result.scanner}\t${result.files}\t${result.bytes}\t${result.lines}`,
    )
    .join("\n");
  return `Source\tScanner\tFiles\tBytes\tLines
${rows}
Total\t\t${data.totals.files}\t${data.totals.bytes}\t${data.totals.lines}
`;
}

export function formatDoctor(data: {
  ok: boolean;
  diagnostics: Array<{
    level: string;
    code: string;
    message: string;
    sourceId?: string;
  }>;
}) {
  const rows = data.diagnostics
    .map((diagnostic) => {
      const source = diagnostic.sourceId ? ` ${diagnostic.sourceId}` : "";
      return `${diagnostic.level.toUpperCase()}\t${diagnostic.code}${source}\t${diagnostic.message}`;
    })
    .join("\n");
  return `${data.ok ? "OK" : "ISSUES FOUND"}\n${rows}\n`;
}
