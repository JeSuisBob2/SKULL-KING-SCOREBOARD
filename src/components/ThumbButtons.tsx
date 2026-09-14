import { useRoomStore } from '../store/useRoomStore';

interface Props {
  targetId: string;
  round: number;
}

/**
 * Pouces 👍/👎 sur un joueur pour la manche en cours (affichés en phase de révélation).
 * Chaque joueur ne peut sélectionner qu'UN seul joueur par manche : choisir une nouvelle
 * cible déplace automatiquement le pouce (côté serveur). Re-cliquer le retire.
 * Le reset à la manche suivante est automatique (pouces liés au numéro de manche).
 */
export default function ThumbButtons({ targetId, round }: Props) {
  const { thumbs, myPlayerId, setThumb, room } = useRoomStore();

  const myDir = thumbs.find(t => t.round === round && t.fromId === myPlayerId && t.toId === targetId)?.dir ?? 0;
  const up = thumbs.filter(t => t.round === round && t.toId === targetId && t.dir === 1).length;
  const down = thumbs.filter(t => t.round === round && t.toId === targetId && t.dir === -1).length;

  // Spectateurs : lecture seule — compteurs visibles, pas de vote
  const isSpectator = room ? !room.players.some(p => p.id === myPlayerId) : false;
  if (isSpectator) {
    if (up === 0 && down === 0) return null;
    return (
      <span className="inline-flex items-center gap-2 text-sm opacity-70">
        {up > 0 && <span>👍 <span className="tabular-nums font-semibold text-emerald-300">{up}</span></span>}
        {down > 0 && <span>👎 <span className="tabular-nums font-semibold text-red-300">{down}</span></span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        className={`text-base leading-none px-2 py-1 rounded-lg transition-colors ${
          myDir === 1
            ? 'bg-emerald-500/40 ring-1 ring-emerald-400'
            : 'bg-white/10 opacity-60 hover:opacity-100 hover:bg-white/20'
        }`}
        onClick={() => setThumb(targetId, myDir === 1 ? 0 : 1)}
        title="Pouce levé"
      >
        👍{up > 0 && <span className="ml-1 text-sm tabular-nums font-bold text-emerald-300">{up}</span>}
      </button>
      <button
        className={`text-base leading-none px-2 py-1 rounded-lg transition-colors ${
          myDir === -1
            ? 'bg-red-500/40 ring-1 ring-red-400'
            : 'bg-white/10 opacity-60 hover:opacity-100 hover:bg-white/20'
        }`}
        onClick={() => setThumb(targetId, myDir === -1 ? 0 : -1)}
        title="Pouce baissé"
      >
        👎{down > 0 && <span className="ml-1 text-sm tabular-nums font-bold text-red-300">{down}</span>}
      </button>
    </span>
  );
}
