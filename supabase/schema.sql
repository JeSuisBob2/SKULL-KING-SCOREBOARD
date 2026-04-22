-- Skull King Multiplayer Schema
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  host_player_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby',
  total_rounds INT NOT NULL DEFAULT 10,
  current_round INT NOT NULL DEFAULT 1,
  scoring_preset_id TEXT NOT NULL DEFAULT 'standard',
  players JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_bids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  player_id TEXT NOT NULL,
  bid INT,
  harry_adjustment INT DEFAULT 0,
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(room_id, round_number, player_id)
);

CREATE TABLE IF NOT EXISTS room_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  player_id TEXT NOT NULL,
  tricks INT NOT NULL DEFAULT 0,
  bonus INT NOT NULL DEFAULT 0,
  specials JSONB NOT NULL DEFAULT '{}',
  score INT NOT NULL DEFAULT 0,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(room_id, round_number, player_id)
);

-- Row Level Security (open policies — rooms are short-lived public sessions)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (true);

CREATE POLICY "bids_select" ON room_bids FOR SELECT USING (true);
CREATE POLICY "bids_insert" ON room_bids FOR INSERT WITH CHECK (true);
CREATE POLICY "bids_update" ON room_bids FOR UPDATE USING (true);

CREATE POLICY "results_select" ON room_results FOR SELECT USING (true);
CREATE POLICY "results_insert" ON room_results FOR INSERT WITH CHECK (true);
CREATE POLICY "results_update" ON room_results FOR UPDATE USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_bids;
ALTER PUBLICATION supabase_realtime ADD TABLE room_results;

-- Auto-cleanup old rooms (optional: run as a scheduled function)
-- DELETE FROM rooms WHERE created_at < NOW() - INTERVAL '24 hours';
