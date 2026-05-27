use std::path::Path;

use camino::Utf8Path;
use serde::Serialize;

use crate::commands::shared::load_project;
use crate::core::config::DiscoveryOverrides;
use crate::core::discovery::{DiscoveredSource, discover_files};
use crate::core::errors::CliResult;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverData {
    pub project_root: String,
    pub config_path: String,
    pub sources: Vec<DiscoveredSource>,
    pub total_files: usize,
}

pub fn discover_command(
    cwd: &Utf8Path,
    project: Option<&Path>,
    source: Option<&str>,
    overrides: DiscoveryOverrides,
) -> CliResult<DiscoverData> {
    let (context, config) = load_project(cwd, project, overrides)?;
    let discovery = discover_files(&context, &config, source)?;
    Ok(DiscoverData {
        project_root: context.project_root.to_string(),
        config_path: context.config_path.to_string(),
        sources: discovery.sources,
        total_files: discovery.total_files,
    })
}
