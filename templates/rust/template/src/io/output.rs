use serde::Serialize;

use crate::commands::discover::DiscoverData;
use crate::commands::doctor::DoctorData;
use crate::commands::scan::ScanData;
use crate::commands::status::StatusData;
use crate::core::config::{NormalizedConfig, serialize_config};
use crate::core::errors::CliError;

use super::super::cli::CliRunResult;

pub fn json_success<T: Serialize>(data: &T) -> CliRunResult {
    CliRunResult {
        exit_code: 0,
        stdout: format!("{}\n", serde_json::json!({ "ok": true, "data": data })),
        stderr: String::new(),
    }
}

pub fn json_failure(exit_code: i32, error: &CliError) -> CliRunResult {
    CliRunResult {
        exit_code,
        stdout: String::new(),
        stderr: format!("{}\n", serde_json::json!({ "ok": false, "error": error })),
    }
}

pub fn human_failure(exit_code: i32, error: &CliError) -> CliRunResult {
    let details = error
        .details
        .as_ref()
        .map(|details| format!("\nDetails: {details}"))
        .unwrap_or_default();
    let code = serde_json::to_value(error.code)
        .ok()
        .and_then(|value| value.as_str().map(str::to_string))
        .unwrap_or_else(|| format!("{:?}", error.code));
    CliRunResult {
        exit_code,
        stdout: String::new(),
        stderr: format!("{code}: {}{details}\n", error.message),
    }
}

pub fn human_success(stdout: String) -> CliRunResult {
    CliRunResult {
        exit_code: 0,
        stdout,
        stderr: String::new(),
    }
}

pub fn format_status(data: &StatusData) -> String {
    let rows = data
        .sources
        .iter()
        .map(|source| {
            format!(
                "  {}\t{}\t{}\t{}",
                source.id, source.scanner, source.root, source.root_status
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "Project: {}\nConfig:  {}\nMode:    {}\n\nSources:\n{rows}\n",
        data.project_root, data.config_path, data.discovery_mode
    )
}

pub fn format_discover(data: &DiscoverData, list: bool) -> String {
    let rows = data
        .sources
        .iter()
        .map(|source| {
            format!(
                "{}\t{}\t{}\t{}",
                source.id,
                source.scanner,
                source.root,
                source.files.len()
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let listing = if list {
        format!(
            "\n\n{}\n",
            data.sources
                .iter()
                .map(|source| {
                    format!(
                        "{}\n{}",
                        source.id,
                        source
                            .files
                            .iter()
                            .map(|file| format!("  {}", file.path))
                            .collect::<Vec<_>>()
                            .join("\n")
                    )
                })
                .collect::<Vec<_>>()
                .join("\n\n")
        )
    } else {
        "\n".to_string()
    };
    format!(
        "Project: {}\nConfig:  {}\n\nSource\tScanner\tRoot\tFiles\n{rows}{listing}",
        data.project_root, data.config_path
    )
}

pub fn format_config(config: &NormalizedConfig) -> String {
    serialize_config(config)
}

pub fn format_scan(data: &ScanData) -> String {
    let rows = data
        .results
        .iter()
        .map(|result| {
            format!(
                "{}\t{}\t{}\t{}\t{}",
                result.source_id, result.scanner, result.files, result.bytes, result.lines
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "Source\tScanner\tFiles\tBytes\tLines\n{rows}\nTotal\t\t{}\t{}\t{}\n",
        data.totals.files, data.totals.bytes, data.totals.lines
    )
}

pub fn format_doctor(data: &DoctorData) -> String {
    let rows = data
        .diagnostics
        .iter()
        .map(|diagnostic| {
            let source = diagnostic
                .source_id
                .as_ref()
                .map(|source| format!(" {source}"))
                .unwrap_or_default();
            format!(
                "{}\t{}{}\t{}",
                diagnostic.level.to_uppercase(),
                diagnostic.code,
                source,
                diagnostic.message
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    format!("OK\n{rows}\n")
}
