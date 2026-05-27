import type { CreatorResult } from "../core/result";

export type CreatorRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export function projectJson<T>(result: CreatorResult<T>): CreatorRunResult {
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

function formatError(error: {
  code: string;
  message: string;
  details?: unknown;
}) {
  const details = error.details
    ? `\nDetails: ${JSON.stringify(error.details)}`
    : "";
  return `${error.code}: ${error.message}${details}\n`;
}

export function projectHuman<T>(
  result: CreatorResult<T>,
  formatter: (data: T) => string,
): CreatorRunResult {
  if (result.ok) {
    return { exitCode: 0, stdout: formatter(result.data), stderr: "" };
  }
  return {
    exitCode: result.code,
    stdout: "",
    stderr: formatError(result.error),
  };
}

export function formatCreate(data: {
  template: string;
  targetDir: string;
  identity: Record<string, string>;
  filesWritten: number;
  nextCommands: string[];
}) {
  const identity = Object.entries(data.identity)
    .map(([key, value]) => `  ${key}: ${value}`)
    .join("\n");
  return `Created Rootward ${data.template} project at ${data.targetDir}
Files: ${data.filesWritten}

Identity:
${identity}

Next commands:
${data.nextCommands.map((command) => `  ${command}`).join("\n")}
`;
}
