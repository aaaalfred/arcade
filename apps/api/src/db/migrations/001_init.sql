-- Esquema inicial de Arcade. Los instantes (created_at, updated_at, achieved_at…) los fija la aplicación.

CREATE TABLE players (
  id           text PRIMARY KEY,
  token_hash   text NOT NULL,               -- SHA-256 hex del secreto; el secreto nunca se guarda
  nickname     text NOT NULL,
  nickname_ci  text NOT NULL,               -- apodo en minúsculas (NFKC): unicidad sin distinguir mayúsculas
  hidden       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX players_nickname_ci_key ON players (nickname_ci);

CREATE TABLE saves (
  player_id      text NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  game_id        text NOT NULL,
  rev            integer NOT NULL,
  state          jsonb NOT NULL,
  progress_value integer NOT NULL,
  progress_total integer,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, game_id)
);

-- Un registro por (jugador, tablero, periodo) con su MEJOR valor. period = 'all' o semana ISO ('2026-W41').
CREATE TABLE scores (
  player_id    text NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  game_id      text NOT NULL,
  board_id     text NOT NULL,
  period       text NOT NULL,
  value        double precision NOT NULL,
  achieved_at  timestamptz NOT NULL,
  game_version text NOT NULL,
  PRIMARY KEY (player_id, game_id, board_id, period)
);
-- Un índice por sentido de orden: el top N se lee sin ordenar (desc y asc).
CREATE INDEX scores_ranking_desc_idx ON scores (game_id, board_id, period, value DESC, achieved_at, player_id);
CREATE INDEX scores_ranking_asc_idx  ON scores (game_id, board_id, period, value ASC,  achieved_at, player_id);

CREATE TABLE reports (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporter_id     text NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  target_id       text NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  target_nickname text NOT NULL DEFAULT '',  -- apodo del reportado en el momento del reporte
  reason          text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_id)
);
CREATE INDEX reports_target_idx ON reports (target_id);
CREATE INDEX reports_created_idx ON reports (created_at DESC);
