use std::path::Path;

use camino::Utf8Path;

use crate::commands::shared::load_project;
use crate::core::config::{DiscoveryOverrides, NormalizedConfig};
use crate::core::errors::CliResult;

pub fn config_print_command(
    cwd: &Utf8Path,
    project: Option<&Path>,
    overrides: DiscoveryOverrides,
) -> CliResult<NormalizedConfig> {
    let (_, config) = load_project(cwd, project, overrides)?;
    Ok(config)
}
