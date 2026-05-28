use std::fs;
use std::path::Path;
use std::process::Command;

use assert_cmd::cargo::cargo_bin;
use assert_fs::TempDir;
use serde_json::Value;

const CONFIG_DIR_NAME: &str = ".rootward-token-config-dir-name";
const RUNTIME_GITIGNORE: &str = "*\n!.gitignore\n";
const DEFAULT_CONFIG_TOML: &str = r#"[discovery]
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

struct TempProject {
    root: TempDir,
}

impl TempProject {
    fn new() -> Self {
        let root = TempDir::new().unwrap();
        Self { root }
    }

    fn path(&self) -> &Path {
        self.root.path()
    }

    fn write(&self, relative_path: &str, content: &str) {
        let path = self.path().join(relative_path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    fn mkdir(&self, relative_path: &str) {
        fs::create_dir_all(self.path().join(relative_path)).unwrap();
    }

    fn write_config(&self, content: &str) {
        self.write(&format!("{CONFIG_DIR_NAME}/config.toml"), content);
    }

    fn initialized(files: &[(&str, &str)]) -> Self {
        let project = Self::new();
        let output = run_cli(["init"], project.path());
        assert_eq!(output.status.code(), Some(0));
        for (path, content) in files {
            project.write(path, content);
        }
        project
    }
}

struct CliOutput {
    status: std::process::ExitStatus,
    stdout: String,
    stderr: String,
}

fn run_cli<I, S>(args: I, cwd: &Path) -> CliOutput
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
{
    let output = Command::new(cargo_bin("rootward-token-bin-name"))
        .args(args)
        .current_dir(cwd)
        .output()
        .unwrap();
    CliOutput {
        status: output.status,
        stdout: String::from_utf8(output.stdout).unwrap(),
        stderr: String::from_utf8(output.stderr).unwrap(),
    }
}

fn json_stdout(output: &CliOutput) -> Value {
    serde_json::from_str(&output.stdout).unwrap()
}

fn json_stderr(output: &CliOutput) -> Value {
    serde_json::from_str(&output.stderr).unwrap()
}

#[test]
fn init_creates_config_cache_and_state() {
    let project = TempProject::new();

    let output = run_cli(["init", "--json"], project.path());

    assert_eq!(output.status.code(), Some(0));
    assert_eq!(output.stderr, "");
    assert_eq!(
        json_stdout(&output),
        serde_json::json!({
            "ok": true,
            "data": {
                "projectRoot": project.path(),
                "configDir": project.path().join(CONFIG_DIR_NAME),
                "configPath": project.path().join(CONFIG_DIR_NAME).join("config.toml"),
                "created": ["config", "cache", "state"],
                "overwritten": false
            }
        })
    );
    assert_eq!(
        fs::read_to_string(project.path().join(CONFIG_DIR_NAME).join("config.toml")).unwrap(),
        DEFAULT_CONFIG_TOML
    );
    assert_eq!(
        fs::read_to_string(
            project
                .path()
                .join(CONFIG_DIR_NAME)
                .join("cache/.gitignore")
        )
        .unwrap(),
        RUNTIME_GITIGNORE
    );
    assert_eq!(
        fs::read_to_string(
            project
                .path()
                .join(CONFIG_DIR_NAME)
                .join("state/.gitignore")
        )
        .unwrap(),
        RUNTIME_GITIGNORE
    );
}

#[test]
fn init_rejects_repeated_or_invalid_targets_and_force_overwrites() {
    let project = TempProject::initialized(&[]);
    project.write(&format!("{CONFIG_DIR_NAME}/config.toml"), "broken = true\n");
    let file_target = project.path().join("target.txt");
    fs::write(&file_target, "not a directory\n").unwrap();

    let repeated = run_cli(["init", "--json"], project.path());
    let forced = run_cli(["init", "--force"], project.path());
    let fresh_force_project = TempProject::new();
    let fresh_force = run_cli(["init", "--force", "--json"], fresh_force_project.path());
    let existing_runtime_dirs = TempProject::new();
    existing_runtime_dirs.mkdir(&format!("{CONFIG_DIR_NAME}/cache"));
    existing_runtime_dirs.mkdir(&format!("{CONFIG_DIR_NAME}/state"));
    let existing_runtime_dirs_init = run_cli(["init", "--json"], existing_runtime_dirs.path());
    let missing = run_cli(["init", "missing", "--json"], project.path());
    let file_target_arg = file_target.to_string_lossy().to_string();
    let not_directory = run_cli(["init", &file_target_arg, "--json"], project.path());

    assert_eq!(repeated.status.code(), Some(3));
    assert_eq!(
        json_stderr(&repeated)["error"]["code"],
        "PROJECT_ALREADY_INITIALIZED"
    );
    assert_eq!(forced.status.code(), Some(0));
    assert_eq!(
        fs::read_to_string(project.path().join(CONFIG_DIR_NAME).join("config.toml")).unwrap(),
        DEFAULT_CONFIG_TOML
    );
    assert_eq!(fresh_force.status.code(), Some(0));
    assert_eq!(json_stdout(&fresh_force)["data"]["overwritten"], false);
    assert_eq!(
        json_stdout(&existing_runtime_dirs_init)["data"]["created"],
        serde_json::json!(["config"])
    );
    assert_eq!(missing.status.code(), Some(3));
    assert_eq!(
        json_stderr(&missing)["error"]["code"],
        "INIT_TARGET_INVALID"
    );
    assert_eq!(not_directory.status.code(), Some(3));
    assert_eq!(
        json_stderr(&not_directory)["error"]["code"],
        "INIT_TARGET_INVALID"
    );
}

#[test]
fn locates_projects_from_root_child_and_explicit_project() {
    let project = TempProject::initialized(&[]);
    project.mkdir("docs/nested");
    let other = TempProject::new();

    let from_root = run_cli(["status", "--json"], project.path());
    let from_child = run_cli(["status", "--json"], &project.path().join("docs/nested"));
    let root_arg = project.path().to_string_lossy().to_string();
    let explicit = run_cli(["status", "--project", &root_arg, "--json"], other.path());

    assert_eq!(from_root.status.code(), Some(0));
    assert_eq!(
        json_stdout(&from_root)["data"]["discoveryMode"],
        "cwd-upward"
    );
    assert_eq!(json_stdout(&from_root)["data"]["sourceCount"], 2);
    assert_eq!(json_stdout(&from_child)["data"]["projectRoot"], root_arg);
    assert_eq!(json_stdout(&explicit)["data"]["discoveryMode"], "explicit");
}

#[test]
fn returns_stable_project_discovery_errors() {
    let project = TempProject::new();
    project.mkdir("wrong");
    let wrong_arg = project.path().join("wrong").to_string_lossy().to_string();

    let upward = run_cli(["status", "--json"], project.path());
    let explicit = run_cli(
        ["status", "--project", &wrong_arg, "--json"],
        project.path(),
    );

    assert_eq!(upward.status.code(), Some(3));
    assert_eq!(json_stderr(&upward)["error"]["code"], "PROJECT_NOT_FOUND");
    assert_eq!(explicit.status.code(), Some(3));
    assert_eq!(
        json_stderr(&explicit)["error"]["code"],
        "PROJECT_CONFIG_NOT_FOUND"
    );
}

#[test]
fn maps_config_parse_and_semantic_errors() {
    let parse_project = TempProject::new();
    parse_project.write_config("[discovery\n");
    let invalid_project = TempProject::new();
    invalid_project.write_config(
        r#"[discovery]
respect_gitignore = true
follow_symlinks = false
include_hidden = false

[[sources]]
id = "docs"
root = "/outside"
include = ["**/*.md"]
exclude = []
scanner = "text"
"#,
    );

    let parse = run_cli(["status", "--json"], parse_project.path());
    let invalid = run_cli(["status", "--json"], invalid_project.path());

    assert_eq!(parse.status.code(), Some(4));
    assert_eq!(json_stderr(&parse)["error"]["code"], "CONFIG_PARSE_FAILED");
    assert_eq!(invalid.status.code(), Some(4));
    assert_eq!(json_stderr(&invalid)["error"]["code"], "CONFIG_INVALID");
}

#[test]
fn validates_duplicate_traversing_and_backslash_config_fields() {
    let invalid_configs = [
        DEFAULT_CONFIG_TOML.replace("id = \"python\"", "id = \"docs\""),
        DEFAULT_CONFIG_TOML.replace("id = \"docs\"", "id = \"1docs\""),
        DEFAULT_CONFIG_TOML.replace("root = \"docs\"", "root = \"\""),
        DEFAULT_CONFIG_TOML.replace("root = \"docs\"", "root = \"/outside\""),
        DEFAULT_CONFIG_TOML.replace("root = \"docs\"", "root = \"docs/../src\""),
        DEFAULT_CONFIG_TOML.replace("root = \"docs\"", "root = \"docs\\\\nested\""),
        DEFAULT_CONFIG_TOML.replace("include = [\"**/*.{md,mdx,rst,adoc,txt}\"]", "include = []"),
        DEFAULT_CONFIG_TOML.replace(
            "include = [\"**/*.{md,mdx,rst,adoc,txt}\"]",
            "include = [\"**\\\\*.md\"]",
        ),
        DEFAULT_CONFIG_TOML.replace("exclude = []", "exclude = [\"private\\\\**\"]"),
        DEFAULT_CONFIG_TOML.replace("scanner = \"text\"", "scanner = \"\""),
    ];

    for config in invalid_configs {
        let project = TempProject::new();
        project.write_config(&config);
        let output = run_cli(["config", "print", "--json"], project.path());
        assert_eq!(output.status.code(), Some(4));
        assert_eq!(json_stderr(&output)["error"]["code"], "CONFIG_INVALID");
    }
}

#[test]
fn discovers_included_files_excludes_files_and_filters_by_source() {
    let project = TempProject::initialized(&[
        ("docs/index.md", "hello\n"),
        ("docs/private/skip.md", "skip\n"),
        ("src/main.py", "print('hi')\n"),
    ]);
    project
        .write_config(&DEFAULT_CONFIG_TOML.replace("exclude = []", "exclude = [\"private/**\"]"));

    let output = run_cli(
        ["discover", "--source", "docs", "--list", "--json"],
        project.path(),
    );

    assert_eq!(output.status.code(), Some(0));
    let json = json_stdout(&output);
    assert_eq!(json["data"]["totalFiles"], 1);
    assert_eq!(
        json["data"]["sources"][0]["files"][0]["path"],
        "docs/index.md"
    );
    assert!(!output.stdout.contains("private/skip.md"));
    assert!(!output.stdout.contains("src/main.py"));
}

#[test]
fn applies_gitignore_hidden_and_symlink_discovery_rules() {
    let project = TempProject::initialized(&[
        ("docs/visible.md", "visible\n"),
        ("docs/ignored.md", "ignored\n"),
        ("docs/nested/hidden.md", "nested\n"),
        ("docs/nested/visible.md", "nested\n"),
        ("docs/.hidden.md", "hidden\n"),
        (".gitignore", "docs/ignored.md\n"),
        ("docs/nested/.gitignore", "hidden.md\n"),
    ]);

    let defaults = run_cli(
        ["discover", "--source", "docs", "--list", "--json"],
        project.path(),
    );
    let overridden = run_cli(
        [
            "discover",
            "--source",
            "docs",
            "--list",
            "--no-respect-gitignore",
            "--include-hidden",
            "--json",
        ],
        project.path(),
    );

    assert!(defaults.stdout.contains("docs/visible.md"));
    assert!(defaults.stdout.contains("docs/nested/visible.md"));
    assert!(!defaults.stdout.contains("docs/ignored.md"));
    assert!(!defaults.stdout.contains("docs/nested/hidden.md"));
    assert!(!defaults.stdout.contains("docs/.hidden.md"));
    assert!(overridden.stdout.contains("docs/ignored.md"));
    assert!(overridden.stdout.contains("docs/nested/hidden.md"));
    assert!(overridden.stdout.contains("docs/.hidden.md"));

    let external = TempProject::new();
    external.write("external.md", "outside\n");
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(
            external.path().join("external.md"),
            project.path().join("docs/external.md"),
        )
        .unwrap();
        std::os::unix::fs::symlink(
            project.path().join("docs/visible.md"),
            project.path().join("docs/linked.md"),
        )
        .unwrap();
    }

    let no_follow = run_cli(
        ["discover", "--source", "docs", "--list", "--json"],
        project.path(),
    );
    let follow = run_cli(
        [
            "discover",
            "--source",
            "docs",
            "--list",
            "--follow-symlinks",
            "--json",
        ],
        project.path(),
    );

    assert!(!no_follow.stdout.contains("docs/linked.md"));
    assert!(!no_follow.stdout.contains("docs/external.md"));
    assert!(!follow.stdout.contains("external.md"));
}

#[test]
fn ignores_ancestor_gitignore_outside_project_root() {
    let ancestor = TempProject::new();
    ancestor.write(".gitignore", "nested/docs/ancestor-ignored.md\n");
    let project_root = ancestor.path().join("nested");
    ancestor.write(
        &format!("nested/{CONFIG_DIR_NAME}/config.toml"),
        DEFAULT_CONFIG_TOML,
    );
    ancestor.write("nested/docs/ancestor-ignored.md", "must stay visible\n");
    ancestor.write("nested/docs/project-ignored.md", "project ignored\n");
    ancestor.write("nested/.gitignore", "docs/project-ignored.md\n");

    let output = run_cli(
        ["discover", "--source", "docs", "--list", "--json"],
        &project_root,
    );

    assert_eq!(output.status.code(), Some(0));
    assert!(output.stdout.contains("docs/ancestor-ignored.md"));
    assert!(!output.stdout.contains("docs/project-ignored.md"));
}

#[test]
fn discovers_empty_sources_and_stable_source_errors() {
    let project = TempProject::initialized(&[]);
    project.mkdir("docs");
    project.mkdir("src");

    let empty = run_cli(["discover", "--json"], project.path());
    let missing_source = run_cli(
        ["discover", "--source", "missing", "--json"],
        project.path(),
    );
    fs::remove_dir_all(project.path().join("docs")).unwrap();
    let missing_root = run_cli(["discover", "--source", "docs", "--json"], project.path());

    assert_eq!(empty.status.code(), Some(0));
    assert_eq!(json_stdout(&empty)["data"]["totalFiles"], 0);
    assert_eq!(missing_source.status.code(), Some(4));
    assert_eq!(
        json_stderr(&missing_source)["error"]["code"],
        "SOURCE_NOT_FOUND"
    );
    assert_eq!(missing_root.status.code(), Some(5));
    assert_eq!(
        json_stderr(&missing_root)["error"]["code"],
        "SOURCE_ROOT_NOT_FOUND"
    );
}

#[test]
fn scans_sources_and_reports_unregistered_scanners() {
    let project = TempProject::initialized(&[
        ("docs/index.md", "hello\nworld\n"),
        ("src/main.py", "print('hi')\n"),
    ]);

    let scan = run_cli(["scan", "--json"], project.path());
    assert_eq!(scan.status.code(), Some(0));
    assert_eq!(json_stdout(&scan)["data"]["totals"]["files"], 2);
    assert_eq!(json_stdout(&scan)["data"]["totals"]["bytes"], 24);
    assert_eq!(json_stdout(&scan)["data"]["totals"]["lines"], 3);

    project
        .write_config(&DEFAULT_CONFIG_TOML.replace("scanner = \"text\"", "scanner = \"unknown\""));
    let unknown = run_cli(["scan", "--source", "docs", "--json"], project.path());
    assert_eq!(unknown.status.code(), Some(5));
    assert_eq!(
        json_stderr(&unknown)["error"]["code"],
        "SCANNER_NOT_REGISTERED"
    );
}

#[test]
fn doctor_reports_config_warnings_and_errors_with_diagnostics() {
    let empty = TempProject::initialized(&[]);
    empty.mkdir("docs");
    empty.mkdir("src");
    let warning = run_cli(["doctor", "--json"], empty.path());
    assert_eq!(warning.status.code(), Some(0));
    assert_eq!(
        json_stdout(&warning)["data"]["diagnostics"][0]["code"],
        "CONFIG_OK"
    );
    assert!(
        json_stdout(&warning)["data"]["diagnostics"]
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item["code"] == "SOURCE_EMPTY")
    );

    let missing = TempProject::initialized(&[]);
    let missing_result = run_cli(["doctor", "--json"], missing.path());
    assert_eq!(missing_result.status.code(), Some(5));
    assert_eq!(
        json_stderr(&missing_result)["error"]["details"]["diagnostics"][0]["code"],
        "CONFIG_OK"
    );
    assert!(
        json_stderr(&missing_result)["error"]["details"]["diagnostics"]
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item["code"] == "SOURCE_ROOT_NOT_FOUND")
    );
}

#[test]
fn config_print_applies_discovery_overrides() {
    let project = TempProject::initialized(&[]);

    let output = run_cli(
        [
            "config",
            "print",
            "--no-respect-gitignore",
            "--follow-symlinks",
            "--include-hidden",
            "--json",
        ],
        project.path(),
    );

    assert_eq!(output.status.code(), Some(0));
    assert_eq!(
        json_stdout(&output)["data"]["discovery"],
        serde_json::json!({
            "respectGitignore": false,
            "followSymlinks": true,
            "includeHidden": true
        })
    );
}

#[test]
fn config_print_human_output_is_parseable_toml() {
    let project = TempProject::initialized(&[]);
    project.write_config(
        r#"[discovery]
respect_gitignore = true
follow_symlinks = false
include_hidden = false

[[sources]]
id = "docs"
root = "docs"
include = ["**/*.md", "**/*.txt"]
exclude = ["private/**"]
scanner = "text\"scanner"
"#,
    );

    let output = run_cli(["config", "print"], project.path());

    assert_eq!(output.status.code(), Some(0));
    toml::from_str::<toml::Value>(&output.stdout).unwrap();
}

#[test]
fn config_print_human_output_can_be_read_back_by_cli() {
    let project = TempProject::initialized(&[]);
    let printed = run_cli(
        [
            "config",
            "print",
            "--no-respect-gitignore",
            "--follow-symlinks",
            "--include-hidden",
        ],
        project.path(),
    );
    project.write_config(&printed.stdout);

    let output = run_cli(["config", "print", "--json"], project.path());

    assert_eq!(output.status.code(), Some(0));
    assert_eq!(
        json_stdout(&output)["data"]["discovery"],
        serde_json::json!({
            "respectGitignore": false,
            "followSymlinks": true,
            "includeHidden": true
        })
    );
}

#[cfg(unix)]
#[test]
fn rejects_source_root_symlink_that_escapes_project_root() {
    let project = TempProject::initialized(&[]);
    let external = TempProject::new();
    external.write("outside.md", "outside\n");
    std::os::unix::fs::symlink(external.path(), project.path().join("docs")).unwrap();

    let output = run_cli(["discover", "--source", "docs", "--json"], project.path());

    assert_eq!(output.status.code(), Some(4));
    assert_eq!(json_stderr(&output)["error"]["code"], "CONFIG_INVALID");
}

#[test]
fn doctor_reports_unregistered_scanners_even_when_source_root_is_missing() {
    let project = TempProject::initialized(&[]);
    project
        .write_config(&DEFAULT_CONFIG_TOML.replace("scanner = \"text\"", "scanner = \"unknown\""));

    let output = run_cli(["doctor", "--json"], project.path());
    let error = json_stderr(&output);
    let diagnostics = error["error"]["details"]["diagnostics"]
        .as_array()
        .unwrap()
        .iter()
        .map(|item| item["code"].as_str().unwrap().to_string())
        .collect::<Vec<_>>();

    assert_eq!(output.status.code(), Some(5));
    assert!(diagnostics.contains(&"SOURCE_ROOT_NOT_FOUND".to_string()));
    assert!(diagnostics.contains(&"SCANNER_NOT_REGISTERED".to_string()));
}

#[test]
fn json_output_streams_and_usage_errors_are_stable() {
    let project = TempProject::new();

    let unknown_command = run_cli(["missing", "--json"], project.path());
    let unknown_option = run_cli(["status", "--bad", "--json"], project.path());
    let missing_project = run_cli(["status", "--project", "--json"], project.path());
    let missing_source = run_cli(["discover", "--source", "--json"], project.path());
    let human = run_cli(["discover", "--source"], project.path());

    for output in [
        &unknown_command,
        &unknown_option,
        &missing_project,
        &missing_source,
    ] {
        assert_eq!(output.status.code(), Some(2));
        assert_eq!(output.stdout, "");
        assert_eq!(json_stderr(output)["error"]["code"], "USAGE_ERROR");
    }
    assert_eq!(human.status.code(), Some(2));
    assert!(human.stderr.contains("USAGE_ERROR"));
    assert!(!human.stderr.contains("stack backtrace"));
    assert!(!human.stderr.contains("panicked"));
}
