import type { CreatorError, ExitCode } from "./errors";

export type CreatorResult<T> =
  | {
      ok: true;
      code: 0;
      data: T;
    }
  | {
      ok: false;
      code: ExitCode;
      error: CreatorError;
    };

export function ok<T>(data: T): CreatorResult<T> {
  return { ok: true, code: 0, data };
}

export function fail<T = never>(
  code: ExitCode,
  error: CreatorError,
): CreatorResult<T> {
  return { ok: false, code, error };
}
