# rootward-token-cli-name

`rootward-token-cli-name` is a Rootward project-oriented CLI template generated as a Rust Cargo project.

Project configuration lives at `.rootward-token-config-dir-name/config.toml`.

## Commands

```bash
rootward-token-bin-name init
rootward-token-bin-name status --json
rootward-token-bin-name discover --json
rootward-token-bin-name scan --json
rootward-token-bin-name config print --json
rootward-token-bin-name doctor --json
```

Use JSON output for scripts, CI, and editor integrations.

## Verification

```bash
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
cargo build
```
