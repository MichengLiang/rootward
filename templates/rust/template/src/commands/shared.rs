use std::path::Path;

use camino::Utf8Path;

use crate::core::config::{
    DiscoveryOverrides, NormalizedConfig, apply_discovery_overrides, load_config,
};
use crate::core::errors::CliResult;
use crate::core::project::{ProjectContext, resolve_project};

pub fn load_project(
    cwd: &Utf8Path,
    project: Option<&Path>,
    overrides: DiscoveryOverrides,
) -> CliResult<(ProjectContext, NormalizedConfig)> {
    let context = resolve_project(cwd, project)?;
    let config = apply_discovery_overrides(load_config(&context)?, overrides);
    Ok((context, config))
}
