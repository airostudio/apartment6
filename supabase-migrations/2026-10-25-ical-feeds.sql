-- External calendar (iCal) feeds for import. Run in the Supabase SQL Editor.
CREATE TABLE IF NOT EXISTS ical_feeds (
  id           TEXT PRIMARY KEY,
  platform     TEXT NOT NULL DEFAULT 'other',
  name         TEXT NOT NULL DEFAULT '',
  url          TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  last_checked TIMESTAMPTZ,
  last_synced  TIMESTAMPTZ,
  last_status  TEXT NOT NULL DEFAULT '',
  last_error   TEXT NOT NULL DEFAULT '',
  last_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Feed URLs contain secret tokens: only the service-role key (API) may read them.
ALTER TABLE ical_feeds ENABLE ROW LEVEL SECURITY;
