import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../src/lib/db";
import { Repository } from "../src/lib/repository";
import { saveSettings, resetSettings } from "../src/lib/settings-service";
import { defaults } from "../src/lib/domain";
import { createTicketService } from "../src/lib/ticket-service";
import { analysis } from "./fixtures/jev";
it("persists settings after reopening, rejects stale writes and versions resets", () => {
  const folder = mkdtempSync(join(tmpdir(), "jev-settings-"));
  const path = join(folder, "db.sqlite");
  let repo = new Repository(openDatabase(path));
  try {
    expect(
      saveSettings(
        repo,
        {
          ...defaults,
          minConfidence: 0.8,
          categoryOverrides: { technical: 0.7 },
        },
        1,
      ),
    ).toMatchObject({ ok: true, data: { version: 2 } });
    repo.db.close();
    repo = new Repository(openDatabase(path));
    expect(repo.settings()).toMatchObject({
      version: 2,
      minConfidence: 0.8,
      categoryOverrides: { technical: 0.7 },
    });
    expect(saveSettings(repo, defaults, 1)).toMatchObject({
      ok: false,
      code: "conflict",
    });
    expect(resetSettings(repo, 2)).toEqual({
      ok: true,
      data: { ...defaults, version: 3 },
    });
  } finally {
    repo.db.close();
    rmSync(folder, { recursive: true });
  }
});
it.each([NaN, Infinity, -0.01, 1.01, undefined, ""])(
  "rejects invalid numeric settings %s",
  (value) => {
    const repo = new Repository(openDatabase(":memory:"));
    try {
      expect(
        saveSettings(repo, { ...defaults, minConfidence: value }, 1),
      ).toMatchObject({ ok: false, code: "validation" });
      expect(repo.settings().version).toBe(1);
    } finally {
      repo.db.close();
    }
  },
);
it("rejects unknown overrides and invalid versions", () => {
  const repo = new Repository(openDatabase(":memory:"));
  try {
    expect(
      saveSettings(repo, { ...defaults, categoryOverrides: { other: 0.5 } }, 1)
        .ok,
    ).toBe(false);
    expect(saveSettings(repo, defaults, 0).ok).toBe(false);
  } finally {
    repo.db.close();
  }
});
it("does not change previous decisions when thresholds change", async () => {
  const repo = new Repository(openDatabase(":memory:"));
  try {
    const s = createTicketService(repo, true, async () => analysis());
    await s.submitTicket({
      submissionId: randomUUID(),
      subject: "No internet connection",
      description: "No connection since this morning.",
    });
    const before = repo.list()[0];
    saveSettings(repo, { ...defaults, minConfidence: 1 }, 1);
    expect(repo.get(before.id)).toEqual(before);
    expect(repo.attempts(before.id)[0].settings.version).toBe(1);
  } finally {
    repo.db.close();
  }
});
