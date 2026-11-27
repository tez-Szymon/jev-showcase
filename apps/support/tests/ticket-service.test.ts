import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../src/lib/db";
import { Repository } from "../src/lib/repository";
import { createTicketService } from "../src/lib/ticket-service";
import type { Analysis } from "../src/lib/domain";
import { analysis } from "./fixtures/jev";
let repo: Repository;
const input = () => ({
  submissionId: randomUUID(),
  subject: "No internet connection",
  description:
    "I have been unable to connect to the internet since this morning.",
});
beforeEach(() => {
  repo = new Repository(openDatabase(":memory:"));
});
afterEach(() => {
  repo.db.close();
  vi.useRealTimers();
});
describe("ticket lifecycle", () => {
  it("manual mode needs no adapter and stores a single durable submission", async () => {
    const service = createTicketService(repo, false, async () => {
      throw new Error("Must not call");
    });
    const request = input();
    const a = await service.submitTicket(request);
    expect(a.ok).toBe(true);
    expect(await service.submitTicket(request)).toEqual(a);
    expect(repo.list()).toHaveLength(1);
    expect(repo.events(repo.list()[0].id)).toHaveLength(1);
    expect(repo.attempts(repo.list()[0].id)).toHaveLength(0);
    expect(
      await service.submitTicket({ ...request, subject: "Changed content" }),
    ).toMatchObject({ ok: false, code: "conflict" });
  });
  it("deduplicates an in-flight request without a second analysis", async () => {
    let resolve!: (a: Analysis) => void;
    const service = createTicketService(
      repo,
      true,
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const request = input();
    const first = service.submitTicket(request);
    const second = await service.submitTicket(request);
    expect(second.ok).toBe(true);
    resolve(analysis());
    expect(await first).toEqual(second);
    expect(repo.attempts(repo.list()[0].id)).toHaveLength(1);
    expect(repo.list()[0].status).toBe("routed");
  });
  it("moves confident spam to the spam queue automatically", async () => {
    const service = createTicketService(repo, true, async () =>
      analysis("spam", 0.97),
    );
    expect((await service.submitTicket(input())).ok).toBe(true);
    const t = repo.list()[0];
    expect(t).toMatchObject({
      status: "spam",
      category: null,
      department: null,
    });
    expect(repo.attempts(t.id)[0]).toMatchObject({
      reason: "auto_spam",
      applied: true,
    });
  });
  it("API failure keeps the ticket for review and stores no provider secrets", async () => {
    const service = createTicketService(repo, true, async () => {
      throw new Error("secret credential");
    });
    expect((await service.submitTicket(input())).ok).toBe(true);
    const t = repo.list()[0];
    expect(t.status).toBe("needs_review");
    expect(repo.attempts(t.id)[0]).toMatchObject({
      status: "error",
      reason: "api_error",
      applied: false,
    });
    expect(JSON.stringify(repo.attempts(t.id))).not.toContain("secret");
  });
  it("enforces the total eight-second budget", async () => {
    vi.useFakeTimers();
    const service = createTicketService(
      repo,
      true,
      () => new Promise(() => {}),
    );
    const result = service.submitTicket(input());
    await vi.advanceTimersByTimeAsync(8000);
    expect((await result).ok).toBe(true);
    expect(repo.attempts(repo.list()[0].id)[0].reason).toBe("api_error");
  });
  it("invalid probabilities never route", async () => {
    const service = createTicketService(repo, true, async () => ({
      ...analysis(),
      confidence: NaN,
    }));
    await service.submitTicket(input());
    expect(repo.list()[0].status).toBe("needs_review");
    expect(repo.attempts(repo.list()[0].id)[0].reason).toBe("invalid_result");
  });
  it("late AI preserves a human decision and its history", async () => {
    let resolve!: (a: Analysis) => void;
    const service = createTicketService(
      repo,
      true,
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const pending = service.submitTicket(input());
    const t = repo.list()[0];
    expect(
      service.routeTicket({
        id: t.id,
        expectedVersion: 1,
        category: "complaint",
      }).ok,
    ).toBe(true);
    resolve(analysis());
    await pending;
    expect(repo.get(t.id)).toMatchObject({
      department: "Complaints",
      decision_by: "consultant",
      version: 2,
    });
    expect(repo.attempts(t.id)[0]).toMatchObject({
      reason: "stale_result",
      applied: false,
      result: analysis(),
    });
    expect(repo.events(t.id)).toHaveLength(3);
  });
  it("uses settings captured at start even when thresholds change", async () => {
    let resolve!: (a: Analysis) => void;
    const service = createTicketService(
      repo,
      true,
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const pending = service.submitTicket(input());
    repo.saveSettings(
      { minConfidence: 0.99, minMargin: 0.2, categoryOverrides: {} },
      1,
    );
    resolve(analysis());
    await pending;
    expect(repo.list()[0].status).toBe("routed");
    expect(repo.attempts(repo.list()[0].id)[0].settings.version).toBe(1);
  });
  it("supports correction, spam and restore, with stale writes rejected", async () => {
    const s = createTicketService(repo, false, async () => analysis());
    await s.submitTicket(input());
    const t = repo.list()[0];
    expect(
      s.routeTicket({ id: t.id, expectedVersion: 1, category: "technical" }).ok,
    ).toBe(true);
    expect(s.markSpam({ id: t.id, expectedVersion: 1 })).toMatchObject({
      ok: false,
      code: "conflict",
    });
    expect(
      s.routeTicket({ id: t.id, expectedVersion: 2, category: "other" }).ok,
    ).toBe(true);
    expect(s.markSpam({ id: t.id, expectedVersion: 3 }).ok).toBe(true);
    expect(repo.get(t.id)).toMatchObject({
      status: "spam",
      category: null,
      department: null,
      decision_by: null,
    });
    expect(
      s.routeTicket({ id: t.id, expectedVersion: 4, category: "technical" }).ok,
    ).toBe(false);
    expect(s.restoreTicket({ id: t.id, expectedVersion: 4 }).ok).toBe(true);
    expect(repo.get(t.id)).toMatchObject({
      status: "needs_review",
      version: 5,
      department: null,
    });
    expect(repo.events(t.id)).toHaveLength(5);
  });
  it("rolls back ticket mutation if event insertion fails", async () => {
    const s = createTicketService(repo, false, async () => analysis());
    await s.submitTicket(input());
    const t = repo.list()[0];
    repo.db.exec(
      "CREATE TRIGGER fail_event BEFORE INSERT ON ticket_events BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
    );
    expect(
      s.routeTicket({ id: t.id, expectedVersion: 1, category: "technical" }),
    ).toMatchObject({ ok: false, code: "storage" });
    expect(repo.get(t.id)).toMatchObject({
      status: "needs_review",
      version: 1,
    });
    expect(repo.events(t.id)).toHaveLength(1);
  });
  it("keeps the original review state if result persistence fails", async () => {
    const s = createTicketService(repo, true, async () => {
      repo.db.exec(
        "CREATE TRIGGER fail_analysis BEFORE UPDATE ON analyses BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
      );
      return analysis();
    });
    expect((await s.submitTicket(input())).ok).toBe(true);
    expect(repo.list()[0]).toMatchObject({
      status: "needs_review",
      version: 1,
    });
    expect(repo.attempts(repo.list()[0].id)[0].status).toBe("started");
  });
  it("does not confirm a failed initial save", async () => {
    repo.db.exec(
      "CREATE TRIGGER fail_ticket BEFORE INSERT ON tickets BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
    );
    const s = createTicketService(repo, false, async () => analysis());
    expect(await s.submitTicket(input())).toMatchObject({
      ok: false,
      code: "storage",
    });
    expect(repo.list()).toHaveLength(0);
  });
  it("validates at the service boundary and reports missing records", async () => {
    const s = createTicketService(repo, false, async () => analysis());
    expect(
      await s.submitTicket({ ...input(), description: "short" }),
    ).toMatchObject({ ok: false, code: "validation" });
    expect(s.markSpam({ id: randomUUID(), expectedVersion: 1 })).toMatchObject({
      ok: false,
      code: "not_found",
    });
    expect(
      s.routeTicket({
        id: "invalid",
        expectedVersion: 1,
        category: "technical",
      }),
    ).toMatchObject({ ok: false, code: "validation" });
  });
});

it("presents abandoned attempts as interrupted without blocking a consultant", () => {
  vi.useFakeTimers();
  const created = repo.create(input(), true);
  vi.advanceTimersByTime(8001);
  expect(repo.attempts(created.ticket.id)[0]).toMatchObject({
    status: "started",
    interrupted: true,
  });
  const service = createTicketService(repo, false, async () => analysis());
  expect(
    service.routeTicket({
      id: created.ticket.id,
      expectedVersion: 1,
      category: "technical",
    }).ok,
  ).toBe(true);
  expect(repo.get(created.ticket.id)?.department).toBe("IT");
});
