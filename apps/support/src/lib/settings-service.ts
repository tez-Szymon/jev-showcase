import "server-only";
import type { Settings, Result } from "./domain";
import { defaults } from "./domain";
import type { Repository } from "./repository";
import { settingsSchema, versionSchema } from "./validation";
import { failure } from "./ticket-service";
export function saveSettings(
  repo: Repository,
  input: unknown,
  expectedVersion: number,
): Result<Settings> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success || !versionSchema.safeParse(expectedVersion).success)
    return {
      ok: false,
      code: "validation",
      message: "Enter all thresholds as numbers between 0 and 1.",
    };
  try {
    return { ok: true, data: repo.saveSettings(parsed.data, expectedVersion) };
  } catch (e) {
    return failure(e);
  }
}
export function resetSettings(repo: Repository, expectedVersion: number) {
  return saveSettings(repo, defaults, expectedVersion);
}
