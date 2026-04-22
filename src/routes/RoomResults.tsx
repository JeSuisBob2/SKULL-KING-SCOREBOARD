import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import NumberStepper from '../components/NumberStepper';
import DualCardCounter from '../components/DualCardCounter';
import ScoreChip from '../components/ScoreChip';
import { useRoomStore } from '../store/useRoomStore';
import { calculateScore } from '../lib/score';
import { presets } from '../config/scoringConfig';
import ScoreOverview from '../components/ScoreOverview';
import ExcelJS from 'exceljs';

import ShameBag from '../components/ShameBag';

const EMPTY_SPECIALS = () => ({
  skullKing: { positive: 0, negative: 0 },
  second: { positive: 0, negative: 0 },
  pirates: { positive: 0, negative: 0 },
  mermaids: { positive: 0, negative: 0 },
  babyPirates: { positive: 0, negative: 0 },
  coins: { positive: 0, negative: 0 },
  beasts: { positive: 0, negative: 0 },
  rascalGamble: { positive: 0, negative: 0 },
  jokerBonus: { positive: 0, negative: 0 },
  punishment: { positive: 0, negative: 0 },
});

export default function RoomResults() {
  const nav = useNavigate();
  const { roomId, roundNumber } = useParams();
  const { room, bids, results, shameLog, myPlayerId, kicked, subscribeToRoom, unsubscribeFromRoom, submitResult, markResultDone, advanceToNextRound, hostOverrideResult, deleteRoom, submitResultForPlayer, markResultDoneForPlayer, shamePenalty, removeShame } = useRoomStore();

  const rNum = Number(roundNumber || 1);
  const isHost = room?.host_player_id === myPlayerId;

  const [tricks, setTricks] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [harryAdj, setHarryAdj] = useState(0);
  const [specials, setSpecials] = useState(EMPTY_SPECIALS());
  const [collapsedSpecials, setCollapsedSpecials] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const [managedData, setManagedData] = useState<Record<string, { tricks: number; bonus: number; harryAdj: number; specials: any }>>({});
  const [managedDone, setManagedDone] = useState<Record<string, boolean>>({});
  const [managedCollapsed, setManagedCollapsed] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Record<string, { tricks: number; bonus: number; harryAdj: number; specials: any }>>({});
  const [collapsedEdit, setCollapsedEdit] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (roomId) subscribeToRoom(roomId);
    return () => unsubscribeFromRoom();
  }, [roomId]);

  // Load my existing result
  useEffect(() => {
    const existing = results.find(r => r.player_id === myPlayerId && r.round_number === rNum);
    if (existing) {
      setTricks(existing.tricks);
      setBonus(existing.bonus);
      if (existing.specials && Object.keys(existing.specials).length > 0) {
        setSpecials({ ...EMPTY_SPECIALS(), ...existing.specials });
      }
      if (existing.is_done) setSubmitted(true);
    }
  }, [results, myPlayerId, rNum]);

  // Navigate on room status change
  useEffect(() => {
    if (!room) return;
    if (room.status === 'bidding') {
      nav(`/room/${room.id}/round/${room.current_round}/bets`, { replace: true });
    }
  }, [room?.status, room?.current_round]);

  // Navigate home when room is deleted or player is kicked
  useEffect(() => {
    if (!room) nav('/', { replace: true });
  }, [room]);

  useEffect(() => {
    if (kicked) nav('/', { replace: true });
  }, [kicked]);

  const currentRoundResults = results.filter(r => r.round_number === rNum);
  const doneCount = currentRoundResults.filter(r => r.is_done).length;
  const totalPlayers = room?.players.length ?? 0;
  const allDone = doneCount >= totalPlayers && totalPlayers > 0;

  const standings = useMemo(() => {
    if (!room) return [];
    return [...room.players]
      .map(p => ({
        player: p,
        total: results.filter(r => r.player_id === p.id && r.is_done).reduce((sum, r) => sum + r.score, 0)
             + shameLog.filter(e => e.playerId === p.id).reduce((sum, e) => sum + e.amount, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [room, results, shameLog]);

  const myBid = bids.find(b => b.player_id === myPlayerId && b.round_number === rNum);
  const config = presets[room?.scoring_preset_id ?? 'standard'] ?? presets.standard;
  const effectiveBid = (myBid?.bid ?? 0) + harryAdj;
  const projectedScore = calculateScore(effectiveBid, tricks, rNum, bonus, config);

  const handleSubmit = async () => {
    await submitResult({ tricks, bonus, harryAdjustment: harryAdj, specials });
    await markResultDone();
    setSubmitted(true);
  };

  const exportToExcel = async () => {
    if (!room) return;

    const completedRounds = Array.from(
      new Set(results.filter(r => r.is_done).map(r => r.round_number))
    ).sort((a, b) => a - b);

    const shameFor = (pid: string) =>
      shameLog.filter(e => e.playerId === pid).reduce((s, e) => s + e.amount, 0);

    const totalFor = (pid: string) =>
      results.filter(r => r.player_id === pid && r.is_done).reduce((s, r) => s + r.score, 0) + shameFor(pid);

    const sortedPlayers = [...room.players].sort((a, b) => totalFor(b.id) - totalFor(a.id));
    const date = new Date().toLocaleDateString('fr-FR');
    const hasPenalties = shameLog.length > 0;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('SkullKing');

    // Style helpers
    const blackBorder: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF000000' } };
    const allBorders: Partial<ExcelJS.Borders> = { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder };
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    const applyBorder = (row: ExcelJS.Row, colCount: number, bold = false, fill?: ExcelJS.Fill) => {
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.border = allBorders;
        cell.font = { bold };
        if (fill) cell.fill = fill;
      }
    };

    // ── Infos (Skull King et date fusionnées sur B:C) ─────────────────────
    const infoRow1 = ws.addRow(['Jeu', 'Skull King', '']);
    ws.mergeCells(`B1:C1`);
    applyBorder(infoRow1, 3);
    const infoRow2 = ws.addRow(['Date', date, '']);
    ws.mergeCells(`B2:C2`);
    applyBorder(infoRow2, 3);

    // ── En-tête classement ────────────────────────────────────────────────
    const summaryHeaders = ['Classement', 'Joueur', 'Score total', ...completedRounds.map(r => `M${r}`), ...(hasPenalties ? ['Pénalités'] : [])];
    const headerRow = ws.addRow(summaryHeaders);
    applyBorder(headerRow, summaryHeaders.length, true, headerFill);

    // ── Données joueurs ───────────────────────────────────────────────────
    sortedPlayers.forEach((p, i) => {
      const roundScores = completedRounds.map(r =>
        results.find(x => x.player_id === p.id && x.round_number === r && x.is_done)?.score ?? ''
      );
      const penalty = shameFor(p.id);
      const dataRow = ws.addRow([i + 1, p.name, totalFor(p.id), ...roundScores, ...(hasPenalties ? [penalty || ''] : [])]);
      applyBorder(dataRow, summaryHeaders.length);
    });

    // ── Ligne vide + en-tête détail ───────────────────────────────────────
    ws.addRow([]);
    const detailHeaders = ['Classement', 'Joueur', 'Manche', 'Pari', 'Plis réalisés', 'Harry', 'Bonus', 'Score manche', 'Cumul'];
    const detailHeaderRow = ws.addRow(detailHeaders);
    applyBorder(detailHeaderRow, detailHeaders.length, true, headerFill);

    // ── Détail par manche ─────────────────────────────────────────────────
    sortedPlayers.forEach((p, rank) => {
      let cumul = 0;
      completedRounds.forEach(r => {
        const res = results.find(x => x.player_id === p.id && x.round_number === r && x.is_done);
        const bid = bids.find(x => x.player_id === p.id && x.round_number === r);
        const score = res?.score ?? 0;
        cumul += score;
        const harry = bid?.harry_adjustment;
        const detailRow = ws.addRow([
          rank + 1,
          p.name,
          r,
          bid?.bid ?? '',
          res?.tricks ?? '',
          harry ? (harry > 0 ? `+${harry}` : harry) : '',
          res?.bonus || '',
          score,
          cumul,
        ]);
        applyBorder(detailRow, detailHeaders.length);
      });
      if (shameFor(p.id) !== 0) {
        const penRow = ws.addRow([rank + 1, p.name, 'Pénalités', '', '', '', '', shameFor(p.id), totalFor(p.id)]);
        applyBorder(penRow, detailHeaders.length);
      }
    });

    // ── Largeurs colonnes (après ajout des lignes) ─────────────────────────
    const maxCols = Math.max(summaryHeaders.length, detailHeaders.length);
    const colWidths = [14, 18, 13, 9, 11, 9, 9, 13, 9];
    for (let c = 1; c <= maxCols; c++) {
      ws.getColumn(c).width = colWidths[c - 1] ?? 10;
    }

    // ── Téléchargement ────────────────────────────────────────────────────
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skullking_${room.code}_${date.replace(/\//g, '-')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!room) return null;

  const isRoundComplete = room.status === 'round-complete';
  const isComplete = room.status === 'complete';

  const openEditMode = () => {
    const data: typeof editData = {};
    const collapsed: typeof collapsedEdit = {};
    for (const p of room.players) {
      const r = currentRoundResults.find(x => x.player_id === p.id);
      const b = bids.find(x => x.player_id === p.id && x.round_number === rNum);
      data[p.id] = {
        tricks: r?.tricks ?? 0,
        bonus: r?.bonus ?? 0,
        harryAdj: b?.harry_adjustment ?? 0,
        specials: r?.specials ? { ...EMPTY_SPECIALS(), ...r.specials } : EMPTY_SPECIALS(),
      };
      collapsed[p.id] = true;
    }
    setEditData(data);
    setCollapsedEdit(collapsed);
    setEditMode(true);
  };

  const saveEdits = () => {
    for (const p of room.players) {
      const d = editData[p.id];
      if (!d) continue;
      hostOverrideResult(p.id, { tricks: d.tricks, bonus: d.bonus, harryAdjustment: d.harryAdj, specials: d.specials });
    }
    setEditMode(false);
  };

  const setEdit = (pid: string, key: string, value: any) =>
    setEditData(s => ({ ...s, [pid]: { ...s[pid], [key]: value } }));

  return (
    <Layout title={`Résultats · Manche ${rNum}/${room.total_rounds}`}>
      <div className="space-y-4">
        {/* Done status bar */}
        <div className="card p-3 flex items-center justify-between">
          <span className="text-sm">Terminés</span>
          <span className={`font-bold ${allDone ? 'text-emerald-400' : 'text-white'}`}>
            {doneCount}/{totalPlayers}
          </span>
        </div>

        {/* Standings — caché manches 1-5 */}
        {rNum > 5 && (
          <div className="card p-3">
            <button
              className="w-full flex items-center justify-between text-sm"
              onClick={() => setShowStandings(v => !v)}
            >
              <div className="flex items-center gap-2">
                <span className="section-title">Classement</span>
                {(() => {
                  const ts = bids.filter(b => b.round_number === rNum && b.ready_at).map(b => b.ready_at!).sort().at(-1) ?? null;
                  if (!ts) return null;
                  const d = new Date(ts);
                  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                  return <span className="text-xs opacity-40 tabular-nums">{date} {time}</span>;
                })()}
              </div>
              <span className="opacity-60">{showStandings ? '▲' : '▼'}</span>
            </button>
            {showStandings && (
              <ul className="mt-2 space-y-1">
                {standings.map(({ player, total }, i) => (
                  <li key={player.id} className="flex items-center justify-between text-sm">
                    <span>{['👑', '🏴‍☠️', '🧜‍♀️', '👶'][i] ?? `${i + 1}.`} {player.name}</span>
                    <span className="font-semibold text-white">{total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Score history overview — hôte uniquement, caché manches 1-5 */}
        {rNum > 5 && <ScoreOverview room={room} results={results} bids={bids} shameLog={shameLog} myPlayerId={myPlayerId} isHost={isHost} />}

        {/* My results input */}
        {!submitted && !isRoundComplete && (
          <div className="card p-4 space-y-4">
            <div className="section-title">
              Mes résultats · Pari : {myBid?.bid ?? 0}
              {harryAdj !== 0 && ` (Harry ${harryAdj > 0 ? '+' : ''}${harryAdj})`}
            </div>

            <div className="flex items-center justify-between">
              <span>Plis réalisés</span>
              <NumberStepper value={tricks} min={0} max={rNum} onChange={setTricks} />
            </div>

            <div className="flex items-center justify-between">
              <span>Harry The Giant</span>
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost px-3" onClick={() => setHarryAdj(v => Math.max(-2, v - 1))}>−1</button>
                <span className="w-8 text-center font-bold">{harryAdj > 0 ? `+${harryAdj}` : harryAdj}</span>
                <button className="btn btn-ghost px-3" onClick={() => setHarryAdj(v => Math.min(2, v + 1))}>+1</button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span>Bonus</span>
              <div className="flex items-center gap-1">
                {[-20, -10, -5].map(delta => (
                  <button key={delta} className="btn btn-ghost text-sm px-2 py-1" onClick={() => setBonus(v => v + delta)}>
                    {delta}
                  </button>
                ))}
                <span className="w-10 text-center tabular-nums">{bonus}</span>
                {[+5, +10, +20].map(delta => (
                  <button key={delta} className="btn btn-ghost text-sm px-2 py-1" onClick={() => setBonus(v => v + delta)}>
                    +{delta}
                  </button>
                ))}
              </div>
            </div>

            {/* Special cards */}
            <div>
              <button
                className="w-full flex items-center justify-between text-sm py-2"
                onClick={() => setCollapsedSpecials(v => !v)}
              >
                <span className="section-title">Cartes spéciales</span>
                <span className="opacity-60">{collapsedSpecials ? '▶' : '▼'}</span>
              </button>
              {!collapsedSpecials && (
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
                      value={(specials as any)[key]}
                      disableNegative={disableNegative}
                      disablePositive={disablePositive}
                      onChange={v => setSpecials(s => ({ ...s, [key]: v }))}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="opacity-70">Score projeté</span>
              <ScoreChip value={projectedScore} />
            </div>

            <button className="btn btn-primary w-full" onClick={handleSubmit}>
              Valider mes résultats ✓
            </button>
          </div>
        )}

        {submitted && !isRoundComplete && (
          <div className="card p-4 text-center">
            <div className="text-4xl mb-2">⏳</div>
            <p className="font-semibold">En attente des autres joueurs...</p>
            <p className="text-sm opacity-60 mt-1">{doneCount}/{totalPlayers} terminés</p>
            <ScoreChip value={projectedScore} />
          </div>
        )}

        {/* Round complete — show all scores */}
        {isRoundComplete && (
          <div className="space-y-3">
            <div className="card p-3 bg-emerald-500/10 border-emerald-500/30 text-center text-emerald-400 font-semibold">
              Manche {rNum} terminée !
            </div>
            {room.players.map(p => {
              const r = currentRoundResults.find(x => x.player_id === p.id);
              const b = bids.find(x => x.player_id === p.id && x.round_number === rNum);
              const cumScore = results
                .filter(x => x.player_id === p.id && x.round_number <= rNum)
                .reduce((sum, x) => sum + x.score, 0);
              return (
                <div key={p.id} className="card p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs opacity-60">
                      Pari {b?.bid ?? '?'} · Plis {r?.tricks ?? '?'}
                    </div>
                  </div>
                  <div className="text-right">
                    <ScoreChip value={r?.score ?? 0} />
                  </div>
                </div>
              );
            })}

            {isHost && !editMode && (
              <div className="space-y-2">
                <button className="btn btn-ghost w-full text-sm" onClick={openEditMode}>
                  ✏️ Modifier les résultats
                </button>
                <button className="btn btn-primary w-full" onClick={advanceToNextRound}>
                  {rNum >= room.total_rounds ? 'Terminer la partie 🏆' : `Manche ${rNum + 1} →`}
                </button>
              </div>
            )}
            {!isHost && (
              <div className="card p-3 text-center text-sm opacity-60">
                En attente de l'hôte...
              </div>
            )}
          </div>
        )}

        {/* Host edit mode */}
        {isRoundComplete && isHost && editMode && (
          <div className="space-y-4">
            <div className="card p-3 text-center text-sm font-semibold text-accent">
              ✏️ Mode édition — Manche {rNum}
            </div>

            {room.players.map(p => {
              const d = editData[p.id] ?? { tricks: 0, bonus: 0, harryAdj: 0, specials: EMPTY_SPECIALS() };
              const b = bids.find(x => x.player_id === p.id && x.round_number === rNum);
              const projected = calculateScore((b?.bid ?? 0) + d.harryAdj, d.tricks, rNum, d.bonus, config);
              return (
                <div key={p.id} className="card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-sm opacity-60">Pari : {b?.bid ?? 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Plis réalisés</span>
                    <NumberStepper value={d.tricks} min={0} max={rNum} onChange={v => setEdit(p.id, 'tricks', v)} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Harry The Giant</span>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-ghost px-3" onClick={() => setEdit(p.id, 'harryAdj', Math.max(-2, d.harryAdj - 1))}>−1</button>
                      <span className="w-8 text-center font-bold">{d.harryAdj > 0 ? `+${d.harryAdj}` : d.harryAdj}</span>
                      <button className="btn btn-ghost px-3" onClick={() => setEdit(p.id, 'harryAdj', Math.min(2, d.harryAdj + 1))}>+1</button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Bonus</span>
                    <div className="flex items-center gap-1">
                      {[-20, -10, -5].map(delta => (
                        <button key={delta} className="btn btn-ghost text-sm px-2 py-1" onClick={() => setEdit(p.id, 'bonus', d.bonus + delta)}>
                          {delta}
                        </button>
                      ))}
                      <span className="w-10 text-center tabular-nums">{d.bonus}</span>
                      {[+5, +10, +20].map(delta => (
                        <button key={delta} className="btn btn-ghost text-sm px-2 py-1" onClick={() => setEdit(p.id, 'bonus', d.bonus + delta)}>
                          +{delta}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <button
                      className="w-full flex items-center justify-between text-sm py-2"
                      onClick={() => setCollapsedEdit(s => ({ ...s, [p.id]: !s[p.id] }))}
                    >
                      <span className="section-title">Cartes spéciales</span>
                      <span className="opacity-60">{collapsedEdit[p.id] ? '▶' : '▼'}</span>
                    </button>
                    {!collapsedEdit[p.id] && (
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
                            value={d.specials[key] ?? { positive: 0, negative: 0 }}
                            disableNegative={disableNegative}
                            disablePositive={disablePositive}
                            onChange={v => setEdit(p.id, 'specials', { ...d.specials, [key]: v })}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10 text-sm">
                    <span className="opacity-70">Score projeté</span>
                    <ScoreChip value={projected} />
                  </div>
                </div>
              );
            })}

            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setEditMode(false)}>Annuler</button>
              <button className="btn btn-primary flex-1" onClick={saveEdits}>Enregistrer ✓</button>
            </div>
          </div>
        )}

        {/* Managed players results (host only, scoring phase) */}
        {isHost && room.status === 'scoring' && room.players.filter(p => p.managedByHost).map(p => {
          const d = managedData[p.id] ?? { tricks: 0, bonus: 0, harryAdj: 0, specials: EMPTY_SPECIALS() };
          const b = bids.find(x => x.player_id === p.id && x.round_number === rNum);
          const isDone = managedDone[p.id] ?? results.find(r => r.player_id === p.id && r.round_number === rNum)?.is_done ?? false;
          const projected = calculateScore((b?.bid ?? 0) + d.harryAdj, d.tricks, rNum, d.bonus, config);
          const setD = (key: string, val: any) => setManagedData(s => ({ ...s, [p.id]: { ...s[p.id] ?? d, [key]: val } }));

          return (
            <div key={p.id} className="card p-4 space-y-3 border border-white/20">
              <div className="section-title">Résultats de {p.name} — Pari : {b?.bid ?? 0}</div>
              {!isDone ? (
                <>
                  <div className="flex items-center justify-between">
                    <span>Plis réalisés</span>
                    <NumberStepper value={d.tricks} min={0} max={rNum} onChange={v => setD('tricks', v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Harry The Giant</span>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-ghost px-3" onClick={() => setD('harryAdj', Math.max(-2, d.harryAdj - 1))}>−1</button>
                      <span className="w-8 text-center font-bold">{d.harryAdj > 0 ? `+${d.harryAdj}` : d.harryAdj}</span>
                      <button className="btn btn-ghost px-3" onClick={() => setD('harryAdj', Math.min(2, d.harryAdj + 1))}>+1</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Bonus</span>
                    <div className="flex items-center gap-1">
                      {[-20, -10, -5].map(delta => (
                        <button key={delta} className="btn btn-ghost text-sm px-2 py-1" onClick={() => setD('bonus', d.bonus + delta)}>
                          {delta}
                        </button>
                      ))}
                      <span className="w-10 text-center tabular-nums">{d.bonus}</span>
                      {[+5, +10, +20].map(delta => (
                        <button key={delta} className="btn btn-ghost text-sm px-2 py-1" onClick={() => setD('bonus', d.bonus + delta)}>
                          +{delta}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <button
                      className="w-full flex items-center justify-between text-sm py-2"
                      onClick={() => setManagedCollapsed(s => ({ ...s, [p.id]: !s[p.id] }))}
                    >
                      <span className="section-title">Cartes spéciales</span>
                      <span className="opacity-60">{managedCollapsed[p.id] ? '▶' : '▼'}</span>
                    </button>
                    {!managedCollapsed[p.id] && (
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
                            value={d.specials[key] ?? { positive: 0, negative: 0 }}
                            disableNegative={disableNegative}
                            disablePositive={disablePositive}
                            onChange={v => setD('specials', { ...d.specials, [key]: v })}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/10 text-sm">
                    <span className="opacity-70">Score projeté</span>
                    <ScoreChip value={projected} />
                  </div>
                  <button
                    className="btn btn-ghost w-full"
                    onClick={() => {
                      submitResultForPlayer(p.id, { tricks: d.tricks, bonus: d.bonus, harryAdjustment: d.harryAdj, specials: d.specials });
                      markResultDoneForPlayer(p.id);
                      setManagedDone(s => ({ ...s, [p.id]: true }));
                    }}
                  >
                    Valider les résultats de {p.name} ✓
                  </button>
                </>
              ) : (
                <div className="text-center text-sm opacity-60">Résultats validés ✓</div>
              )}
            </div>
          );
        })}

        {/* Sac de la honte — hôte uniquement */}
        {isHost && (
          <ShameBag players={room.players} currentRound={rNum} shameLog={shameLog} onApply={shamePenalty} onRemove={removeShame} />
        )}

        {/* Status list — hidden when game is complete */}
        {!isComplete && (
          <div className="card p-4">
            <div className="section-title mb-2">Statut</div>
            <ul className="space-y-1">
              {room.players.map(p => {
                const r = currentRoundResults.find(x => x.player_id === p.id);
                return (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <span>{p.name}</span>
                    <span className={r?.is_done ? 'text-emerald-400' : 'text-white/30'}>
                      {r?.is_done ? '✓ Terminé' : '⏳'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Game complete — final podium */}
        {isComplete && (
          <div className="space-y-3">
            <div className="card p-3 bg-yellow-500/10 border-yellow-500/30 text-center text-yellow-400 font-bold text-lg">
              🏆 Partie terminée !
            </div>

            {standings.map(({ player, total }, i) => (
              <div key={player.id} className={`card p-4 flex items-center justify-between ${i === 0 ? 'ring-2 ring-yellow-400 shadow-[0_0_16px_4px_#facc1533]' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{['👑', '🏴‍☠️', '🧜‍♀️', '👶'][i] ?? `${i + 1}.`}</span>
                  <span className="font-semibold">{player.name}</span>
                </div>
                <span className="text-xl font-bold text-white">{total}</span>
              </div>
            ))}

            <button
              className="btn btn-ghost w-full"
              onClick={exportToExcel}
            >
              📊 Exporter en Excel
            </button>

            {isHost && (
              <button
                className="btn btn-danger w-full"
                onClick={deleteRoom}
              >
                Fermer la salle
              </button>
            )}
            {!isHost && (
              <div className="card p-3 text-center text-sm opacity-60">
                En attente que l'hôte ferme la salle...
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
