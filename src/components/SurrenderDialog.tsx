import { useState } from 'react';
import type { RoomPlayer } from '../lib/supabase';

interface Props {
  open: boolean;
  isHost: boolean;
  myPlayerId: string;
  players: RoomPlayer[];
  onClose: () => void;
  onConfirm: (newHostId?: string) => void;
}

export default function SurrenderDialog({ open, isHost, myPlayerId, players, onClose, onConfirm }: Props) {
  const [selectedHostId, setSelectedHostId] = useState<string>('');

  if (!open) return null;

  // Eligible new hosts: not me, not surrendered, not managed by host
  const candidates = players.filter(
    p => p.id !== myPlayerId && !p.surrendered && !p.managedByHost
  );

  const canConfirm = !isHost || (candidates.length > 0 && !!selectedHostId);
  const noCandidates = isHost && candidates.length === 0;

  const handleConfirm = () => {
    if (isHost) {
      if (!selectedHostId) return;
      onConfirm(selectedHostId);
    } else {
      onConfirm();
    }
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
          <h3 className="text-lg font-bold text-red-400 mb-2">🏳️ Abandonner la partie</h3>
          <p className="text-sm text-white/70">
            Tu es sûr de vouloir abandonner ? Ton score actuel sera conservé mais marqué
            <strong className="text-white"> "Abandonné"</strong> et tu ne joueras plus les manches suivantes.
          </p>
        </div>

        {isHost && !noCandidates && (
          <div className="space-y-2">
            <p className="text-sm text-white/80">
              Tu es l'hôte. Choisis qui te remplacera :
            </p>
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
                    name="newHost"
                    value={p.id}
                    checked={selectedHostId === p.id}
                    onChange={() => setSelectedHostId(p.id)}
                    className="accent-accent"
                  />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {noCandidates && (
          <div className="bg-red-950/40 border border-red-500/40 rounded p-3 text-sm text-white/80">
            ⚠️ Aucun joueur disponible pour reprendre l'hôte. La salle sera <strong>supprimée</strong>.
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
            className="btn bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-50"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {noCandidates ? 'Supprimer la salle' : 'Abandonner'}
          </button>
        </div>
      </div>
    </div>
  );
}
