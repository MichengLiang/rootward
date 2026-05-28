use std::fs;
use std::path::Path;

use camino::Utf8Path;
use serde::Serialize;
use serde_json::json;

use crate::core::constants::{
    CONFIG_DIR_NAME, CONFIG_FILE_NAME, DEFAULT_CONFIG_TOML, RUNTIME_GITIGNORE,
};
use crate::core::errors::{CliErrorCode, CliResult, fail};
use crate::core::project::absolutize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitData {
    pub project_root: String,
    pub config_dir: String,
    pub config_path: String,
    pub created: Vec<String>,
    pub overwritten: bool,
}

pub fn init_command(cwd: &Utf8Path, path: Option<&Path>, force: bool) -> CliResult<InitData> {
    let target = match path {
        Some(path) => absolutize(cwd, path)?,
        None => cwd.to_path_buf(),
    };
    let metadata = fs::metadata(&target).map_err(|error| {
        fail(
            CliErrorCode::InitTargetInvalid,
            "Init target must exist and be a directory.",
            Some(json!({ "target": target, "reason": error.to_string() })),
        )
    })?;
    if !metadata.is_dir() {
        return Err(fail(
            CliErrorCode::InitTargetInvalid,
            "Init target must be a directory.",
            Some(json!({ "target": target })),
        ));
    }

    let config_dir = target.join(CONFIG_DIR_NAME);
    let config_path = config_dir.join(CONFIG_FILE_NAME);
    let config_existed = config_path.exists();
    let cache_dir = config_dir.join("cache");
    let state_dir = config_dir.join("state");
    let cache_existed = cache_dir.exists();
    let state_existed = state_dir.exists();

    if config_existed && !force {
        return Err(fail(
            CliErrorCode::ProjectAlreadyInitialized,
            "Project is already initialized.",
            Some(json!({ "configPath": config_path })),
        ));
    }

    let mut created = Vec::new();
    if !config_existed {
        created.push("config".to_string());
    }
    fs::create_dir_all(&config_dir).map_err(|error| {
        fail(
            CliErrorCode::InitTargetInvalid,
            "Config directory could not be created.",
            Some(json!({ "configDir": config_dir, "reason": error.to_string() })),
        )
    })?;
    if !cache_existed {
        created.push("cache".to_string());
    }
    if !state_existed {
        created.push("state".to_string());
    }
    fs::create_dir_all(&cache_dir).map_err(|error| {
        fail(
            CliErrorCode::InitTargetInvalid,
            "Cache directory could not be created.",
            Some(json!({ "cacheDir": cache_dir, "reason": error.to_string() })),
        )
    })?;
    fs::create_dir_all(&state_dir).map_err(|error| {
        fail(
            CliErrorCode::InitTargetInvalid,
            "State directory could not be created.",
            Some(json!({ "stateDir": state_dir, "reason": error.to_string() })),
        )
    })?;
    fs::write(&config_path, DEFAULT_CONFIG_TOML).map_err(|error| {
        fail(
            CliErrorCode::InitTargetInvalid,
            "Config file could not be written.",
            Some(json!({ "configPath": config_path, "reason": error.to_string() })),
        )
    })?;
    fs::write(cache_dir.join(".gitignore"), RUNTIME_GITIGNORE).map_err(|error| {
        fail(
            CliErrorCode::InitTargetInvalid,
            "Cache .gitignore could not be written.",
            Some(json!({ "cacheDir": cache_dir, "reason": error.to_string() })),
        )
    })?;
    fs::write(state_dir.join(".gitignore"), RUNTIME_GITIGNORE).map_err(|error| {
        fail(
            CliErrorCode::InitTargetInvalid,
            "State .gitignore could not be written.",
            Some(json!({ "stateDir": state_dir, "reason": error.to_string() })),
        )
    })?;

    Ok(InitData {
        project_root: target.to_string(),
        config_dir: config_dir.to_string(),
        config_path: config_path.to_string(),
        created,
        overwritten: force && config_existed,
    })
}
