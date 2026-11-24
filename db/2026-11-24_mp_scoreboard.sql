-- 2026-11-24: Marketing Performance's OWN client-acquisition scoreboard (approved by
-- Robbie 2026-11-24). Read every Monday. One row per (week, channel) holding four
-- hand-entered counts. Each count is the number of those events that HAPPENED in that
-- week: a call booked in week 1 and held in week 2 counts as booked in week 1 and held
-- in week 2. "Booked" = a call on the calendar; a form submission alone is not a booking.
-- week_start is always a Monday (YYYY-MM-DD); the worker rejects any other date.
-- A missing row means 0 for that week+channel; the UI and GET route fill it in.
CREATE TABLE IF NOT EXISTS mp_scoreboard (
  week_start    TEXT    NOT NULL,
  channel       TEXT    NOT NULL CHECK (channel IN ('Email','LinkedIn','Facebook/Instagram ad','YouTube','Google search','Referral','Other','Unknown')),
  booked        INTEGER NOT NULL DEFAULT 0 CHECK (booked >= 0),
  held          INTEGER NOT NULL DEFAULT 0 CHECK (held >= 0),
  proposal_sent INTEGER NOT NULL DEFAULT 0 CHECK (proposal_sent >= 0),
  signed        INTEGER NOT NULL DEFAULT 0 CHECK (signed >= 0),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (week_start, channel)
);
