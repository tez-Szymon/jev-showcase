CREATE TABLE IF NOT EXISTS tickets (
 id TEXT PRIMARY KEY, submission_id TEXT NOT NULL UNIQUE, subject TEXT NOT NULL, description TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('needs_review','routed','spam')), category TEXT, department TEXT, decision_by TEXT,
 version INTEGER NOT NULL CHECK(version > 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 CHECK ((status='routed' AND decision_by IS NOT NULL AND decision_by IN ('jev','consultant') AND category IS NOT NULL AND department IS NOT NULL AND
 ((category='technical' AND department='IT') OR (category='complaint' AND department='Complaints') OR (category='offer' AND department='Marketing') OR (category='other' AND department='Customer support')))
 OR (status!='routed' AND category IS NULL AND department IS NULL AND decision_by IS NULL))
);
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS analyses (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL CHECK(status IN ('started','success','error')), result TEXT, settings TEXT NOT NULL, reason TEXT, applied INTEGER NOT NULL DEFAULT 0, error_code TEXT);
CREATE TABLE IF NOT EXISTS ticket_events (id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), actor TEXT NOT NULL, kind TEXT NOT NULL, before_state TEXT, after_state TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ticket_status ON tickets(status, created_at);
CREATE INDEX IF NOT EXISTS analysis_ticket ON analyses(ticket_id);
CREATE INDEX IF NOT EXISTS event_ticket ON ticket_events(ticket_id);
