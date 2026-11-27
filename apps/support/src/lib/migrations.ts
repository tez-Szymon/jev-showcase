import "server-only";
import type Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { catalog } from "./catalog";
import type { Ticket } from "./domain";
import samples from "../../fixtures/tickets.json";
import legacyHashes from "./legacy-seed-hashes.json";

// Hashes identify only the original, unmodified demo text. User content is retained.
function translateStoredTicket(ticket: Ticket): Ticket {
  const translated = { ...ticket };
  if (ticket.category && ticket.department) {
    translated.department = catalog[ticket.category].department;
  }
  const hash = createHash("sha256")
    .update(`${ticket.subject}\0${ticket.description}`)
    .digest("hex");
  const expected =
    legacyHashes[ticket.submission_id as keyof typeof legacyHashes];
  const sample = samples.find(
    (item) => item.submissionId === ticket.submission_id,
  );
  if (sample && expected === hash) {
    translated.subject = sample.subject;
    translated.description = sample.description;
  }
  return translated;
}

export function initializeSchema(db: Database.Database, schema: string) {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version > 1)
    throw new Error("This database requires a newer application version.");
  const existing = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='tickets'",
    )
    .get();
  if (!existing) {
    db.transaction(() => {
      db.exec(schema);
      db.pragma("user_version = 1");
    })();
    return;
  }
  if (version === 1) return;

  // Rebuild the table because its CHECK constraint contains the old team names.
  // Disable FK enforcement outside the transaction, then verify all references
  // before committing. Child tables continue to reference the final tickets table.
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      const tickets = db.prepare("SELECT * FROM tickets").all() as Ticket[];
      const createTickets = schema
        .slice(0, schema.indexOf(";") + 1)
        .replace(
          "CREATE TABLE IF NOT EXISTS tickets",
          "CREATE TABLE tickets_english",
        );
      db.exec(createTickets);
      const insert = db.prepare(`INSERT INTO tickets_english
        (id, submission_id, subject, description, status, category, department,
         decision_by, version, created_at, updated_at)
        VALUES (@id, @submission_id, @subject, @description, @status, @category,
         @department, @decision_by, @version, @created_at, @updated_at)`);
      for (const ticket of tickets) insert.run(translateStoredTicket(ticket));
      db.exec(
        "DROP TABLE tickets; ALTER TABLE tickets_english RENAME TO tickets;",
      );
      db.exec(schema);
      const events = db
        .prepare("SELECT id,before_state,after_state FROM ticket_events")
        .all() as Array<{
        id: string;
        before_state: string | null;
        after_state: string;
      }>;
      const update = db.prepare(
        "UPDATE ticket_events SET before_state=?,after_state=? WHERE id=?",
      );
      for (const event of events) {
        update.run(
          event.before_state
            ? JSON.stringify(
                translateStoredTicket(JSON.parse(event.before_state)),
              )
            : null,
          JSON.stringify(translateStoredTicket(JSON.parse(event.after_state))),
          event.id,
        );
      }
      if ((db.pragma("foreign_key_check") as unknown[]).length)
        throw new Error("Database migration failed reference validation.");
      db.pragma("user_version = 1");
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}
