import { Command, CommanderError, InvalidArgumentError } from "commander";
import { configPrintCommand } from "./commands/config-print";
import { discoverCommand } from "./commands/discover";
import { doctorCommand } from "./commands/doctor";
import { initCommand } from "./commands/init";
import { scanCommand } from "./commands/scan";
import { statusCommand } from "./commands/status";
import { cliName, packageName } from "./core/constants";
import { createError, isCliFailure } from "./core/errors";
import { type CommandResult, fail } from "./core/result";
import {
  type CliRunResult,
  formatConfigPrint,
  formatDiscover,
  formatDoctor,
  formatScan,
  formatStatus,
  projectHuman,
  projectJson,
} from "./io/output";

export type RunCliOptions = {
  cwd?: string;
};

type CommandState = {
  json: boolean;
  formatter: (data: unknown) => string;
  result?: CommandResult<unknown>;
};

function createState(): CommandState {
  return {
    json: false,
    formatter: (data) => `${JSON.stringify(data, null, 2)}\n`,
  };
}

function addProjectOptions(command: Command) {
  return command
    .option("--project <path>", "explicit project root")
    .option("--json", "write JSON output");
}

function addDiscoveryOptions(command: Command) {
  return addProjectOptions(command)
    .option("--no-respect-gitignore", "do not apply project .gitignore")
    .option("--follow-symlinks", "follow symbolic links")
    .option("--include-hidden", "include hidden files and directories");
}

function discoveryOverrides(options: {
  respectGitignore?: boolean;
  followSymlinks?: boolean;
  includeHidden?: boolean;
}) {
  return {
    ...(options.respectGitignore === false ? { respectGitignore: false } : {}),
    ...(options.followSymlinks ? { followSymlinks: true } : {}),
    ...(options.includeHidden ? { includeHidden: true } : {}),
  };
}

async function capture<T>(
  state: CommandState,
  json: boolean | undefined,
  formatter: (data: T) => string,
  action: () => Promise<CommandResult<T>>,
) {
  state.json = json ?? false;
  state.formatter = formatter as (data: unknown) => string;
  state.result = await action();
}

function toRunResult(state: CommandState): CliRunResult {
  if (!state.result) {
    const error = createError("USAGE_ERROR", "No command was provided.");
    return projectHuman(fail(error.exitCode, error.cliError), (data) =>
      String(data),
    );
  }

  return state.json
    ? projectJson(state.result)
    : projectHuman(state.result, state.formatter);
}

function usageFailure(error: CommanderError | InvalidArgumentError) {
  return createError("USAGE_ERROR", error.message, {
    code: "code" in error ? error.code : undefined,
  });
}

function hasMissingOptionValue(args: string[]) {
  const valueOptions = new Set(["--project", "--source"]);
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

export async function runCli(
  args: string[],
  options: RunCliOptions = {},
): Promise<CliRunResult> {
  const cwd = options.cwd ?? process.cwd();
  const state = createState();
  const program = new Command();
  const missingOption = hasMissingOptionValue(args);
  if (missingOption) {
    const failure = createError(
      "USAGE_ERROR",
      `Option "${missingOption}" argument is missing.`,
      { option: missingOption },
    );
    const result = fail(failure.exitCode, failure.cliError);
    return args.includes("--json")
      ? projectJson(result)
      : projectHuman(result, (data) => String(data));
  }

  program
    .name(cliName)
    .description("Project-oriented TypeScript CLI template")
    .version("0.0.0")
    .exitOverride()
    .configureOutput({
      writeOut: () => undefined,
      writeErr: () => undefined,
    });

  program
    .command("init")
    .argument("[path]")
    .option("--force", "overwrite existing config")
    .option("--json", "write JSON output")
    .action(
      async (
        path: string | undefined,
        commandOptions: { force?: boolean; json?: boolean },
      ) => {
        await capture(
          state,
          commandOptions.json,
          (data) => {
            const init = data as { projectRoot: string; configPath: string };
            return `Initialized ${packageName} project at ${init.projectRoot}\nConfig: ${init.configPath}\n`;
          },
          () =>
            initCommand({
              cwd,
              path,
              force: commandOptions.force,
            }),
        );
      },
    );

  addProjectOptions(program.command("status")).action(
    async (commandOptions: { project?: string; json?: boolean }) => {
      await capture(state, commandOptions.json, formatStatus, () =>
        statusCommand({ cwd, project: commandOptions.project }),
      );
    },
  );

  addDiscoveryOptions(
    program
      .command("discover")
      .option("--source <id>", "source id")
      .option("--list", "list discovered files"),
  ).action(
    async (commandOptions: {
      project?: string;
      source?: string;
      list?: boolean;
      json?: boolean;
      respectGitignore?: boolean;
      followSymlinks?: boolean;
      includeHidden?: boolean;
    }) => {
      await capture(
        state,
        commandOptions.json,
        (data) => formatDiscover(data, commandOptions.list ?? false),
        () =>
          discoverCommand({
            cwd,
            project: commandOptions.project,
            source: commandOptions.source,
            list: commandOptions.list,
            discoveryOverrides: discoveryOverrides(commandOptions),
          }),
      );
    },
  );

  addDiscoveryOptions(
    program.command("scan").option("--source <id>", "source id"),
  ).action(
    async (commandOptions: {
      project?: string;
      source?: string;
      json?: boolean;
      respectGitignore?: boolean;
      followSymlinks?: boolean;
      includeHidden?: boolean;
    }) => {
      await capture(state, commandOptions.json, formatScan, () =>
        scanCommand({
          cwd,
          project: commandOptions.project,
          source: commandOptions.source,
          discoveryOverrides: discoveryOverrides(commandOptions),
        }),
      );
    },
  );

  const config = program.command("config");
  addDiscoveryOptions(config.command("print")).action(
    async (commandOptions: {
      project?: string;
      json?: boolean;
      respectGitignore?: boolean;
      followSymlinks?: boolean;
      includeHidden?: boolean;
    }) => {
      await capture(state, commandOptions.json, formatConfigPrint, () =>
        configPrintCommand({
          cwd,
          project: commandOptions.project,
          discoveryOverrides: discoveryOverrides(commandOptions),
        }),
      );
    },
  );

  addDiscoveryOptions(program.command("doctor")).action(
    async (commandOptions: {
      project?: string;
      json?: boolean;
      respectGitignore?: boolean;
      followSymlinks?: boolean;
      includeHidden?: boolean;
    }) => {
      await capture(state, commandOptions.json, formatDoctor, () =>
        doctorCommand({
          cwd,
          project: commandOptions.project,
          discoveryOverrides: discoveryOverrides(commandOptions),
        }),
      );
    },
  );

  try {
    await program.parseAsync(args, { from: "user" });
    return toRunResult(state);
  } catch (error) {
    if (isCliFailure(error)) {
      const result = fail(error.exitCode, error.cliError);
      return state.json || args.includes("--json")
        ? projectJson(result)
        : projectHuman(result, (data) => String(data));
    }
    if (
      error instanceof CommanderError ||
      error instanceof InvalidArgumentError
    ) {
      const failure = usageFailure(error);
      const result = fail(failure.exitCode, failure.cliError);
      return args.includes("--json")
        ? projectJson(result)
        : projectHuman(result, (data) => String(data));
    }
    const failure = createError(
      "INTERNAL_ERROR",
      "Unexpected runtime failure.",
      {
        reason: error instanceof Error ? error.message : String(error),
      },
    );
    return args.includes("--json")
      ? projectJson(fail(failure.exitCode, failure.cliError))
      : projectHuman(fail(failure.exitCode, failure.cliError), (data) =>
          String(data),
        );
  }
}
