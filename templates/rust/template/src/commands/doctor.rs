use std::fs;
use std::path::Path;

use camino::Utf8Path;
use serde::Serialize;
use serde_json::json;

use crate::commands::shared::load_project;
use crate::core::config::DiscoveryOverrides;
use crate::core::discovery::discover_files;
use crate::core::errors::{CliErrorCode, CliResult, fail};
use crate::core::scanners::is_registered;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub level: String,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DoctorData {
    pub project_root: String,
    pub config_path: String,
    pub diagnostics: Vec<Diagnostic>,
}

pub fn doctor_command(
    cwd: &Utf8Path,
    project: Option<&Path>,
    overrides: DiscoveryOverrides,
) -> CliResult<DoctorData> {
    let (context, config) = load_project(cwd, project, overrides)?;
    let mut diagnostics = vec![Diagnostic {
        level: "info".to_string(),
        code: "CONFIG_OK".to_string(),
        message: "Config is valid.".to_string(),
        source_id: None,
    }];

    for source in &config.sources {
        let root = context.project_root.join(&source.root);
        let root_ok = fs::metadata(&root)
            .map(|metadata| metadata.is_dir())
            .unwrap_or(false);
        let scanner_ok = is_registered(&source.scanner);
        if !root_ok {
            diagnostics.push(Diagnostic {
                level: "error".to_string(),
                code: "SOURCE_ROOT_NOT_FOUND".to_string(),
                message: "Source root is missing.".to_string(),
                source_id: Some(source.id.clone()),
            });
        }
        if !scanner_ok {
            diagnostics.push(Diagnostic {
                level: "error".to_string(),
                code: "SCANNER_NOT_REGISTERED".to_string(),
                message: "Scanner is not registered.".to_string(),
                source_id: Some(source.id.clone()),
            });
        }
        if !root_ok || !scanner_ok {
            continue;
        }
        let discovery = discover_files(&context, &config, Some(&source.id))?;
        if discovery.total_files == 0 {
            diagnostics.push(Diagnostic {
                level: "warning".to_string(),
                code: "SOURCE_EMPTY".to_string(),
                message: "Source matched no files.".to_string(),
                source_id: Some(source.id.clone()),
            });
        }
    }

    if let Some(error) = diagnostics.iter().find(|item| item.level == "error") {
        let code = match error.code.as_str() {
            "SCANNER_NOT_REGISTERED" => CliErrorCode::ScannerNotRegistered,
            _ => CliErrorCode::SourceRootNotFound,
        };
        return Err(fail(
            code,
            error.message.clone(),
            Some(json!({ "diagnostics": diagnostics })),
        ));
    }

    Ok(DoctorData {
        project_root: context.project_root.to_string(),
        config_path: context.config_path.to_string(),
        diagnostics,
    })
}
