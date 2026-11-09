/**
 * The MVP schema, kept as migration 1 (see migrations.ts). It is idempotent.
 * Do not edit it: later changes are new entries in MIGRATIONS.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS rooms (
  code        text PRIMARY KEY,
  status      text NOT NULL DEFAULT 'collecting'
              CHECK (status IN ('collecting', 'drawing', 'ended')),
  end_mode    text NOT NULL DEFAULT 'all' CHECK (end_mode IN ('all', 'count')),
  draw_limit  integer CHECK (draw_limit IS NULL OR draw_limit > 0),
  name_mode   text NOT NULL DEFAULT 'anonymous'
              CHECK (name_mode IN ('anonymous', 'named', 'none')),
  draw_count  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rooms_expires_idx ON rooms (expires_at);

CREATE TABLE IF NOT EXISTS participants (
  id          uuid PRIMARY KEY,
  room_code   text NOT NULL REFERENCES rooms (code) ON DELETE CASCADE,
  nickname    text,
  is_host     boolean NOT NULL DEFAULT false,
  token_hash  text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS participants_room_idx ON participants (room_code);

CREATE TABLE IF NOT EXISTS room_topics (
  id              uuid PRIMARY KEY,
  room_code       text NOT NULL REFERENCES rooms (code) ON DELETE CASCADE,
  participant_id  uuid NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  text            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  drawn_order     integer,
  drawn_at        timestamptz
);
CREATE INDEX IF NOT EXISTS room_topics_room_idx ON room_topics (room_code);

CREATE TABLE IF NOT EXISTS decks (
  id             uuid PRIMARY KEY,
  kind           text NOT NULL CHECK (kind IN ('official', 'user')),
  share_id       text UNIQUE,
  edit_key_hash  text,
  title          text NOT NULL,
  description    text NOT NULL DEFAULT '',
  theme          text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deck_cards (
  id        uuid PRIMARY KEY,
  deck_id   uuid NOT NULL REFERENCES decks (id) ON DELETE CASCADE,
  position  integer NOT NULL,
  text      text NOT NULL
);
CREATE INDEX IF NOT EXISTS deck_cards_deck_idx ON deck_cards (deck_id, position);
`;
