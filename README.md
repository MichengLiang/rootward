# Rootward

Project-oriented CLI templates for TypeScript, Python, Rust, and Go.

[![npm version](https://img.shields.io/npm/v/create-rootward.svg?cacheSeconds=300&color=blue)](https://www.npmjs.com/package/create-rootward)
[![CI](https://github.com/MichengLiang/rootward/actions/workflows/ci.yml/badge.svg)](https://github.com/MichengLiang/rootward/actions/workflows/ci.yml)
[![Pages](https://github.com/MichengLiang/rootward/actions/workflows/pages.yml/badge.svg)](https://github.com/MichengLiang/rootward/actions/workflows/pages.yml)
[![License](https://img.shields.io/npm/l/create-rootward.svg?cacheSeconds=300)](./LICENSE)
[![Node.js](https://img.shields.io/node/v/create-rootward.svg?cacheSeconds=300)](./packages/create-rootward/package.json)

Rootward defines a cross-language contract for developer CLIs that need a project context before they run business logic: initialize a hidden tool directory, discover the project root from the current working directory, load project-local TOML configuration, expand source globs, respect `.gitignore`, dispatch scanner registries, and expose stable human and JSON command output.

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
| Rust | Specified implementation | clap derive, serde, toml, ignore, globset, thiserror, camino, assert_cmd, assert_fs |
| Go | Specified implementation | Cobra, go-toml/v2, gobwas/glob, go-git gitignore, standard testing |

## Create A CLI

Create a TypeScript Rootward CLI:

```bash
pnpm create rootward typescript my-tool --cli-name my-tool --package-name my-tool
```

Create a Rust Rootward CLI:

```bash
pnpm create rootward rust my-tool --cli-name my-tool --crate-name my_tool_core --bin-name my-tool
```

Equivalent npm entry points:

```bash
npm create rootward typescript my-tool -- --cli-name my-tool --package-name my-tool
npx create-rootward typescript my-tool --cli-name my-tool --package-name my-tool
```

Then run the generated project:

```bash
cd my-tool
pnpm install
pnpm test
pnpm build
pnpm dev -- init
pnpm dev -- discover --json
```

For a generated Rust project:

```bash
cd my-tool
cargo test
cargo build
cargo run -- init
cargo run -- discover --json
```

The TypeScript and Rust templates are implemented. Python and Go template IDs are reserved and return `TEMPLATE_NOT_IMPLEMENTED` until their template sources satisfy the Rootward contract.

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
packages/
  create-rootward/
templates/
  typescript/
  python/
  rust/
  go/
```

`docs/` is an AsciiDoc book workspace. `templates/` is the only maintainer-edited template source. `packages/create-rootward` is the npm Creator package; its build creates `dist/templates` from the repository template source for publishing.

## Development

```bash
pnpm install
pnpm check
```

Useful focused commands:

```bash
pnpm --filter create-rootward test
pnpm --filter create-rootward pack:check
pnpm templates:rust:check
pnpm --dir docs build
```

## Release State

`create-rootward` is prepared for public npm publishing. Tag releases use `v<package-version>`, run the full check suite, publish the Creator package with npm provenance, and create a GitHub release from `CHANGELOG.md`.

Rootward keeps exactly one visible template source in `templates/`. Packaged template assets are generated into `packages/create-rootward/dist/templates` during build and are not maintained by hand.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
