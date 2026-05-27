#!/usr/bin/env node

import { runCreator } from "./cli";

const result = await runCreator(process.argv.slice(2), { cwd: process.cwd() });

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}
process.exitCode = result.exitCode;
