use std::ffi::OsString;
use std::path::PathBuf;

use camino::Utf8PathBuf;
use clap::{Args, Parser, Subcommand};

use crate::commands::config_print::config_print_command;
use crate::commands::discover::discover_command;
use crate::commands::doctor::doctor_command;
use crate::commands::init::init_command;
use crate::commands::scan::scan_command;
use crate::commands::status::status_command;
use crate::core::config::DiscoveryOverrides;
use crate::core::constants::CLI_NAME;
use crate::core::errors::{CliErrorCode, CliFailure, fail};
use crate::io::output::{
    format_config, format_discover, format_doctor, format_scan, format_status, human_failure,
    human_success, json_failure, json_success,
};

pub struct CliRunResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Parser)]
#[command(name = CLI_NAME, version = "0.0.0")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Init(InitArgs),
    Status(ProjectArgs),
    Discover(DiscoverArgs),
    Scan(ScanArgs),
    Config(ConfigArgs),
    Doctor(DiscoveryArgs),
}

#[derive(Args)]
struct InitArgs {
    path: Option<PathBuf>,
    #[arg(long)]
    force: bool,
    #[arg(long)]
    json: bool,
}

#[derive(Args)]
struct ProjectArgs {
    #[arg(long)]
    project: Option<PathBuf>,
    #[arg(long)]
    json: bool,
}

#[derive(Args)]
struct DiscoveryArgs {
    #[arg(long)]
    project: Option<PathBuf>,
    #[arg(long = "no-respect-gitignore", action = clap::ArgAction::SetFalse, default_value_t = true)]
    respect_gitignore: bool,
    #[arg(long)]
    follow_symlinks: bool,
    #[arg(long)]
    include_hidden: bool,
    #[arg(long)]
    json: bool,
}

#[derive(Args)]
struct DiscoverArgs {
    #[command(flatten)]
    discovery: DiscoveryArgs,
    #[arg(long)]
    source: Option<String>,
    #[arg(long)]
    list: bool,
}

#[derive(Args)]
struct ScanArgs {
    #[command(flatten)]
    discovery: DiscoveryArgs,
    #[arg(long)]
    source: Option<String>,
}

#[derive(Args)]
struct ConfigArgs {
    #[command(subcommand)]
    command: ConfigCommands,
}

#[derive(Subcommand)]
enum ConfigCommands {
    Print(DiscoveryArgs),
}

fn has_json(args: &[OsString]) -> bool {
    args.iter().any(|arg| arg == "--json")
}

fn has_missing_option_value(args: &[OsString]) -> Option<&'static str> {
    for (index, arg) in args.iter().enumerate() {
        if arg == "--project" || arg == "--source" {
            let next = args.get(index + 1);
            if next.is_none_or(|next| next.to_string_lossy().starts_with('-')) {
                return if arg == "--project" {
                    Some("--project")
                } else {
                    Some("--source")
                };
            }
        }
    }
    None
}

fn discovery_overrides(args: &DiscoveryArgs) -> DiscoveryOverrides {
    DiscoveryOverrides {
        respect_gitignore: (!args.respect_gitignore).then_some(false),
        follow_symlinks: args.follow_symlinks.then_some(true),
        include_hidden: args.include_hidden.then_some(true),
    }
}

fn cwd_to_utf8(cwd: Result<PathBuf, std::io::Error>) -> Result<Utf8PathBuf, CliFailure> {
    let cwd = cwd.map_err(|error| {
        fail(
            CliErrorCode::InternalError,
            "Current directory could not be read.",
            Some(serde_json::json!({ "reason": error.to_string() })),
        )
    })?;
    Utf8PathBuf::from_path_buf(cwd).map_err(|path| {
        fail(
            CliErrorCode::InternalError,
            "Current directory is not valid UTF-8.",
            Some(serde_json::json!({ "path": path.to_string_lossy() })),
        )
    })
}

fn failure_result(failure: CliFailure, json: bool) -> CliRunResult {
    if json {
        json_failure(failure.exit_code, &failure.error)
    } else {
        human_failure(failure.exit_code, &failure.error)
    }
}

pub fn run_cli<I, E>(args: I, cwd: Result<PathBuf, std::io::Error>) -> CliRunResult
where
    I: IntoIterator<Item = E>,
    E: Into<OsString>,
{
    let args = args.into_iter().map(Into::into).collect::<Vec<_>>();
    let json = has_json(&args);
    if let Some(option) = has_missing_option_value(&args) {
        return failure_result(
            fail(
                CliErrorCode::UsageError,
                format!("Option \"{option}\" argument is missing."),
                Some(serde_json::json!({ "option": option })),
            ),
            json,
        );
    }
    let cwd = match cwd_to_utf8(cwd) {
        Ok(cwd) => cwd,
        Err(failure) => return failure_result(failure, json),
    };

    let cli = match Cli::try_parse_from(args) {
        Ok(cli) => cli,
        Err(error) => {
            return failure_result(
                fail(
                    CliErrorCode::UsageError,
                    error.to_string(),
                    Some(serde_json::json!({ "code": error.kind().to_string() })),
                ),
                json,
            );
        }
    };

    match cli.command {
        Commands::Init(args) => match init_command(&cwd, args.path.as_deref(), args.force) {
            Ok(data) if args.json => json_success(&data),
            Ok(data) => human_success(format!(
                "Initialized {CLI_NAME} project at {}\nConfig: {}\n",
                data.project_root, data.config_path
            )),
            Err(failure) => failure_result(failure, args.json),
        },
        Commands::Status(args) => match status_command(&cwd, args.project.as_deref()) {
            Ok(data) if args.json => json_success(&data),
            Ok(data) => human_success(format_status(&data)),
            Err(failure) => failure_result(failure, args.json),
        },
        Commands::Discover(args) => {
            let overrides = discovery_overrides(&args.discovery);
            match discover_command(
                &cwd,
                args.discovery.project.as_deref(),
                args.source.as_deref(),
                overrides,
            ) {
                Ok(data) if args.discovery.json => json_success(&data),
                Ok(data) => human_success(format_discover(&data, args.list)),
                Err(failure) => failure_result(failure, args.discovery.json),
            }
        }
        Commands::Scan(args) => {
            let overrides = discovery_overrides(&args.discovery);
            match scan_command(
                &cwd,
                args.discovery.project.as_deref(),
                args.source.as_deref(),
                overrides,
            ) {
                Ok(data) if args.discovery.json => json_success(&data),
                Ok(data) => human_success(format_scan(&data)),
                Err(failure) => failure_result(failure, args.discovery.json),
            }
        }
        Commands::Config(args) => match args.command {
            ConfigCommands::Print(args) => {
                let overrides = discovery_overrides(&args);
                match config_print_command(&cwd, args.project.as_deref(), overrides) {
                    Ok(data) if args.json => json_success(&data),
                    Ok(data) => human_success(format_config(&data)),
                    Err(failure) => failure_result(failure, args.json),
                }
            }
        },
        Commands::Doctor(args) => {
            let overrides = discovery_overrides(&args);
            match doctor_command(&cwd, args.project.as_deref(), overrides) {
                Ok(data) if args.json => json_success(&data),
                Ok(data) => human_success(format_doctor(&data)),
                Err(failure) => failure_result(failure, args.json),
            }
        }
    }
}
