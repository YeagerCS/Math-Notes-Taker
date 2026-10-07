CREATE TABLE notebooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  color       text        NOT NULL DEFAULT 'navy',
  paper       text        NOT NULL DEFAULT 'grid' CHECK (paper IN ('grid', 'lined', 'dotted', 'blank')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id  uuid        NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  position     integer     NOT NULL,
  strokes      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notebook_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX pages_notebook_idx ON pages (notebook_id, position);
