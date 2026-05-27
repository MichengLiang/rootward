import { Command, CommanderError, InvalidArgumentError } from "commander";
import { type CreateData, createProject } from "./core/create";
import { createError, isCreatorFailure } from "./core/errors";
import { type CreatorResult, fail } from "./core/result";
import {
  type CreatorRunResult,
  formatCreate,
  projectHuman,
  projectJson,
} from "./io/output";

export type RunCreatorOptions = {
  cwd?: string;
  templatesRoot?: string;
};

type CommandState = {
  json: boolean;
  result?: CreatorResult<CreateData>;
};

function hasMissingOptionValue(args: string[]) {
  const valueOptions = new Set([
    "--cli-name",
    "--package-name",
    "--crate-name",
    "--bin-name",
  ]);
  for (const [index, arg] of args.entries()) {
    if (!valueOptions.has(arg)) {
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith("-")) {
      return arg;
    }
  }
  return undefined;
}

function usageFailure(error: CommanderError | InvalidArgumentError) {
  return createError("USAGE_ERROR", error.message, {
    code: "code" in error ? error.code : undefined,
  });
}

function toRunResult(state: CommandState): CreatorRunResult {
  if (!state.result) {
    const error = createError(
      "USAGE_ERROR",
      "No command arguments were provided.",
    );
    return projectHuman(fail(error.exitCode, error.creatorError), formatCreate);
  }
  return state.json
    ? projectJson(state.result)
    : projectHuman(state.result, formatCreate);
}

export async function runCreator(
  args: string[],
  options: RunCreatorOptions = {},
): Promise<CreatorRunResult> {
  const cwd = options.cwd ?? process.cwd();
  const state: CommandState = { json: args.includes("--json") };
  const missingOption = hasMissingOptionValue(args);
  if (missingOption) {
    const failure = createError(
      "USAGE_ERROR",
      `Option "${missingOption}" argument is missing.`,
      { option: missingOption },
    );
    const result = fail(failure.exitCode, failure.creatorError);
    return args.includes("--json")
      ? projectJson(result)
      : projectHuman(result, formatCreate);
  }

  const program = new Command();
  program
    .name("create-rootward")
    .description("Create a Rootward project-oriented CLI template")
    .argument("<template>")
    .argument("<target-dir>")
    .requiredOption("--cli-name <name>", "generated CLI name")
    .option("--package-name <name>", "TypeScript package name")
    .option("--crate-name <name>", "Rust crate name")
    .option("--bin-name <name>", "Rust binary target name")
    .option("--json", "write JSON output")
    .exitOverride()
    .configureOutput({
      writeOut: () => undefined,
      writeErr: () => undefined,
    })
    .action(
      async (
        template: string,
        targetDir: string,
        commandOptions: {
          cliName: string;
          packageName?: string;
          crateName?: string;
          binName?: string;
          json?: boolean;
        },
      ) => {
        state.json = commandOptions.json ?? false;
        state.result = await createProject({
          cwd,
          template,
          targetDir,
          cliName: commandOptions.cliName,
          packageName: commandOptions.packageName,
          crateName: commandOptions.crateName,
          binName: commandOptions.binName,
          templatesRoot: options.templatesRoot,
        });
      },
    );

  try {
    await program.parseAsync(args, { from: "user" });
    return toRunResult(state);
  } catch (error) {
    if (isCreatorFailure(error)) {
      const result = fail(error.exitCode, error.creatorError);
      return state.json || args.includes("--json")
        ? projectJson(result)
        : projectHuman(result, formatCreate);
    }
    if (
      error instanceof CommanderError ||
      error instanceof InvalidArgumentError
    ) {
      const failure = usageFailure(error);
      const result = fail(failure.exitCode, failure.creatorError);
      return args.includes("--json")
        ? projectJson(result)
        : projectHuman(result, formatCreate);
    }
    const failure = createError(
      "INTERNAL_ERROR",
      "Unexpected runtime failure.",
      {
        reason: error instanceof Error ? error.message : String(error),
      },
    );
    const result = fail(failure.exitCode, failure.creatorError);
    return args.includes("--json")
      ? projectJson(result)
      : projectHuman(result, formatCreate);
  }
}
