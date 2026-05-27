use std::path::Path;

use camino::Utf8Path;
use serde::Serialize;

use crate::commands::shared::load_project;
use crate::core::config::DiscoveryOverrides;
use crate::core::discovery::discover_files;
use crate::core::errors::CliResult;
use crate::core::scanners::{ScannerResult, scan_source};

#[derive(Serialize)]
pub struct ScanTotals {
    pub sources: usize,
    pub files: usize,
    pub bytes: u64,
    pub lines: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanData {
    pub project_root: String,
    pub config_path: String,
    pub results: Vec<ScannerResult>,
    pub totals: ScanTotals,
}

pub fn scan_command(
    cwd: &Utf8Path,
    project: Option<&Path>,
    source: Option<&str>,
    overrides: DiscoveryOverrides,
) -> CliResult<ScanData> {
    let (context, config) = load_project(cwd, project, overrides)?;
    let discovery = discover_files(&context, &config, source)?;
    let mut results = Vec::new();
    for source in &discovery.sources {
        results.push(scan_source(&context, source)?);
    }
    let totals = ScanTotals {
        sources: results.len(),
        files: results.iter().map(|result| result.files).sum(),
        bytes: results.iter().map(|result| result.bytes).sum(),
        lines: results.iter().map(|result| result.lines).sum(),
    };
    Ok(ScanData {
        project_root: context.project_root.to_string(),
        config_path: context.config_path.to_string(),
        results,
        totals,
    })
}
