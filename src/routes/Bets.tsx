import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import NumberStepper from '../components/NumberStepper';
import ScoreChip from '../components/ScoreChip';
import { useGame } from '../hooks/useGame';
import { useStore } from '../store/useStore';
import { uid, sum } from '../lib/utils';
import { UUID, Round } from '../types';

const RANK_EMOJI = ['👑', '🏴‍☠️', '🧜‍♀️', '👶'];

export default function Bets() {
  const { gameId, roundNumber } = useParams();
  const nav = useNavigate();
  const { game, rounds } = useGame(gameId);
  const { upsertRound } = useStore();

  const rNum = Number(roundNumber || 1);

  const existingRound = useMemo(
    () => rounds.find(r => r.roundNumber === rNum),
    [rounds, rNum]
  );

  const [bids, setBids] = useState<Record<UUID, number>>({});
  const [showStandings, setShowStandings] = useState(false);

  useEffect(() => {
    if (!game) return;
    const initial: Record<UUID, number> = {};
    for (const p of game.players) {
      initial[p.id] = existingRound?.bids[p.id]?.bid ?? 0;
    }
    setBids(initial);
  }, [game, existingRound]);

  const standings = useMemo(() => {
    if (!game) return [];
    return game.players
      .map(p => ({
        player: p,
        total: sum(rounds.filter(r => r.roundNumber < rNum).map(r => r.results[p.id]?.score ?? 0)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [game, rounds, rNum]);

  const saveBets = async () => {
    if (!game) return;
    const base: Round = existingRound ?? {
      id: uid(),
      gameId: game.id,
      roundNumber: rNum,
      bids: {},
      results: {},
      locked: false,
    };
    const updated: Round = {
      ...base,
      bids: {},
      results: base.results,
    };
    for (const p of game.players) {
      updated.bids[p.id] = { playerId: p.id, bid: bids[p.id] ?? 0 };
    }
    await upsertRound(updated);
    nav(`/game/${game.id}/round/${rNum}/results`);
  };

  if (!game) return null;

  const firstPlayer = game.players[(rNum - 1) % game.players.length];

  return (
    <Layout title={`Paris · Manche ${rNum}/${game.totalRounds}`}>
      <div className="space-y-4">
        {/* Standings toggle */}
        <div className="card p-3">
          <button
            className="w-full flex items-center justify-between text-sm"
            onClick={() => setShowStandings(v => !v)}
          >
            <span className="section-title">Classement</span>
            <span className="opacity-60">{showStandings ? '▲' : '▼'}</span>
          </button>
          {showStandings && (
            <ul className="mt-2 space-y-1">
              {standings.map(({ player, total }, i) => (
                <li key={player.id} className="flex items-center justify-between text-sm">
                  <span>{RANK_EMOJI[i] ?? `${i + 1}.`} {player.name}</span>
                  <ScoreChip value={total} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-3 text-sm opacity-70">
          Premier à jouer : <span className="font-semibold text-white">{firstPlayer.name}</span>
        </div>

        {/* Bid inputs */}
        <div className="space-y-3">
          {game.players.map(p => (
            <div key={p.id} className="card p-4 flex items-center justify-between gap-4">
              <span className="font-medium">{p.name}</span>
              <NumberStepper
                value={bids[p.id] ?? 0}
                min={0}
                max={rNum}
                onChange={v => setBids(b => ({ ...b, [p.id]: v }))}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={saveBets}>
            Valider les paris →
          </button>
        </div>
      </div>
    </Layout>
  );
}
