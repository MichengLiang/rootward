import type { Stats } from "node:fs";
import {
  access,
  lstat,
  mkdir,
  readFile,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";

export type FileSystem = {
  pathExists(path: string): Promise<boolean>;
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
  mkdirp(path: string): Promise<void>;
  stat(path: string): Promise<Stats>;
  lstat(path: string): Promise<Stats>;
  realpath(path: string): Promise<string>;
};

export const nodeFileSystem: FileSystem = {
  async pathExists(path) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  },
  readText(path) {
    return readFile(path, "utf8");
  },
  writeText(path, content) {
    return writeFile(path, content);
  },
  mkdirp(path) {
    return mkdir(path, { recursive: true }).then(() => undefined);
  },
  stat(path) {
    return stat(path);
  },
  lstat(path) {
    return lstat(path);
  },
  realpath(path) {
    return realpath(path);
  },
};
