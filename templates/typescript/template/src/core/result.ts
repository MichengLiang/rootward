import type { CliError, ExitCode } from "./errors";

export type CommandResult<T> =
  | {
      ok: true;
      code: 0;
      data: T;
    }
  | {
      ok: false;
      code: ExitCode;
      error: CliError;
    };

export function ok<T>(data: T): CommandResult<T> {
  return { ok: true, code: 0, data };
}

export function fail<T = never>(
  code: ExitCode,
  error: CliError,
): CommandResult<T> {
  return { ok: false, code, error };
}
