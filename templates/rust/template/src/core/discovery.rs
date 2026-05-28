use std::collections::HashSet;
use std::{fs, io};

use camino::{Utf8Path, Utf8PathBuf};
use globset::{Glob, GlobSet, GlobSetBuilder};
use ignore::WalkBuilder;
use serde::Serialize;
use serde_json::json;

use super::config::{NormalizedConfig, SourceConfig};
use super::errors::{CliErrorCode, CliResult, fail};
use super::project::ProjectContext;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredFile {
    pub path: String,
    pub source_id: String,
    pub scanner: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct DiscoveredSource {
    pub id: String,
    pub root: String,
    pub scanner: String,
    pub include: Vec<String>,
    pub exclude: Vec<String>,
    pub files: Vec<DiscoveredFile>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryResult {
    pub sources: Vec<DiscoveredSource>,
    pub total_files: usize,
}

fn compile_patterns(patterns: &[String], source_id: &str) -> CliResult<GlobSet> {
    let mut builder = GlobSetBuilder::new();
    for pattern in patterns {
        builder.add(Glob::new(pattern).map_err(|error| {
            fail(
                CliErrorCode::ConfigInvalid,
                "Glob pattern is invalid.",
                Some(json!({ "sourceId": source_id, "pattern": pattern, "reason": error.to_string() })),
            )
        })?);
    }
    builder.build().map_err(|error| {
        fail(
            CliErrorCode::ConfigInvalid,
            "Glob pattern set is invalid.",
            Some(json!({ "sourceId": source_id, "reason": error.to_string() })),
        )
    })
}

fn selected_sources<'a>(
    config: &'a NormalizedConfig,
    source_id: Option<&str>,
) -> CliResult<Vec<&'a SourceConfig>> {
    if let Some(id) = source_id {
        let source = config
            .sources
            .iter()
            .find(|source| source.id == id)
            .ok_or_else(|| {
                fail(
                    CliErrorCode::SourceNotFound,
                    format!("Source \"{id}\" is not defined."),
                    Some(json!({ "sourceId": id })),
                )
            })?;
        Ok(vec![source])
    } else {
        Ok(config.sources.iter().collect())
    }
}

fn relative_posix(root: &Utf8Path, path: &Utf8Path) -> CliResult<String> {
    let relative = path.strip_prefix(root).map_err(|error| {
        fail(
            CliErrorCode::DiscoveryFailed,
            "Discovered path could not be made project-relative.",
            Some(json!({ "path": path, "reason": error.to_string() })),
        )
    })?;
    Ok(relative.as_str().replace('\\', "/"))
}

fn is_hidden(path: &str) -> bool {
    path.split('/').any(|segment| segment.starts_with('.'))
}

fn utf8_path(path: &std::path::Path) -> CliResult<Utf8PathBuf> {
    Utf8PathBuf::from_path_buf(path.to_path_buf()).map_err(|path| {
        fail(
            CliErrorCode::DiscoveryFailed,
            "Discovered path is not valid UTF-8.",
            Some(json!({ "path": path.to_string_lossy() })),
        )
    })
}

fn is_inside(root: &Utf8Path, path: &Utf8Path) -> bool {
    path == root || path.starts_with(root)
}

pub fn discover_files(
    context: &ProjectContext,
    config: &NormalizedConfig,
    source_id: Option<&str>,
) -> CliResult<DiscoveryResult> {
    let mut sources = Vec::new();
    let canonical_root = context.project_root.canonicalize_utf8().map_err(|error| {
        fail(
            CliErrorCode::DiscoveryFailed,
            "Project root could not be canonicalized.",
            Some(json!({ "projectRoot": context.project_root, "reason": error.to_string() })),
        )
    })?;

    for source in selected_sources(config, source_id)? {
        let source_root = context.project_root.join(&source.root);
        if !is_inside(&context.project_root, &source_root) {
            return Err(fail(
                CliErrorCode::ConfigInvalid,
                "Source root escapes project root.",
                Some(json!({ "sourceId": source.id, "root": source.root })),
            ));
        }
        let metadata = fs::metadata(&source_root).map_err(|error| {
            if error.kind() == io::ErrorKind::NotFound {
                fail(
                    CliErrorCode::SourceRootNotFound,
                    "Source root does not exist.",
                    Some(json!({ "sourceId": source.id, "root": source.root, "path": source_root })),
                )
            } else {
                fail(
                    CliErrorCode::DiscoveryFailed,
                    "Source root metadata could not be read.",
                    Some(json!({ "sourceId": source.id, "root": source.root, "path": source_root, "reason": error.to_string() })),
                )
            }
        })?;
        if !metadata.is_dir() {
            return Err(fail(
                CliErrorCode::SourceRootNotFound,
                "Source root is not a directory.",
                Some(json!({ "sourceId": source.id, "root": source.root, "path": source_root })),
            ));
        }
        let canonical_source_root = source_root.canonicalize_utf8().map_err(|error| {
            fail(
                CliErrorCode::DiscoveryFailed,
                "Source root could not be canonicalized.",
                Some(json!({ "sourceId": source.id, "root": source.root, "path": source_root, "reason": error.to_string() })),
            )
        })?;
        if !is_inside(&canonical_root, &canonical_source_root) {
            return Err(fail(
                CliErrorCode::ConfigInvalid,
                "Source root escapes project root.",
                Some(json!({ "sourceId": source.id, "root": source.root, "path": source_root })),
            ));
        }

        let include = compile_patterns(&source.include, &source.id)?;
        let exclude = compile_patterns(&source.exclude, &source.id)?;
        let mut builder = WalkBuilder::new(&context.project_root);
        builder
            .hidden(false)
            .follow_links(config.discovery.follow_symlinks)
            .parents(false)
            .require_git(false)
            .git_global(false)
            .git_exclude(false)
            .git_ignore(config.discovery.respect_gitignore);
        if config.discovery.respect_gitignore {
            let project_gitignore = context.project_root.join(".gitignore");
            if project_gitignore.exists() {
                builder.add_ignore(project_gitignore);
            }
        }
        let walker = builder.build();

        let mut files = Vec::new();
        let mut seen = HashSet::new();
        for entry in walker {
            let entry = entry.map_err(|error| {
                fail(
                    CliErrorCode::DiscoveryFailed,
                    "File discovery failed.",
                    Some(json!({ "sourceId": source.id, "reason": error.to_string() })),
                )
            })?;
            let file_type = match entry.file_type() {
                Some(file_type) => file_type,
                None => continue,
            };
            if !file_type.is_file() {
                continue;
            }
            let path = utf8_path(entry.path())?;
            if !is_inside(&source_root, &path) {
                continue;
            }
            if config.discovery.follow_symlinks {
                let real = path.canonicalize_utf8().map_err(|error| {
                    fail(
                        CliErrorCode::DiscoveryFailed,
                        "Discovered path could not be canonicalized.",
                        Some(json!({ "path": path, "reason": error.to_string() })),
                    )
                })?;
                if !is_inside(&canonical_root, &real) {
                    continue;
                }
            }
            let source_relative = relative_posix(&source_root, &path)?;
            let project_relative = relative_posix(&context.project_root, &path)?;
            if !config.discovery.include_hidden && is_hidden(&project_relative) {
                continue;
            }
            if !include.is_match(&source_relative) || exclude.is_match(&source_relative) {
                continue;
            }
            if seen.insert(project_relative.clone()) {
                files.push(DiscoveredFile {
                    path: project_relative,
                    source_id: source.id.clone(),
                    scanner: source.scanner.clone(),
                });
            }
        }
        files.sort_by(|a, b| a.path.cmp(&b.path));
        sources.push(DiscoveredSource {
            id: source.id.clone(),
            root: source.root.clone(),
            scanner: source.scanner.clone(),
            include: source.include.clone(),
            exclude: source.exclude.clone(),
            files,
        });
    }

    Ok(DiscoveryResult {
        total_files: sources.iter().map(|source| source.files.len()).sum(),
        sources,
    })
}
