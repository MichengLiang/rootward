use std::fs;
use std::path::{Path, PathBuf};

use camino::{Utf8Path, Utf8PathBuf};
use serde::Serialize;
use serde_json::json;

use super::constants::{CONFIG_DIR_NAME, CONFIG_FILE_NAME};
use super::errors::{CliErrorCode, CliResult, fail};

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum DiscoveryMode {
    Explicit,
    CwdUpward,
}

#[derive(Clone, Debug)]
pub struct ProjectContext {
    pub project_root: Utf8PathBuf,
    pub config_dir: Utf8PathBuf,
    pub config_path: Utf8PathBuf,
    pub discovery_mode: DiscoveryMode,
}

fn to_utf8(path: PathBuf) -> CliResult<Utf8PathBuf> {
    Utf8PathBuf::from_path_buf(path).map_err(|path| {
        fail(
            CliErrorCode::InternalError,
            "Path is not valid UTF-8.",
            Some(json!({ "path": path.to_string_lossy() })),
        )
    })
}

pub fn absolutize(cwd: &Utf8Path, path: &Path) -> CliResult<Utf8PathBuf> {
    let joined = if path.is_absolute() {
        path.to_path_buf()
    } else {
        cwd.as_std_path().join(path)
    };
    to_utf8(joined)
}

fn context_for(root: Utf8PathBuf, mode: DiscoveryMode) -> ProjectContext {
    let config_dir = root.join(CONFIG_DIR_NAME);
    let config_path = config_dir.join(CONFIG_FILE_NAME);
    ProjectContext {
        project_root: root,
        config_dir,
        config_path,
        discovery_mode: mode,
    }
}

pub fn resolve_project(cwd: &Utf8Path, explicit: Option<&Path>) -> CliResult<ProjectContext> {
    if let Some(path) = explicit {
        let root = absolutize(cwd, path)?;
        let context = context_for(root.clone(), DiscoveryMode::Explicit);
        if !context.config_path.exists() {
            return Err(fail(
                CliErrorCode::ProjectConfigNotFound,
                "Project config was not found.",
                Some(json!({ "projectRoot": root })),
            ));
        }
        return Ok(context);
    }

    let mut current = cwd.to_path_buf();
    loop {
        let context = context_for(current.clone(), DiscoveryMode::CwdUpward);
        if context.config_path.exists() {
            return Ok(context);
        }
        if !current.pop() {
            return Err(fail(
                CliErrorCode::ProjectNotFound,
                "Project config was not found from the current directory upward.",
                Some(json!({ "startDirectory": cwd })),
            ));
        }
    }
}

pub fn path_status(path: &Utf8Path) -> &'static str {
    match fs::metadata(path) {
        Ok(metadata) if metadata.is_dir() => "directory",
        Ok(_) => "not-directory",
        Err(_) => "missing",
    }
}
