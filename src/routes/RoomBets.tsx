import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import NumberStepper from '../components/NumberStepper';
import ScoreChip from '../components/ScoreChip';
import { useRoomStore } from '../store/useRoomStore';
import ScoreOverview from '../components/ScoreOverview';
import ShameBag from '../components/ShameBag';

const formatTime = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

export default function RoomBets() {
  const nav = useNavigate();
  const { roomId, roundNumber } = useParams();
  const {
    room, bids, results, myPlayerId, kicked,
    subscribeToRoom, unsubscribeFromRoom,
    submitBid, markBidReady, advanceToScoring,
    submitBidForPlayer, markBidReadyForPlayer,
    resetMyBid, resetBids, resetBidForPlayer, shamePenalty, removeShame, shameLog,
  } = useRoomStore();

  const rNum = Number(roundNumber || 1);
  const isHost = room?.host_player_id === myPlayerId;

  const [myBid, setMyBid] = useState(0);
  const [myHarry, setMyHarry] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showMyBid, setShowMyBid] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const [managedBids, setManagedBids] = useState<Record<string, number>>({});
  const [managedHarry, setManagedHarry] = useState<Record<string, number>>({});
  const [managedSubmitted, setManagedSubmitted] = useState<Record<string, boolean>>({});

  // Track if player was previously submitted to detect rollback vs first load
  const wasSubmittedRef = useRef(false);
  const wasSubmittedManagedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (roomId) subscribeToRoom(roomId);
    return () => unsubscribeFromRoom();
  }, [roomId]);

  // Reset refs when round changes
  useEffect(() => {
    wasSubmittedRef.current = false;
    wasSubmittedManagedRef.current = {};
    setMyBid(0);
    setMyHarry(0);
    setSubmitted(false);
  }, [rNum]);

  // Sync bid state with server (handles rollback + initial load)
  useEffect(() => {
    const existing = bids.find(b => b.player_id === myPlayerId && b.round_number === rNum);
    if (existing) {
      if (existing.bid !== null) setMyBid(existing.bid);
      setMyHarry(existing.harry_adjustment ?? 0);
      setSubmitted(existing.is_ready);
      wasSubmittedRef.current = existing.is_ready;
    } else {
      // Only reset myBid if this is a rollback (was submitted before)
      if (wasSubmittedRef.current) {
        setMyBid(0);
        setMyHarry(0);
      }
      setSubmitted(false);
      wasSubmittedRef.current = false;
    }

    // Sync managed players
    if (room) {
      setManagedSubmitted(() => {
        const next: Record<string, boolean> = {};
        for (const p of room.players.filter(p => p.managedByHost)) {
          const bid = bids.find(b => b.player_id === p.id && b.round_number === rNum);
          if (bid) {
            next[p.id] = bid.is_ready;
            if (bid.bid !== null) setManagedBids(s => ({ ...s, [p.id]: bid.bid! }));
            setManagedHarry(s => ({ ...s, [p.id]: bid.harry_adjustment ?? 0 }));
            wasSubmittedManagedRef.current[p.id] = bid.is_ready;
          } else {
            next[p.id] = false;
            // Only reset if this is a rollback, not first load
            if (wasSubmittedManagedRef.current[p.id]) {
              setManagedBids(s => ({ ...s, [p.id]: 0 }));
              setManagedHarry(s => ({ ...s, [p.id]: 0 }));
            }
            wasSubmittedManagedRef.current[p.id] = false;
          }
        }
        return next;
      });
    }
  }, [bids, myPlayerId, rNum, room]);

  // Navigate when status changes
  useEffect(() => {
    if (!room) return;
    if (room.status === 'scoring') {
      nav(`/room/${room.id}/round/${room.current_round}/results`, { replace: true });
    }
    if (room.current_round !== rNum && (room.status === 'bidding' || room.status === 'revealing')) {
      nav(`/room/${room.id}/round/${room.current_round}/bets`, { replace: true });
    }
  }, [room?.status, room?.current_round]);

  useEffect(() => {
    if (kicked) nav('/', { replace: true });
  }, [kicked]);

  const currentRoundBids = bids.filter(b => b.round_number === rNum);
  const readyCount = currentRoundBids.filter(b => b.is_ready).length;
  const totalPlayers = room?.players.length ?? 0;
  const allReady = readyCount >= totalPlayers && totalPlayers > 0;

  const cumulativeScores = useMemo(() => {
    if (!room) return {};
    const scores: Record<string, number> = {};
    for (const p of room.players) {
      scores[p.id] = results
        .filter(r => r.player_id === p.id && r.is_done && r.round_number < rNum)
        .reduce((sum, r) => sum + r.score, 0)
        + shameLog.filter(e => e.playerId === p.id).reduce((sum, e) => sum + e.amount, 0);
    }
    return scores;
  }, [results, room, rNum]);

  const standings = useMemo(() => {
    if (!room) return [];
    return [...room.players]
      .map(p => ({ player: p, total: cumulativeScores[p.id] ?? 0 }))
      .sort((a, b) => b.total - a.total);
  }, [room, cumulativeScores]);

  const handleReady = async () => {
    await submitBid(myBid, myHarry);
    await markBidReady();
    setSubmitted(true);
    wasSubmittedRef.current = true;
  };

  if (!room) return null;
  const isRevealing = room.status === 'revealing';
  const firstPlayer = room.players[(rNum - 1) % room.players.length];

  return (
    <Layout title={`Paris · Manche ${rNum}/${room.total_rounds}`}>
      <div className="space-y-4">

        {/* Who starts this round */}
        <div className="card p-3 text-sm flex items-center gap-2">
          <span className="opacity-70">Premier à jouer :</span>
          <span className="font-semibold text-accent">{firstPlayer?.name}</span>
        </div>

        {/* Standings — hidden for rounds 1-5 */}
        {rNum > 5 && (
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
                    <span>{['👑', '🏴‍☠️', '🧜‍♀️', '👶'][i] ?? `${i + 1}.`} {player.name}</span>
                    <span className="font-semibold text-white">{total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Score history overview — hôte uniquement */}
        {rNum > 5 && <ScoreOverview room={room} results={results} bids={bids} shameLog={shameLog} myPlayerId={myPlayerId} isHost={isHost} />}

        {/* Ready status bar */}
        <div className="card p-3 flex items-center justify-between">
          <span className="text-sm">Prêts</span>
          <div className="flex items-center gap-3">
            <span className={`font-bold ${allReady ? 'text-emerald-400' : 'text-white'}`}>
              {readyCount}/{totalPlayers}
            </span>
            {isHost && (
              <button
                className="text-xs text-red-400 opacity-60 hover:opacity-100 transition-opacity"
                onClick={() => confirm('Réinitialiser tous les paris de cette manche ?') && resetBids()}
              >
                🔄 Tout annuler
              </button>
            )}
          </div>
        </div>

        {/* My bid input */}
        {!submitted && !isRevealing && (
          <div className="card p-4 space-y-4">
            <div className="section-title">Mon pari — Manche {rNum}</div>

            <div className="flex items-center justify-between">
              <span>Mon pari (0–{rNum})</span>
              <NumberStepper value={myBid} min={0} max={rNum} onChange={setMyBid} />
            </div>

            <button className="btn btn-primary w-full" onClick={handleReady}>
              Je suis prêt ✓
            </button>
          </div>
        )}

        {submitted && !isRevealing && (
          <div className="card p-4 text-center">
            <div className="text-4xl mb-2">⏳</div>
            <p className="font-semibold">En attente des autres joueurs...</p>
            <p className="text-sm opacity-60 mt-1">{readyCount}/{totalPlayers} prêts</p>
            <div className="mt-3 flex items-center justify-center gap-3">
              <span className="text-sm opacity-50">Mon pari :</span>
              {showMyBid ? (
                <span className="font-bold text-white">{myBid}</span>
              ) : (
                <span className="font-bold text-white/30">••••</span>
              )}
              <button
                className="text-xs opacity-50 hover:opacity-100 transition-opacity"
                onClick={() => setShowMyBid(v => !v)}
              >
                {showMyBid ? '🙈' : '👁️'}
              </button>
            </div>
            <button
              className="mt-3 btn btn-ghost w-full text-red-400 border border-red-400/40 hover:bg-red-400/10"
              onClick={resetMyBid}
            >
              🔄 Annuler mon pari
            </button>
          </div>
        )}

        {/* Managed players bids (host only) */}
        {isHost && !isRevealing && room.players.filter(p => p.managedByHost).map(p => {
          const bid = managedBids[p.id] ?? 0;
          const harry = managedHarry[p.id] ?? 0;
          const isReady = managedSubmitted[p.id] ?? false;
          return (
            <div key={p.id} className="card p-4 space-y-3 border border-white/20">
              <div className="section-title">Pari de {p.name}</div>
              {!isReady ? (
                <>
                  <div className="flex items-center justify-between">
                    <span>Pari (0–{rNum})</span>
                    <NumberStepper value={bid} min={0} max={rNum} onChange={v => setManagedBids(s => ({ ...s, [p.id]: v }))} />
                  </div>
                  <button
                    className="btn btn-ghost w-full"
                    onClick={() => {
                      submitBidForPlayer(p.id, bid, harry);
                      markBidReadyForPlayer(p.id);
                      setManagedSubmitted(s => ({ ...s, [p.id]: true }));
                    }}
                  >
                    Valider le pari de {p.name} ✓
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm opacity-60">
                    Pari validé : <span className="font-bold text-white">{bid}</span>
                    {harry !== 0 && <span className="ml-1 opacity-60">Harry {harry > 0 ? `+${harry}` : harry}</span>}
                  </span>
                  <button
                    className="text-xs text-red-400 opacity-60 hover:opacity-100 transition-opacity"
                    onClick={() => resetBidForPlayer(p.id)}
                  >
                    🔄 Reset
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Reveal phase */}
        {isRevealing && (
          <div className="space-y-3">
            <div className="card p-3 bg-emerald-500/10 border-emerald-500/30 text-center text-emerald-400 font-semibold">
              Tous prêts — Révélation des paris !
            </div>
            {(() => {
              const totalBids = currentRoundBids.reduce((sum, b) => sum + (b.bid ?? 0), 0);
              return (
                <div className="card p-3 flex items-center justify-between text-sm">
                  <span className="opacity-70">Total des paris</span>
                  <span className="font-bold text-base">{totalBids} / {rNum}</span>
                </div>
              );
            })()}
            {room.players.map(p => {
              const bid = currentRoundBids.find(b => b.player_id === p.id);
              const isFirst = p.id === firstPlayer?.id;
              return (
                <div key={p.id} className={`card p-4 flex items-center justify-between transition-shadow ${isFirst ? 'ring-2 ring-[#3a86ff] shadow-[0_0_16px_4px_#3a86ff33]' : ''}`}>
                  <div>
                    <div className="font-medium">
                      {p.name}
                      {isFirst && <span className="ml-2 text-xs text-accent font-semibold">⚡ commence</span>}
                      {p.id === myPlayerId && <span className="text-xs ml-1 opacity-50">(vous)</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-accent">{bid?.bid ?? '?'}</div>
                    {(bid?.harry_adjustment ?? 0) !== 0 && (
                      <div className="text-xs opacity-50">H{(bid?.harry_adjustment ?? 0) > 0 ? '+' : ''}{bid?.harry_adjustment}</div>
                    )}
                  </div>
                </div>
              );
            })}

            {isHost && (
              <div className="space-y-2">
                <ShameBag players={room.players} currentRound={rNum} shameLog={shameLog} onApply={shamePenalty} onRemove={removeShame} />
                <button className="btn btn-primary w-full" onClick={advanceToScoring}>
                  Passer aux résultats →
                </button>
                <button
                  className="btn btn-ghost w-full text-sm text-red-400"
                  onClick={() => confirm('Réinitialiser tous les paris de cette manche ?') && resetBids()}
                >
                  🔄 Annuler les paris
                </button>
              </div>
            )}

            {!isHost && (
              <div className="card p-3 text-center text-sm opacity-60">
                En attente que l'hôte passe aux résultats...
              </div>
            )}
          </div>
        )}

        {/* Players status list */}
        <div className="card p-4">
          <div className="section-title mb-2">Statut</div>
          <ul className="space-y-1">
            {room.players.map(p => {
              const bid = currentRoundBids.find(b => b.player_id === p.id);
              return (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <div className="flex items-center gap-2">
                    {isHost && bid && (
                      <button
                        className="text-xs text-red-400 opacity-60 hover:opacity-100 transition-opacity"
                        onClick={() => resetBidForPlayer(p.id)}
                      >
                        🔄
                      </button>
                    )}
                    <span className={bid?.is_ready ? 'text-emerald-400' : 'text-white/30'}>
                      {bid?.is_ready ? '✓' : '⏳'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

      </div>
    </Layout>
  );
}
