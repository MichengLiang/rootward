# __ROOTWARD_CLI_NAME__

`__ROOTWARD_CLI_NAME__` is a Rootward-generated project-oriented TypeScript CLI.

The CLI stores project configuration in `__ROOTWARD_CONFIG_DIR_NAME__/config.toml`, discovers project roots through `--project <path>` or CWD upward search, expands configured sources, dispatches scanner implementations, and exposes stable human and JSON output.

## Commands

```bash
pnpm install
pnpm build
pnpm dev -- init
pnpm dev -- status
pnpm dev -- discover --json
pnpm dev -- scan --json
pnpm dev -- config print
pnpm dev -- doctor
```

## Project Config

```toml
[discovery]
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
```

Replace scanner implementations in `src/core/scanners.ts` when the generated CLI becomes a concrete business tool.
