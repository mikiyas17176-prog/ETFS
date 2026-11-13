-- Faith Hope Love Sunday School - Cloudflare D1 schema
-- Run once:  npx wrangler d1 execute sunday-school --remote --file=schema.sql

-- Every record of the portal (what Firestore called documents): collection + id -> data
CREATE TABLE IF NOT EXISTS docs (
  col     TEXT    NOT NULL,   -- kv | staff | meta | pub | regcfg | reg
  id      TEXT    NOT NULL,
  data    TEXT    NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY (col, id)
);

-- Staff logins (what Firebase Authentication held). Passwords are stored as salted PBKDF2 hashes.
CREATE TABLE IF NOT EXISTS accounts (
  uid     TEXT    PRIMARY KEY,
  email   TEXT    NOT NULL UNIQUE,
  pw      TEXT    NOT NULL,
  created INTEGER NOT NULL
);

-- Failed-login and public-form counters (rate limiting)
CREATE TABLE IF NOT EXISTS throttle (
  k TEXT    NOT NULL,
  t INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS throttle_k ON throttle (k, t);
