import { it, expect } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { initializeSchema } from "../src/lib/migrations";
import { Repository } from "../src/lib/repository";
import { defaults, type Ticket } from "../src/lib/domain";
import samples from "../fixtures/tickets.json";
const schema = readFileSync("src/lib/schema.sql", "utf8");
const legacySchema = schema
  .replaceAll("department='Complaints'", "department='Legacy complaints'")
  .replaceAll("department='Customer support'", "department='Legacy support'");

it("migrates existing teams and history atomically, preserves user text, settings and analyses", () => {
  const db = new Database(":memory:");
  try {
    db.exec(legacySchema);
    db.pragma("foreign_keys = ON");
    const timestamp = "2026-09-24T10:00:00.000Z";
    const ticket: Ticket = {
      id: "existing-ticket",
      submission_id: samples[0].submissionId,
      subject: "My custom request",
      description: "Keep this text exactly as I wrote it.",
      status: "routed",
      category: "complaint",
      department: "Legacy complaints",
      decision_by: "consultant",
      version: 4,
      created_at: timestamp,
      updated_at: timestamp,
    };
    db.prepare(
      "INSERT INTO tickets VALUES (@id,@submission_id,@subject,@description,@status,@category,@department,@decision_by,@version,@created_at,@updated_at)",
    ).run(ticket);
    db.prepare("INSERT INTO ticket_events VALUES (?,?,?,?,?,?,?)").run(
      "event",
      ticket.id,
      "consultant",
      "route",
      JSON.stringify({
        ...ticket,
        status: "needs_review",
        category: null,
        department: null,
        decision_by: null,
      }),
      JSON.stringify(ticket),
      timestamp,
    );
    db.prepare("INSERT INTO settings VALUES (1,5,?,?)").run(
      JSON.stringify({ ...defaults, minConfidence: 0.8 }),
      timestamp,
    );
    db.prepare(
      "INSERT INTO analyses (id,ticket_id,started_at,status,settings) VALUES (?, ?, ?, 'started', ?)",
    ).run(
      "attempt",
      ticket.id,
      timestamp,
      JSON.stringify({ ...defaults, version: 1 }),
    );
    initializeSchema(db, schema);
    const repo = new Repository(db);
    expect(repo.get(ticket.id)).toEqual({
      ...ticket,
      department: "Complaints",
    });
    expect(repo.events(ticket.id)[0].after).toEqual({
      ...ticket,
      department: "Complaints",
    });
    expect(repo.settings()).toMatchObject({ version: 5, minConfidence: 0.8 });
    expect(repo.attempts(ticket.id)).toHaveLength(1);
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(() =>
      db.prepare("UPDATE tickets SET department='Legacy complaints'").run(),
    ).toThrow();
    initializeSchema(db, schema);
    expect(repo.get(ticket.id)).toEqual({
      ...ticket,
      department: "Complaints",
    });
    expect(repo.events(ticket.id)).toHaveLength(1);
  } finally {
    db.close();
  }
});

it("rolls back the migration if a history snapshot is corrupt", () => {
  const db = new Database(":memory:");
  try {
    db.exec(legacySchema);
    db.pragma("foreign_keys = ON");
    db.prepare(
      "INSERT INTO tickets VALUES ('ticket','submission','Subject','Description','routed','complaint','Legacy complaints','consultant',1,'time','time')",
    ).run();
    db.prepare(
      "INSERT INTO ticket_events VALUES ('event','ticket','consultant','route',NULL,'bad JSON','time')",
    ).run();
    expect(() => initializeSchema(db, schema)).toThrow();
    expect(db.pragma("user_version", { simple: true })).toBe(0);
    expect(new Repository(db).get("ticket")?.department).toBe(
      "Legacy complaints",
    );
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  } finally {
    db.close();
  }
});

it("translates unchanged legacy sample text in current rows and history only once", () => {
  const db = new Database(":memory:");
  try {
    db.exec(legacySchema);
    // Historical input must retain its original language to verify the migration.
    const ticket: Ticket = {
      id: "original-sample",
      submission_id: samples[0].submissionId,
      subject: "Internet rozłącza się wieczorami",
      description:
        "Od poniedziałku po godzinie 19 internet rozłącza się co kilka minut. Restart routera nie pomógł. Proszę o sprawdzenie połączenia.",
      status: "needs_review",
      category: null,
      department: null,
      decision_by: null,
      version: 1,
      created_at: "2026-09-24T10:00:00.000Z",
      updated_at: "2026-09-24T10:00:00.000Z",
    };
    db.prepare(
      "INSERT INTO tickets VALUES (@id,@submission_id,@subject,@description,@status,@category,@department,@decision_by,@version,@created_at,@updated_at)",
    ).run(ticket);
    db.prepare("INSERT INTO ticket_events VALUES (?,?,?,?,?,?,?)").run(
      "sample-event",
      ticket.id,
      "client",
      "created",
      null,
      JSON.stringify(ticket),
      ticket.created_at,
    );
    initializeSchema(db, schema);
    const repo = new Repository(db);
    const expected = {
      ...ticket,
      subject: samples[0].subject,
      description: samples[0].description,
    };
    expect(repo.get(ticket.id)).toEqual(expected);
    expect(repo.events(ticket.id)[0].after).toEqual(expected);
    initializeSchema(db, schema);
    expect(repo.get(ticket.id)).toEqual(expected);
    expect(repo.events(ticket.id)).toHaveLength(1);
  } finally {
    db.close();
  }
});
