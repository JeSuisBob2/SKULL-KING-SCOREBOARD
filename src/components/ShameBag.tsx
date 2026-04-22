import { useState } from 'react';
import type { RoomPlayer, ShameEntry } from '../lib/supabase';

interface Props {
  players: RoomPlayer[];
  currentRound: number;
  shameLog: ShameEntry[];
  onApply: (pid: string, amount: -10 | -20) => void;
  onRemove: (entryId: string) => void;
}

export default function ShameBag({ players, currentRound, shameLog, onApply, onRemove }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  const roundLog = shameLog.filter(e => e.round === currentRound);

  const apply = (amount: -10 | -20) => {
    onApply(selectedId, amount);
    // Joueur reste sélectionné pour pouvoir stacker plusieurs pénalités
  };

  return (
    <div className="card p-3">
      <button
        className="w-full flex items-center justify-between text-sm"
        onClick={() => setIsOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="section-title">🎒 Sac de la honte</span>
          {roundLog.length > 0 && (
            <span className="text-xs bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded-full font-bold">
              {roundLog.length}
            </span>
          )}
        </div>
        <span className="opacity-60">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          {/* Sélection du joueur */}
          <div className="flex flex-wrap gap-2">
            {players.map(p => (
              <button
                key={p.id}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  selectedId === p.id
                    ? 'bg-red-500/30 text-red-300 ring-1 ring-red-400'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
                onClick={() => setSelectedId(prev => prev === p.id ? '' : p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Boutons de pénalité */}
          {selectedId ? (
            <div className="space-y-2">
              <p className="text-xs opacity-50 text-center">
                Pénalité pour <span className="text-white font-semibold">
                  {players.find(p => p.id === selectedId)?.name}
                </span>
              </p>
              <div className="flex gap-3">
                <button
                  className="flex-1 btn bg-red-500/20 text-red-400 hover:bg-red-500/40 font-bold py-2"
                  onClick={() => apply(-10)}
                >
                  −10 pts
                </button>
                <button
                  className="flex-1 btn bg-red-700/20 text-red-300 hover:bg-red-700/40 font-bold py-2"
                  onClick={() => apply(-20)}
                >
                  −20 pts
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs opacity-40 text-center">Sélectionne un joueur</p>
          )}

          {/* Historique des pénalités de cette manche */}
          {roundLog.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-white/10">
              <p className="text-xs opacity-40">Pénalités manche {currentRound} :</p>
              {roundLog.map(entry => (
                <div key={entry.id} className="flex items-center justify-between text-sm">
                  <span className="opacity-80">🎒 {entry.playerName}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-400">{entry.amount} pts</span>
                    <button
                      className="text-xs opacity-40 hover:opacity-100 hover:text-red-400 transition-opacity"
                      onClick={() => onRemove(entry.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
