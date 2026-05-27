use std::collections::HashSet;
use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::json;

use super::errors::{CliErrorCode, CliResult, fail};
use super::project::ProjectContext;

#[derive(Clone, Debug, Deserialize)]
struct RawConfig {
    #[serde(default)]
    discovery: RawDiscovery,
    sources: Vec<RawSource>,
}

#[derive(Clone, Debug, Deserialize)]
struct RawDiscovery {
    #[serde(default = "default_true")]
    respect_gitignore: bool,
    #[serde(default)]
    follow_symlinks: bool,
    #[serde(default)]
    include_hidden: bool,
}

#[derive(Clone, Debug, Deserialize)]
struct RawSource {
    id: String,
    root: String,
    include: Vec<String>,
    #[serde(default)]
    exclude: Vec<String>,
    scanner: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryConfig {
    pub respect_gitignore: bool,
    pub follow_symlinks: bool,
    pub include_hidden: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct SourceConfig {
    pub id: String,
    pub root: String,
    pub include: Vec<String>,
    pub exclude: Vec<String>,
    pub scanner: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct NormalizedConfig {
    pub discovery: DiscoveryConfig,
    pub sources: Vec<SourceConfig>,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct DiscoveryOverrides {
    pub respect_gitignore: Option<bool>,
    pub follow_symlinks: Option<bool>,
    pub include_hidden: Option<bool>,
}

fn default_true() -> bool {
    true
}

impl Default for RawDiscovery {
    fn default() -> Self {
        Self {
            respect_gitignore: true,
            follow_symlinks: false,
            include_hidden: false,
        }
    }
}

fn is_source_id(value: &str) -> bool {
    let mut chars = value.chars();
    matches!(chars.next(), Some(first) if first.is_ascii_alphabetic())
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn contains_parent(path: &str) -> bool {
    path.split('/').any(|segment| segment == "..")
}

fn validate_config(raw: RawConfig) -> CliResult<NormalizedConfig> {
    if raw.sources.is_empty() {
        return Err(fail(
            CliErrorCode::ConfigInvalid,
            "Config must define at least one source.",
            None,
        ));
    }
    let mut seen = HashSet::new();
    let mut sources = Vec::new();
    for source in raw.sources {
        let invalid = !is_source_id(&source.id)
            || !seen.insert(source.id.clone())
            || source.root.is_empty()
            || source.root.contains('\\')
            || Path::new(&source.root).is_absolute()
            || contains_parent(&source.root)
            || source.include.is_empty()
            || source
                .include
                .iter()
                .any(|p| p.is_empty() || p.contains('\\'))
            || source.exclude.iter().any(|p| p.contains('\\'))
            || source.scanner.is_empty();
        if invalid {
            return Err(fail(
                CliErrorCode::ConfigInvalid,
                "Config schema validation failed.",
                Some(json!({ "sourceId": source.id })),
            ));
        }
        sources.push(SourceConfig {
            id: source.id,
            root: source.root,
            include: source.include,
            exclude: source.exclude,
            scanner: source.scanner,
        });
    }

    Ok(NormalizedConfig {
        discovery: DiscoveryConfig {
            respect_gitignore: raw.discovery.respect_gitignore,
            follow_symlinks: raw.discovery.follow_symlinks,
            include_hidden: raw.discovery.include_hidden,
        },
        sources,
    })
}

pub fn load_config(context: &ProjectContext) -> CliResult<NormalizedConfig> {
    let text = fs::read_to_string(&context.config_path).map_err(|error| {
        fail(
            CliErrorCode::ConfigReadFailed,
            "Config file could not be read.",
            Some(json!({ "configPath": context.config_path, "reason": error.to_string() })),
        )
    })?;
    let raw = toml::from_str::<RawConfig>(&text).map_err(|error| {
        fail(
            CliErrorCode::ConfigParseFailed,
            "Config file is not valid TOML.",
            Some(json!({ "configPath": context.config_path, "reason": error.to_string() })),
        )
    })?;
    validate_config(raw)
}

pub fn apply_discovery_overrides(
    mut config: NormalizedConfig,
    overrides: DiscoveryOverrides,
) -> NormalizedConfig {
    if let Some(value) = overrides.respect_gitignore {
        config.discovery.respect_gitignore = value;
    }
    if let Some(value) = overrides.follow_symlinks {
        config.discovery.follow_symlinks = value;
    }
    if let Some(value) = overrides.include_hidden {
        config.discovery.include_hidden = value;
    }
    config
}

pub fn serialize_config(config: &NormalizedConfig) -> String {
    let mut output = format!(
        "[discovery]\nrespect_gitignore = {}\nfollow_symlinks = {}\ninclude_hidden = {}\n",
        config.discovery.respect_gitignore,
        config.discovery.follow_symlinks,
        config.discovery.include_hidden
    );
    for source in &config.sources {
        output.push_str("\n[[sources]]\n");
        output.push_str(&format!("id = \"{}\"\n", source.id));
        output.push_str(&format!("root = \"{}\"\n", source.root));
        output.push_str(&format!("include = {:?}\n", source.include));
        output.push_str(&format!("exclude = {:?}\n", source.exclude));
        output.push_str(&format!("scanner = \"{}\"\n", source.scanner));
    }
    output
}
