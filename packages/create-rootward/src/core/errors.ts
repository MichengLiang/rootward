export type CreatorErrorCode =
  | "USAGE_ERROR"
  | "TEMPLATE_NOT_FOUND"
  | "TEMPLATE_NOT_IMPLEMENTED"
  | "TEMPLATE_INVALID"
  | "TARGET_NOT_EMPTY"
  | "TARGET_INVALID"
  | "COPY_FAILED"
  | "REWRITE_FAILED"
  | "TOKEN_RESIDUE_FOUND"
  | "POSTCHECK_FAILED"
  | "INTERNAL_ERROR";

export type ExitCode = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CreatorError = {
  code: CreatorErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

const exitCodeByErrorCode: Record<CreatorErrorCode, ExitCode> = {
  USAGE_ERROR: 2,
  TEMPLATE_NOT_FOUND: 4,
  TEMPLATE_NOT_IMPLEMENTED: 4,
  TEMPLATE_INVALID: 4,
  TARGET_NOT_EMPTY: 3,
  TARGET_INVALID: 3,
  COPY_FAILED: 5,
  REWRITE_FAILED: 5,
  TOKEN_RESIDUE_FOUND: 6,
  POSTCHECK_FAILED: 6,
  INTERNAL_ERROR: 1,
};

export class CreatorFailure extends Error {
  readonly creatorError: CreatorError;
  readonly exitCode: ExitCode;

  constructor(error: CreatorError) {
    super(error.message);
    this.name = "CreatorFailure";
    this.creatorError = error;
    this.exitCode = exitCodeByErrorCode[error.code];
  }
}

export function createError(
  code: CreatorErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  return new CreatorFailure({
    code,
    message,
    ...(details ? { details } : {}),
  });
}

export function isCreatorFailure(error: unknown): error is CreatorFailure {
  return error instanceof CreatorFailure;
}
