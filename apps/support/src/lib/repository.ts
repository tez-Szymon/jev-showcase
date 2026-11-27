import "server-only";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { catalog } from "./catalog";
import type {
  Analysis,
  Attempt,
  Category,
  Decision,
  Reason,
  Settings,
  Ticket,
  TicketEvent,
} from "./domain";
export class Conflict extends Error {}
export class Missing extends Error {}
export class Repository {
  constructor(public db: Database.Database) {}
  get(id: string) {
    return this.db.prepare("SELECT * FROM tickets WHERE id=?").get(id) as
      Ticket | undefined;
  }
  list() {
    return this.db
      .prepare("SELECT * FROM tickets ORDER BY created_at DESC, rowid DESC")
      .all() as Ticket[];
  }
  settings(): Settings {
    const row = this.db.prepare("SELECT * FROM settings WHERE id=1").get() as {
      version: number;
      payload: string;
    };
    return { ...JSON.parse(row.payload), version: row.version };
  }
  saveSettings(values: Omit<Settings, "version">, expectedVersion: number) {
    return this.db.transaction(() => {
      const change = this.db
        .prepare(
          "UPDATE settings SET payload=?, version=version+1, updated_at=? WHERE id=1 AND version=?",
        )
        .run(JSON.stringify(values), new Date().toISOString(), expectedVersion);
      if (!change.changes) throw new Conflict();
      return this.settings();
    })();
  }
  private event(
    actor: string,
    kind: string,
    before: Ticket | null,
    after: Ticket,
  ) {
    this.db
      .prepare("INSERT INTO ticket_events VALUES (?,?,?,?,?,?,?)")
      .run(
        randomUUID(),
        after.id,
        actor,
        kind,
        before ? JSON.stringify(before) : null,
        JSON.stringify(after),
        new Date().toISOString(),
      );
  }
  create(
    input: { submissionId: string; subject: string; description: string },
    enabled: boolean,
  ) {
    return this.db.transaction(() => {
      const existing = this.db
        .prepare("SELECT * FROM tickets WHERE submission_id=?")
        .get(input.submissionId) as Ticket | undefined;
      if (existing) {
        if (
          existing.subject !== input.subject ||
          existing.description !== input.description
        )
          throw new Conflict();
        return { ticket: existing, attempt: null };
      }
      const time = new Date().toISOString();
      const id = randomUUID();
      this.db
        .prepare(
          "INSERT INTO tickets VALUES (?,?,?,?,'needs_review',NULL,NULL,NULL,1,?,?)",
        )
        .run(
          id,
          input.submissionId,
          input.subject,
          input.description,
          time,
          time,
        );
      const ticket = this.get(id)!;
      this.event("client", "created", null, ticket);
      let attempt: { id: string; settings: Settings } | null = null;
      if (enabled) {
        attempt = { id: randomUUID(), settings: this.settings() };
        this.db
          .prepare(
            "INSERT INTO analyses (id,ticket_id,started_at,status,settings) VALUES (?,?,?,'started',?)",
          )
          .run(attempt.id, id, time, JSON.stringify(attempt.settings));
      }
      return { ticket, attempt };
    })();
  }
  mutate(
    id: string,
    expectedVersion: number,
    action: "route" | "spam" | "restore",
    category?: Category,
  ) {
    return this.db.transaction(() => {
      const before = this.get(id);
      if (!before) throw new Missing();
      if (
        before.version !== expectedVersion ||
        (action === "route" && before.status === "spam") ||
        (action === "restore" && before.status !== "spam") ||
        (action === "spam" && before.status === "spam")
      )
        throw new Conflict();
      const status =
        action === "route"
          ? "routed"
          : action === "spam"
            ? "spam"
            : "needs_review";
      this.db
        .prepare(
          "UPDATE tickets SET status=?, category=?, department=?, decision_by=?, version=version+1, updated_at=? WHERE id=? AND version=?",
        )
        .run(
          status,
          action === "route" ? category : null,
          action === "route" ? catalog[category!].department : null,
          action === "route" ? "consultant" : null,
          new Date().toISOString(),
          id,
          expectedVersion,
        );
      const after = this.get(id)!;
      this.event("consultant", action, before, after);
      return after;
    })();
  }
  finish(
    ticket: Ticket,
    attemptId: string,
    result: Analysis | null,
    decision: Decision,
    errorCode?: string,
  ) {
    return this.db.transaction(() => {
      const current = this.get(ticket.id);
      if (!current) throw new Missing();
      const fresh =
        current.version === ticket.version && current.status === "needs_review";
      const reason: Reason = fresh ? decision.reason : "stale_result";
      let applied = false;
      if (fresh && decision.action === "route") {
        const update = this.db
          .prepare(
            "UPDATE tickets SET status='routed', category=?,department=?,decision_by='jev',version=version+1,updated_at=? WHERE id=? AND version=? AND status='needs_review'",
          )
          .run(
            decision.category,
            catalog[decision.category].department,
            new Date().toISOString(),
            ticket.id,
            ticket.version,
          );
        applied = !!update.changes;
      }
      if (fresh && decision.action === "spam") {
        const update = this.db
          .prepare(
            // decision_by stays NULL: the schema allows it only for routed tickets.
            // The analysis row (applied, auto_spam) and the event log record that Jev decided.
            "UPDATE tickets SET status='spam',version=version+1,updated_at=? WHERE id=? AND version=? AND status='needs_review'",
          )
          .run(new Date().toISOString(), ticket.id, ticket.version);
        applied = !!update.changes;
      }
      this.db
        .prepare(
          "UPDATE analyses SET finished_at=?,status=?,result=?,reason=?,applied=?,error_code=? WHERE id=? AND status='started'",
        )
        .run(
          new Date().toISOString(),
          result ? "success" : "error",
          result ? JSON.stringify(result) : null,
          reason,
          Number(applied),
          errorCode ?? null,
          attemptId,
        );
      this.event("jev", reason, current, this.get(ticket.id)!);
    })();
  }
  attempts(id: string): Attempt[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM analyses WHERE ticket_id=? ORDER BY started_at DESC",
      )
      .all(id) as Array<
      Omit<Attempt, "result" | "settings" | "applied" | "interrupted"> & {
        result: string | null;
        settings: string;
        applied: number;
      }
    >;
    return rows.map((r) => ({
      ...r,
      interrupted:
        r.status === "started" && Date.now() - Date.parse(r.started_at) > 8000,
      result: r.result ? JSON.parse(r.result) : null,
      settings: JSON.parse(r.settings),
      applied: !!r.applied,
    }));
  }
  events(id: string): TicketEvent[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM ticket_events WHERE ticket_id=? ORDER BY rowid DESC",
      )
      .all(id) as Array<{
      id: string;
      actor: string;
      kind: string;
      before_state: string | null;
      after_state: string;
      created_at: string;
    }>;
    return rows.map((r) => ({
      ...r,
      before: r.before_state ? JSON.parse(r.before_state) : null,
      after: JSON.parse(r.after_state),
    }));
  }
}
