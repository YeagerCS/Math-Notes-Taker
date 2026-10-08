-- Optional background image of a page (e.g. an imported PDF page). One per page;
-- removed automatically with the page. Stored in the DB so one backup covers everything.
CREATE TABLE page_backgrounds (
  page_id     uuid        PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
  mime        text        NOT NULL,
  width       integer     NOT NULL CHECK (width > 0),
  height      integer     NOT NULL CHECK (height > 0),
  data        bytea       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
