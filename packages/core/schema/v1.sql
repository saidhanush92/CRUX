-- v1.sql — CRUX trace graph SQLite schema
-- ADR-CRUX-011 / REQ-CRUX-003

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1');

CREATE TABLE IF NOT EXISTS artifacts (
  id       TEXT PRIMARY KEY,
  kind     TEXT NOT NULL,
  path     TEXT NOT NULL DEFAULT '',
  raw_yaml TEXT NOT NULL,
  sha256   TEXT NOT NULL,
  mtime    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS edges (
  rowid        INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id      TEXT NOT NULL,
  to_id        TEXT NOT NULL,
  relation     TEXT NOT NULL,
  source_field TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edges_from_id ON edges (from_id);
CREATE INDEX IF NOT EXISTS idx_edges_to_id   ON edges (to_id);
