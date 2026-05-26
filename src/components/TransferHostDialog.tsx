import { useState } from 'react';
import type { RoomPlayer } from '../lib/supabase';

interface Props {
  open: boolean;
  myPlayerId: string;
  players: RoomPlayer[];
  onClose: () => void;
  onConfirm: (newHostId: string) => void;
}

export default function TransferHostDialog({ open, myPlayerId, players, onClose, onConfirm }: Props) {
  const [selectedHostId, setSelectedHostId] = useState<string>('');

  if (!open) return null;

  // Eligible new hosts: not me, not surrendered, not managed by host
  const candidates = players.filter(
    p => p.id !== myPlayerId && !p.surrendered && !p.managedByHost
  );

  const handleConfirm = () => {
    if (!selectedHostId) return;
    onConfirm(selectedHostId);
    setSelectedHostId('');
  };

  const handleClose = () => {
    setSelectedHostId('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="card p-5 max-w-sm w-full space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-bold text-accent mb-2">👑 Transférer l'hôte</h3>
          <p className="text-sm text-white/70">
            Choisis le joueur qui prendra ta place comme hôte. Tu resteras dans la partie comme joueur normal.
          </p>
        </div>

        {candidates.length === 0 ? (
          <div className="bg-yellow-950/40 border border-yellow-500/40 rounded p-3 text-sm text-white/80">
            ⚠️ Aucun autre joueur disponible.
          </div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {candidates.map(p => (
              <label
                key={p.id}
                className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                  selectedHostId === p.id ? 'bg-accent/20 border border-accent/50' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <input
                  type="radio"
                  name="newHostTransfer"
                  value={p.id}
                  checked={selectedHostId === p.id}
                  onChange={() => setSelectedHostId(p.id)}
                  className="accent-accent"
                />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            className="btn btn-secondary text-sm"
            onClick={handleClose}
          >
            Annuler
          </button>
          <button
            className="btn btn-primary text-sm disabled:opacity-50"
            disabled={!selectedHostId || candidates.length === 0}
            onClick={handleConfirm}
          >
            Transférer
          </button>
        </div>
      </div>
    </div>
  );
}
