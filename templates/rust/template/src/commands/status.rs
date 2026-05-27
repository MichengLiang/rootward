use std::path::Path;

use camino::Utf8Path;
use serde::Serialize;

use crate::commands::shared::load_project;
use crate::core::config::DiscoveryOverrides;
use crate::core::errors::CliResult;
use crate::core::project::path_status;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusSource {
    pub id: String,
    pub root: String,
    pub scanner: String,
    pub root_status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusData {
    pub project_root: String,
    pub config_path: String,
    pub discovery_mode: String,
    pub source_count: usize,
    pub sources: Vec<StatusSource>,
}

pub fn status_command(cwd: &Utf8Path, project: Option<&Path>) -> CliResult<StatusData> {
    let (context, config) = load_project(cwd, project, DiscoveryOverrides::default())?;
    let sources = config
        .sources
        .iter()
        .map(|source| {
            let root_path = context.project_root.join(&source.root);
            StatusSource {
                id: source.id.clone(),
                root: source.root.clone(),
                scanner: source.scanner.clone(),
                root_status: path_status(&root_path).to_string(),
            }
        })
        .collect::<Vec<_>>();
    Ok(StatusData {
        project_root: context.project_root.to_string(),
        config_path: context.config_path.to_string(),
        discovery_mode: context.discovery_mode.as_str().to_string(),
        source_count: sources.len(),
        sources,
    })
}
