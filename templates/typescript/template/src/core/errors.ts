export type CliErrorCode =
  | "USAGE_ERROR"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_CONFIG_NOT_FOUND"
  | "INIT_TARGET_INVALID"
  | "PROJECT_ALREADY_INITIALIZED"
  | "CONFIG_READ_FAILED"
  | "CONFIG_PARSE_FAILED"
  | "CONFIG_INVALID"
  | "SOURCE_NOT_FOUND"
  | "SOURCE_ROOT_NOT_FOUND"
  | "SCANNER_NOT_REGISTERED"
  | "DISCOVERY_FAILED"
  | "SCAN_FAILED"
  | "INTERNAL_ERROR";

export type ExitCode = 0 | 1 | 2 | 3 | 4 | 5;

export type CliError = {
  code: CliErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

const exitCodeByErrorCode: Record<CliErrorCode, ExitCode> = {
  USAGE_ERROR: 2,
  PROJECT_NOT_FOUND: 3,
  PROJECT_CONFIG_NOT_FOUND: 3,
  INIT_TARGET_INVALID: 3,
  PROJECT_ALREADY_INITIALIZED: 3,
  CONFIG_READ_FAILED: 4,
  CONFIG_PARSE_FAILED: 4,
  CONFIG_INVALID: 4,
  SOURCE_NOT_FOUND: 4,
  SOURCE_ROOT_NOT_FOUND: 5,
  SCANNER_NOT_REGISTERED: 5,
  DISCOVERY_FAILED: 5,
  SCAN_FAILED: 5,
  INTERNAL_ERROR: 1,
};

export class CliFailure extends Error {
  readonly cliError: CliError;
  readonly exitCode: ExitCode;

  constructor(error: CliError) {
    super(error.message);
    this.name = "CliFailure";
    this.cliError = error;
    this.exitCode = exitCodeByErrorCode[error.code];
  }
}

export function createError(
  code: CliErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  return new CliFailure({
    code,
    message,
    ...(details ? { details } : {}),
  });
}

export function isCliFailure(error: unknown): error is CliFailure {
  return error instanceof CliFailure;
}
