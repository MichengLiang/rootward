import { ok } from "../core/result";
import { loadProject, type ProjectCommandOptions } from "./shared";

export async function configPrintCommand(options: ProjectCommandOptions) {
  const { config } = await loadProject(options);
  return ok(config);
}
