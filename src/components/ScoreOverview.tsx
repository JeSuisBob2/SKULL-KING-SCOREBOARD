import { useState } from 'react';

const formatTime = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};
import { useRoomStore } from '../store/useRoomStore';
import NumberStepper from './NumberStepper';
import DualCardCounter from './DualCardCounter';
import ScoreChip from './ScoreChip';
import { calculateScore } from '../lib/score';
import { presets } from '../config/scoringConfig';
import type { RoomRow, RoomBidRow, RoomResultRow, ShameEntry } from '../lib/supabase';

const EMPTY_SPECIALS = () => ({
  skullKing:    { positive: 0, negative: 0 },
  second:       { positive: 0, negative: 0 },
  pirates:      { positive: 0, negative: 0 },
  mermaids:     { positive: 0, negative: 0 },
  babyPirates:  { positive: 0, negative: 0 },
  coins:        { positive: 0, negative: 0 },
  beasts:       { positive: 0, negative: 0 },
  rascalGamble: { positive: 0, negative: 0 },
  jokerBonus:   { positive: 0, negative: 0 },
  punishment:   { positive: 0, negative: 0 },
});

interface Props {
  room: RoomRow;
  results: RoomResultRow[];
  bids: RoomBidRow[];
  shameLog: ShameEntry[];
  myPlayerId: string;
  isHost: boolean;
}

interface PlayerEditState {
  tricks: number;
  bonus: number;
  harryAdj: number;
  specials: ReturnType<typeof EMPTY_SPECIALS>;
  collapsedSpecials: boolean;
}

export default function ScoreOverview({ room, results, bids, shameLog, myPlayerId, isHost }: Props) {
  const { hostOverrideResult } = useRoomStore();
  const [open, setOpen] = useState(false);
  const [editingRound, setEditingRound] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, PlayerEditState>>({});

  const completedRounds = Array.from(
    new Set(results.filter(r => r.is_done && r.round_number > 0).map(r => r.round_number))
  ).sort((a, b) => a - b);

  // totalFor includes round 0 (shame penalties before round 1)
  if (completedRounds.length === 0 && !results.some(r => r.is_done)) return null;

  const resultFor = (pid: string, round: number) =>
    results.find(x => x.player_id === pid && x.round_number === round && x.is_done) ?? null;

  const bidFor = (pid: string, round: number) =>
    bids.find(x => x.player_id === pid && x.round_number === round) ?? null;

  const shameFor = (pid: string) =>
    shameLog.filter(e => e.playerId === pid).reduce((s, e) => s + e.amount, 0);

  const totalFor = (pid: string) =>
    results.filter(r => r.player_id === pid && r.is_done).reduce((s, r) => s + r.score, 0) + shameFor(pid);

  const openEdit = (round: number) => {
    const data: Record<string, PlayerEditState> = {};
    for (const p of room.players) {
      const res = resultFor(p.id, round);
      const bid = bidFor(p.id, round);
      data[p.id] = {
        tricks: res?.tricks ?? 0,
        bonus: res?.bonus ?? 0,
        harryAdj: bid?.harry_adjustment ?? 0,
        specials: res?.specials ? { ...EMPTY_SPECIALS(), ...res.specials } : EMPTY_SPECIALS(),
        collapsedSpecials: true,
      };
    }
    setEditData(data);
    setEditingRound(round);
  };

  const setField = (pid: string, key: keyof PlayerEditState, value: any) =>
    setEditData(s => ({ ...s, [pid]: { ...s[pid], [key]: value } }));

  const saveEdit = () => {
    if (editingRound === null) return;
    for (const p of room.players) {
      const d = editData[p.id];
      if (!d) continue;
      hostOverrideResult(p.id, {
        tricks: d.tricks,
        bonus: d.bonus,
        harryAdjustment: d.harryAdj,
        specials: d.specials,
      }, editingRound);
    }
    setEditingRound(null);
  };

  const config = presets[room.scoring_preset_id as keyof typeof presets] ?? presets.standard;

  return (
    <div className="card p-3">
      <button
        className="w-full flex items-center justify-between text-sm"
        onClick={() => { setOpen(v => !v); setEditingRound(null); }}
      >
        <span className="section-title">📊 Vue d'ensemble</span>
        <span className="opacity-60">{open ? '▲' : '▼'}</span>
      </button>

      {open && !editingRound && (
        <div className="mt-3 overflow-x-auto -mx-1 px-1">
          <table className="w-full text-center border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left opacity-50 font-normal pb-2 pr-2 text-xs"></th>
                {room.players.map(p => (
                  <th key={p.id} className={`pb-2 font-semibold text-xs px-1 whitespace-nowrap ${p.id === myPlayerId ? 'text-accent' : ''}`}>
                    {p.name}
                  </th>
                ))}
                {isHost && <th className="pb-2"></th>}
              </tr>
            </thead>
            <tbody>
              {completedRounds.map(round => {
                const roundTimestamp = (() => {
                  const ts = room.players.map(p => bidFor(p.id, round)?.ready_at).filter(Boolean)[0] ?? null;
                  if (!ts) return null;
                  const d = new Date(ts);
                  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  return `${date} ${time}`;
                })();
                return (
                <tr key={round} className="border-t border-white/10">
                  <td className="text-left py-2 pr-2 text-xs whitespace-nowrap align-middle">
                    <span className="opacity-50">M{round}</span>
                    {roundTimestamp && <div className="opacity-30 tabular-nums leading-tight">{roundTimestamp}</div>}
                  </td>
                  {room.players.map(p => {
                    const res = resultFor(p.id, round);
                    const bid = bidFor(p.id, round);
                    const score = res?.score ?? null;
                    const harry = bid?.harry_adjustment ?? 0;
                    return (
                      <td key={p.id} className="py-1.5 px-1 align-middle">
                        <div className={`font-bold tabular-nums text-base ${score === null ? 'opacity-20' : score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'opacity-70'}`}>
                          {score === null ? '–' : score > 0 ? `+${score}` : score}
                        </div>
                        {res && (
                          <div className="text-sm font-semibold text-white leading-tight mt-0.5">
                            {res.tricks}p{harry !== 0 ? ` H${harry > 0 ? '+' : ''}${harry}` : ''}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {isHost && (
                    <td className="py-1.5 pl-2 align-middle">
                      <button
                        className="text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors whitespace-nowrap"
                        onClick={() => openEdit(round)}
                      >
                        ✏️ Résultats
                      </button>
                    </td>
                  )}
                </tr>
                );
              })}
              {room.players.some(p => shameFor(p.id) !== 0) && (
                <tr className="border-t border-white/10">
                  <td className="text-left py-2 pr-2 text-xs whitespace-nowrap align-middle opacity-50">🎒 Sac</td>
                  {room.players.map(p => {
                    const penalty = shameFor(p.id);
                    return (
                      <td key={p.id} className="py-1.5 px-1 align-middle">
                        {penalty !== 0 && (
                          <div className="font-semibold tabular-nums text-sm text-red-400">
                            {penalty}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {isHost && <td></td>}
                </tr>
              )}
              <tr className="border-t-2 border-white/20">
                <td className="text-left py-2 pr-2 font-semibold text-xs">Total</td>
                {room.players.map(p => (
                  <td key={p.id} className="py-2 px-1 font-bold text-white tabular-nums text-sm">
                    {totalFor(p.id)}
                  </td>
                ))}
                {isHost && <td></td>}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Full edit form for a specific round */}
      {open && editingRound !== null && (
        <div className="mt-3 space-y-4">
          <div className="text-sm font-semibold text-center opacity-70">✏️ Modifier manche {editingRound}</div>

          {room.players.map(p => {
            const d = editData[p.id];
            if (!d) return null;
            const bid = bidFor(p.id, editingRound);
            const effectiveBid = (bid?.bid ?? 0) + d.harryAdj;
            const projected = calculateScore(effectiveBid, d.tricks, editingRound, d.bonus, config);
            return (
              <div key={p.id} className="card p-4 space-y-3 border border-white/20">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-sm opacity-60">Pari : {bid?.bid ?? 0}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Plis réalisés</span>
                  <NumberStepper value={d.tricks} min={0} max={editingRound} onChange={v => setField(p.id, 'tricks', v)} />
                </div>

                <div className="flex items-center justify-between">
                  <span>Harry The Giant</span>
                  <div className="flex items-center gap-2">
                    <button className="btn btn-ghost px-3" onClick={() => setField(p.id, 'harryAdj', Math.max(-2, d.harryAdj - 1))}>−1</button>
                    <span className="w-8 text-center font-bold">{d.harryAdj > 0 ? `+${d.harryAdj}` : d.harryAdj}</span>
                    <button className="btn btn-ghost px-3" onClick={() => setField(p.id, 'harryAdj', Math.min(2, d.harryAdj + 1))}>+1</button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span>Bonus</span>
                  <div className="flex items-center gap-1">
                    {[-20, -10, -5].map(delta => (
                      <button key={delta} className="btn btn-ghost text-sm px-2 py-1" onClick={() => setField(p.id, 'bonus', d.bonus + delta)}>
                        {delta}
                      </button>
                    ))}
                    <span className="w-10 text-center tabular-nums">{d.bonus}</span>
                    {[+5, +10, +20].map(delta => (
                      <button key={delta} className="btn btn-ghost text-sm px-2 py-1" onClick={() => setField(p.id, 'bonus', d.bonus + delta)}>
                        +{delta}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <button
                    className="w-full flex items-center justify-between text-sm py-2"
                    onClick={() => setField(p.id, 'collapsedSpecials', !d.collapsedSpecials)}
                  >
                    <span className="section-title">Cartes spéciales</span>
                    <span className="opacity-60">{d.collapsedSpecials ? '▶' : '▼'}</span>
                  </button>
                  {!d.collapsedSpecials && (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {[
                        { key: 'skullKing', icon: '👑' },
                        { key: 'second', icon: '🦜' },
                        { key: 'pirates', icon: '🏴‍☠️' },
                        { key: 'mermaids', icon: '🧜‍♀️' },
                        { key: 'babyPirates', icon: '👶' },
                        { key: 'coins', icon: '🪙' },
                        { key: 'beasts', icon: '🦑' },
                        { key: 'rascalGamble', icon: '🎰' },
                        { key: 'jokerBonus', icon: '🃏', disableNegative: true },
                        { key: 'punishment', icon: '🚩', disablePositive: true },
                      ].map(({ key, icon, disableNegative, disablePositive }) => (
                        <DualCardCounter
                          key={key}
                          icon={icon}
                          label=""
                          value={(d.specials as any)[key]}
                          disableNegative={disableNegative}
                          disablePositive={disablePositive}
                          onChange={v => setField(p.id, 'specials', { ...d.specials, [key]: v })}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="opacity-70 text-sm">Score projeté</span>
                  <ScoreChip value={projected} />
                </div>
              </div>
            );
          })}

          <div className="flex gap-2">
            <button className="btn btn-ghost flex-1" onClick={() => setEditingRound(null)}>← Retour</button>
            <button className="btn btn-primary flex-1" onClick={saveEdit}>Enregistrer ✓</button>
          </div>
        </div>
      )}
    </div>
  );
}
