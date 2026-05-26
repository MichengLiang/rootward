# Rootward

Project-oriented CLI templates for TypeScript, Python, Rust, and Go.

Rootward defines a cross-language contract for developer CLIs that need a project context before they run business logic: initialize a hidden tool directory, discover the project root from the current working directory, load project-local TOML configuration, expand source globs, respect `.gitignore`, dispatch scanner registries, and expose stable human and JSON command output.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Docs](https://github.com/MichengLiang/rootward/actions/workflows/pages.yml/badge.svg)](https://github.com/MichengLiang/rootward/actions/workflows/pages.yml)

## What Rootward Is

Rootward is not a general CLI framework and not an application scaffold. It is a contract for project-oriented CLI templates.

The contract fixes the behavior that long-lived project tools repeatedly need:

- `init` creates a tool-owned project context.
- `--project <path>` selects an explicit project root.
- Commands without `--project` discover the project root from CWD upward.
- `.foo/config.toml` is the only default project configuration source.
- `[[sources]]` declares file sets by `id`, `root`, `include`, `exclude`, and `scanner`.
- Discovery produces project-root-relative POSIX paths.
- `discover` projects the tool's file view.
- `scan` dispatches discovered source groups to a scanner registry.
- `doctor` reports project-context health.
- JSON output, error codes, and exit codes are stable public contracts.

## Language Contract Matrix

| Language | Contract status | Template role |
|---|---:|---|
| TypeScript | Specified reference implementation | Node 24, Commander, Zod, smol-toml, globby, Vitest, Biome |
| Python | Specified implementation | uv, Typer, Pydantic v2, tomlkit, wcmatch, pathspec, pytest, Ruff, ty |
| Rust | Specified implementation | clap derive, serde, toml, ignore, thiserror, camino, assert_cmd, assert_fs, insta |
| Go | Specified implementation | Cobra, go-toml/v2, gobwas/glob, go-git gitignore, standard testing |

## Documentation

The primary document is the contract book:

- Source: [`docs/books/06-rootward-project-cli-contract/book.adoc`](docs/books/06-rootward-project-cli-contract/book.adoc)
- Local build output: `docs/build/html/index.html`
- Published site: `https://michengliang.github.io/rootward/`

Build the documentation locally:

```bash
cd docs
pnpm install
pnpm run test
pnpm run build
```

The generated site entry is:

```text
docs/build/html/index.html
```

The site root opens the contract book directly. The generated catalog remains available at:

```text
docs/build/html/catalog.html
```

## Repository Layout

```text
docs/
  catalog.adoc
  books/
    06-rootward-project-cli-contract/
  scripts/
  test/
```

`docs/` is an AsciiDoc book workspace. Build outputs, temporary material, and dependencies are ignored by Git.

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
