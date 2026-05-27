import { resolve } from "node:path";
import { type FileSystem, nodeFileSystem } from "../io/filesystem";
import type { DiscoveredSource } from "./discovery";
import { createError } from "./errors";

export type ScannerContext = {
  projectRoot: string;
  source: DiscoveredSource;
  fs?: FileSystem | undefined;
};

export type ScannerResult = {
  sourceId: string;
  scanner: string;
  files: number;
  bytes: number;
  lines: number;
};

export type Scanner = (context: ScannerContext) => Promise<ScannerResult>;

export type ScannerRegistry = Record<string, Scanner>;

function countLines(content: string) {
  if (content.length === 0) {
    return 0;
  }
  const newlineMatches = content.match(/\n/g)?.length ?? 0;
  return content.endsWith("\n") ? newlineMatches : newlineMatches + 1;
}

export async function textScanner(
  context: ScannerContext,
): Promise<ScannerResult> {
  let bytes = 0;
  let lines = 0;
  const fs = context.fs ?? nodeFileSystem;

  for (const file of context.source.files) {
    const content = await fs.readText(resolve(context.projectRoot, file.path));
    bytes += Buffer.byteLength(content);
    lines += countLines(content);
  }

  return {
    sourceId: context.source.id,
    scanner: context.source.scanner,
    files: context.source.files.length,
    bytes,
    lines,
  };
}

export const scannerRegistry: ScannerRegistry = {
  text: textScanner,
  python: textScanner,
};

export async function scanSource(
  context: ScannerContext,
  registry: ScannerRegistry = scannerRegistry,
) {
  const scanner = registry[context.source.scanner];
  if (!scanner) {
    throw createError(
      "SCANNER_NOT_REGISTERED",
      `Scanner "${context.source.scanner}" is not registered.`,
      { sourceId: context.source.id, scanner: context.source.scanner },
    );
  }

  try {
    return await scanner(context);
  } catch (error) {
    if (error instanceof Error && error.name === "CliFailure") {
      throw error;
    }
    throw createError("SCAN_FAILED", "Scanner execution failed.", {
      sourceId: context.source.id,
      scanner: context.source.scanner,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
