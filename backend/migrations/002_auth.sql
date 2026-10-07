-- Single-row table tracking failed logins for the one admin account.
CREATE TABLE auth_state (
  id               smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  failed_attempts  integer     NOT NULL DEFAULT 0,
  locked_at        timestamptz
);

INSERT INTO auth_state (id) VALUES (1);
