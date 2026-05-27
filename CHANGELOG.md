# Changelog

All notable changes to this project are documented in this file.

This project uses semantic versioning after `0.1.0`.

## 0.1.2 - 2026-05-28

### Added

- Rust template source with Cargo-based project discovery, configuration, discovery, scan, doctor, and stable JSON output.
- Rust Creator identity options for CLI name, config directory name, crate name, and binary target name.
- Rust template verification and Creator smoke checks in the root check suite.

### Changed

- Creator manifest validation rejects prefix-overlapping tokens and identity references that are not declared by the manifest.
- Rust template initialization reports overwrite and created-path JSON fields from actual filesystem state.

### Removed

- Removed the obsolete `.gitkeep` file from the non-empty Rust template source.

## 0.1.1 - 2026-05-27

### Added

- Publish workflow for tag-based npm publishing with provenance and GitHub release creation.
- CI workflow that runs the complete Rootward check suite.
- Pack smoke checks for `create-rootward` npm tarballs.
- Public npm package metadata for `create-rootward`.

### Changed

- Rootward now has one maintainer-visible template source at `templates/`.
- Creator package builds generated template assets into `dist/templates`.
- Contract book now defines repository template source and packaged template asset as separate objects.

### Removed

- Removed the package-local `packages/create-rootward/templates` source copy from the normal repository layout.

## 0.1.0 - 2026-05-26

Initial public contract and TypeScript Creator implementation.

### Added

- Rootward project-oriented CLI contract book.
- TypeScript template source with project discovery, TOML config, source discovery, scanner registry, JSON output, and stable error codes.
- `create-rootward` Creator package implementation.
- Documentation Pages workflow.
