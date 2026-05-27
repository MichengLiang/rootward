pub const CRATE_NAME: &str = "rootward_token_crate_name";
pub const CLI_NAME: &str = "rootward-token-cli-name";
pub const CONFIG_DIR_NAME: &str = ".rootward-token-config-dir-name";
pub const CONFIG_FILE_NAME: &str = "config.toml";
pub const RUNTIME_GITIGNORE: &str = "*\n!.gitignore\n";

pub const DEFAULT_CONFIG_TOML: &str = r#"[discovery]
respect_gitignore = true
follow_symlinks = false
include_hidden = false

[[sources]]
id = "docs"
root = "docs"
include = ["**/*.{md,mdx,rst,adoc,txt}"]
exclude = []
scanner = "text"

[[sources]]
id = "python"
root = "src"
include = ["**/*.py"]
exclude = ["**/__pycache__/**"]
scanner = "python"
"#;
