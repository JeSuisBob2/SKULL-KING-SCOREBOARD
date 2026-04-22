import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useGame } from '../hooks/useGame';
import NumberStepper from '../components/NumberStepper';
import DualCardCounter from '../components/DualCardCounter';
import { presets } from '../config/scoringConfig';
import { calculateScore } from '../lib/score';
import { Round } from '../types';
import { useStore } from '../store/useStore';
import { uid } from '../lib/utils';

export default function Results() {
  const { gameId, roundNumber } = useParams();
  const nav = useNavigate();
  const { game, rounds } = useGame(gameId);
  const { upsertRound, setCurrentRound, completeGame, unlockRound } = useStore();

  const rNum = Number(roundNumber || 1);

  if (!game) {
    nav(`/game/${gameId}/round/${rNum}/bets`, { replace: true });
  }

  const round = useMemo<Round | undefined>(
    () => rounds.find((r) => r.roundNumber === rNum),
    [rounds, rNum]
  );

  const effectiveRound = useMemo<Round | undefined>(() => {
    if (!game) return undefined;
    return (
      round ?? {
        id: uid(),
        gameId: game.id,
        roundNumber: rNum,
        bids: {},
        results: {},
        locked: false,
      }
    );
  }, [round, game?.id, rNum]);

  useEffect(() => {
    if ((!game || !effectiveRound) && gameId) {
      nav(`/game/${gameId}/round/${rNum}/bets`, { replace: true });
    }
  }, [game, effectiveRound, gameId, rNum, nav]);

  const config = presets.standard;
  const isLocked = !!effectiveRound?.locked;

  const [local, setLocal] = useState<Record<string, any>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!game || !effectiveRound) {
      nav(`/game/${gameId}/round/${rNum}/bets`, { replace: true });
      return;
    }
    const o: Record<string, any> = {};
    for (const p of game.players) {
      const existing = effectiveRound.results[p.id];
      const bid = effectiveRound.bids[p.id]?.bid ?? 0;
      const adj = effectiveRound.bids[p.id]?.betAdjustedByHarry ?? 0;
      const specials = existing?.specialCards ?? {};
      o[p.id] = {
        tricks: existing?.tricks ?? 0,
        bonus: existing?.bonus ?? 0,
        harry: adj ?? 0,
        specials: {
          skullKing: specials?.skullKing ?? { positive: 0, negative: 0 },
          second: specials?.second ?? { positive: 0, negative: 0 },
          pirates: specials?.pirates ?? { positive: 0, negative: 0 },
          mermaids: specials?.mermaids ?? { positive: 0, negative: 0 },
          babyPirates: specials?.babyPirates ?? { positive: 0, negative: 0 },
          coins: specials?.coins ?? { positive: 0, negative: 0 },
          beasts: specials?.beasts ?? { positive: 0, negative: 0 },
          rascalGamble: specials?.rascalGamble ?? { positive: 0, negative: 0 },
          jokerBonus: specials?.jokerBonus ?? { positive: 0 },
          punishment: specials?.punishment ?? { negative: 0 },
        },
        bid,
      };
    }
    setLocal(o);
  }, [game, effectiveRound]);

  useEffect(() => {
    if (!game) return;
    const o: Record<string, boolean> = {};
    for (const p of game.players) {
      o[p.id] = true;
    }
    setCollapsedSections(o);
  }, [gameId]);

  const setPlayer = (pid: string, key: string, value: any) =>
    setLocal((s) => ({ ...s, [pid]: { ...s[pid], [key]: value } }));

  const saveRound = async () => {
    if (!game) return;
    const baseRound: Round = effectiveRound ?? {
      id: uid(),
      gameId: game.id,
      roundNumber: rNum,
      bids: {},
      results: {},
      locked: false,
    };
    const updated: Round = { ...baseRound };
    for (const p of game.players) {
      const pid = p.id;
      const entry = local[pid] ?? {
        tricks: 0,
        bonus: 0,
        harry: 0,
        specials: {
          skullKing: { positive: 0, negative: 0 },
          second: { positive: 0, negative: 0 },
          pirates: { positive: 0, negative: 0 },
          mermaids: { positive: 0, negative: 0 },
          babyPirates: { positive: 0, negative: 0 },
          coins: { positive: 0, negative: 0 },
          beasts: { positive: 0, negative: 0 },
          rascalGamble: { positive: 0, negative: 0 },
          jokerBonus: { positive: 0 },
          punishment: { negative: 0 },
        },
        bid: effectiveRound?.bids?.[p.id]?.bid ?? 0,
      };
      const adjustedBid = entry.bid + (config.allowHarryAdjustment ? entry.harry ?? 0 : 0);
      const score = calculateScore(adjustedBid, entry.tricks, rNum, entry.bonus, config);

      updated.bids[pid] = {
        playerId: pid,
        bid: entry.bid,
        betAdjustedByHarry: entry.harry ?? 0,
      };
      updated.results[pid] = {
        tricks: entry.tricks,
        bonus: entry.bonus,
        specialCards: entry.specials,
        score,
      };
    }
    updated.locked = true;
    await upsertRound(updated);

    if (rNum < game.totalRounds) {
      await setCurrentRound(rNum + 1);
      nav(`/game/${game.id}/round/${rNum + 1}/bets`);
    } else {
      await completeGame(game.id);
      nav(`/game/${game.id}/summary`);
    }
  };

  if (!game || !effectiveRound) return null;

  return (
    <Layout title={`Résultats · Manche ${rNum}`}>
      <div className="space-y-4">
        {isLocked && (
          <div className="card p-3 flex items-center justify-between">
            <div className="text-sm opacity-80">Manche verrouillée.</div>
            <button className="btn btn-ghost text-sm" onClick={async () => { await unlockRound(game.id, rNum); }}>
              Déverrouiller
            </button>
          </div>
        )}

        <div className="card p-3 flex items-center justify-between">
          <button
            className="btn btn-ghost text-sm"
            onClick={async () => {
              if (isLocked) await unlockRound(game.id, rNum);
              nav(`/game/${game.id}/round/${rNum}/bets`);
            }}
          >
            ← Retour aux paris
          </button>
        </div>
      </div>

      <div className="space-y-6 mt-4">
        {game.players.map((p) => {
          const entry = local[p.id] ?? { tricks: 0, bonus: 0, harry: 0, specials: {}, bid: 0 };
          const adjustedBid = entry.bid + (config.allowHarryAdjustment ? entry.harry ?? 0 : 0);
          const projected = calculateScore(adjustedBid, entry.tricks, rNum, entry.bonus, config);

          return (
            <div key={p.id} className="card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-lg">{p.name}</h4>
                <div className="opacity-80 text-sm">
                  Pari: {entry.bid}
                  {entry.harry ? ` (Harry ${entry.harry > 0 ? '+' : ''}${entry.harry})` : ''}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between">
                  <span>Plis réalisés</span>
                  <NumberStepper value={entry.tricks} min={0} max={rNum} onChange={(v) => setPlayer(p.id, 'tricks', v)} />
                </div>

                <div className="flex items-center justify-between">
                  <span>Harry The Giant</span>
                  <div className="flex items-center gap-2">
                    <button className="btn btn-ghost px-3" onClick={() => setPlayer(p.id, 'harry', Math.max(-2, entry.harry - 1))}>−1</button>
                    <span className="w-12 text-center tabular-nums font-semibold">{entry.harry}</span>
                    <button className="btn btn-ghost px-3" onClick={() => setPlayer(p.id, 'harry', Math.min(2, entry.harry + 1))}>+1</button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span>Bonus</span>
                  <div className="flex items-center gap-1">
                    {[-10, -5, +5, +10].map(delta => (
                      <button key={delta} className="btn btn-ghost text-sm px-2 py-1" onClick={() => setPlayer(p.id, 'bonus', entry.bonus + delta)}>
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                    <span className="w-10 text-center tabular-nums">{entry.bonus}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div
                  className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-surface/30 hover:bg-surface/50 transition-colors"
                  onClick={() => setCollapsedSections(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                >
                  <span className="section-title">Cartes spéciales</span>
                  <span className="text-sm opacity-60">{collapsedSections[p.id] ? '▶' : '▼'}</span>
                </div>
                {!collapsedSections[p.id] && (
                  <div className="grid grid-cols-2 gap-2 p-1">
                    {[
                      { key: 'skullKing', icon: '👑' },
                      { key: 'second', icon: '🦜' },
                      { key: 'pirates', icon: '🏴‍☠️' },
                      { key: 'mermaids', icon: '🧜‍♀️' },
                      { key: 'babyPirates', icon: '👶' },
                      { key: 'coins', icon: '🪙' },
                      { key: 'beasts', icon: '🦑' },
                      { key: 'rascalGamble', icon: '🎰' },
                    ].map(({ key, icon }) => (
                      <DualCardCounter
                        key={key}
                        icon={icon}
                        label=""
                        value={entry.specials?.[key] ?? { positive: 0, negative: 0 }}
                        onChange={(v) => setPlayer(p.id, 'specials', { ...entry.specials, [key]: v })}
                      />
                    ))}
                    <DualCardCounter
                      icon="🃏"
                      label=""
                      value={{ positive: entry.specials?.jokerBonus?.positive ?? 0, negative: 0 }}
                      disableNegative
                      onChange={(v) => setPlayer(p.id, 'specials', { ...entry.specials, jokerBonus: { positive: v.positive } })}
                    />
                    <DualCardCounter
                      icon="🚩"
                      label=""
                      value={{ positive: 0, negative: entry.specials?.punishment?.negative ?? 0 }}
                      disablePositive
                      onChange={(v) => setPlayer(p.id, 'specials', { ...entry.specials, punishment: { negative: v.negative } })}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="opacity-80 text-sm">Score projeté</span>
                <span className={projected >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {projected >= 0 ? `+${projected}` : projected}
                </span>
              </div>
            </div>
          );
        })}

        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={saveRound}>
            Valider la manche ✓
          </button>
        </div>
      </div>
    </Layout>
  );
}
