import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { createError } from "./errors";

const identitySlotSchema = z
  .object({
    required: z.boolean().optional(),
    pattern: z.string().optional(),
    derivedFrom: z.string().optional(),
    format: z.string().optional(),
  })
  .strict();

const manifestSchema = z
  .object({
    id: z.string().min(1),
    language: z.string().min(1),
    status: z.enum(["implemented", "reserved"]),
    templateRoot: z.string().min(1),
    identity: z.record(z.string(), identitySlotSchema),
    tokens: z.record(z.string(), z.string()),
    exclude: z.array(z.string()),
    postcheck: z.array(z.string()),
    nextCommands: z.array(z.string()),
  })
  .strict();

export type TemplateManifest = z.infer<typeof manifestSchema>;

export async function loadManifest(
  templatesRoot: string,
  templateId: string,
): Promise<TemplateManifest> {
  const manifestPath = join(templatesRoot, templateId, "manifest.json");
  let text: string;
  try {
    text = await readFile(manifestPath, "utf8");
  } catch {
    throw createError("TEMPLATE_NOT_FOUND", "Template id is not defined.", {
      template: templateId,
    });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw createError(
      "TEMPLATE_INVALID",
      "Template manifest is not valid JSON.",
      {
        template: templateId,
        manifestPath,
        reason: error instanceof Error ? error.message : String(error),
      },
    );
  }

  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw createError("TEMPLATE_INVALID", "Template manifest is invalid.", {
      template: templateId,
      manifestPath,
      issues: parsed.error.issues,
    });
  }
  if (parsed.data.id !== templateId) {
    throw createError(
      "TEMPLATE_INVALID",
      "Template manifest id does not match.",
      {
        template: templateId,
        manifestPath,
        manifestId: parsed.data.id,
      },
    );
  }
  const identityKeys = new Set(Object.keys(parsed.data.identity));
  for (const [identityKey, slot] of Object.entries(parsed.data.identity)) {
    if (slot.derivedFrom && !identityKeys.has(slot.derivedFrom)) {
      throw createError(
        "TEMPLATE_INVALID",
        "Template manifest derived identity source is not declared.",
        {
          template: templateId,
          manifestPath,
          identityKey,
          derivedFrom: slot.derivedFrom,
        },
      );
    }
  }
  const tokens = Object.keys(parsed.data.tokens);
  for (const [token, identityKey] of Object.entries(parsed.data.tokens)) {
    if (!identityKeys.has(identityKey)) {
      throw createError(
        "TEMPLATE_INVALID",
        "Template manifest token identity is not declared.",
        {
          template: templateId,
          manifestPath,
          token,
          identityKey,
        },
      );
    }
  }
  for (const token of tokens) {
    for (const candidate of tokens) {
      if (token !== candidate && candidate.startsWith(token)) {
        throw createError(
          "TEMPLATE_INVALID",
          "Template manifest tokens must not overlap by prefix.",
          {
            template: templateId,
            manifestPath,
            token,
            overlappingToken: candidate,
          },
        );
      }
    }
  }
  return parsed.data;
}
