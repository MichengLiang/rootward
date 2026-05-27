# create-rootward

[![npm version](https://img.shields.io/npm/v/create-rootward.svg)](https://www.npmjs.com/package/create-rootward)
[![CI](https://github.com/MichengLiang/rootward/actions/workflows/ci.yml/badge.svg)](https://github.com/MichengLiang/rootward/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/create-rootward.svg)](./LICENSE)
[![Node.js](https://img.shields.io/node/v/create-rootward.svg)](./package.json)

`create-rootward` instantiates Rootward project-oriented CLI templates.

Rootward templates create CLIs that know how to initialize a project context, discover the project root, read project-local TOML configuration, expand source globs, respect `.gitignore`, dispatch scanner registries, and return stable human and JSON output.

## Usage

```bash
pnpm create rootward typescript my-tool --cli-name my-tool --package-name my-tool
```

```bash
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

## Templates

| Template | Status |
|---|---|
| `typescript` | implemented |
| `python` | reserved |
| `rust` | reserved |
| `go` | reserved |

Reserved templates are declared by manifest and return `TEMPLATE_NOT_IMPLEMENTED`.

## Contract

The public contract is maintained in the Rootward book:

- <https://michengliang.github.io/rootward/>
- <https://github.com/MichengLiang/rootward>

## License

Apache-2.0. See [LICENSE](./LICENSE).
