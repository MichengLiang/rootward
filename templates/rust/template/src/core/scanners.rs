use std::fs;

use serde::Serialize;
use serde_json::json;

use super::discovery::DiscoveredSource;
use super::errors::{CliErrorCode, CliResult, fail};
use super::project::ProjectContext;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannerResult {
    pub source_id: String,
    pub scanner: String,
    pub files: usize,
    pub bytes: u64,
    pub lines: u64,
}

pub fn is_registered(scanner: &str) -> bool {
    scanner == "text" || scanner == "python"
}

pub fn scan_source(
    context: &ProjectContext,
    source: &DiscoveredSource,
) -> CliResult<ScannerResult> {
    if !is_registered(&source.scanner) {
        return Err(fail(
            CliErrorCode::ScannerNotRegistered,
            "Scanner is not registered.",
            Some(json!({ "sourceId": source.id, "scanner": source.scanner })),
        ));
    }
    let mut bytes = 0_u64;
    let mut lines = 0_u64;
    for file in &source.files {
        let path = context.project_root.join(&file.path);
        let content = fs::read(&path).map_err(|error| {
            fail(
                CliErrorCode::ScanFailed,
                "File could not be scanned.",
                Some(json!({ "path": file.path, "reason": error.to_string() })),
            )
        })?;
        bytes += content.len() as u64;
        let text = String::from_utf8_lossy(&content);
        lines += text.lines().count() as u64;
    }
    Ok(ScannerResult {
        source_id: source.id.clone(),
        scanner: source.scanner.clone(),
        files: source.files.len(),
        bytes,
        lines,
    })
}
