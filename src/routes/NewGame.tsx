import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import NumberStepper from '../components/NumberStepper';
import { Player } from '../types';
import { uid, shuffleArray } from '../lib/utils';
import { useStore } from '../store/useStore';
import PlayerNameCombobox from '../components/PlayerNameCombobox';

export default function NewGame() {
  const nav = useNavigate();
  const { createGame } = useStore();
  const [rounds, setRounds] = useState(10);
  const [players, setPlayers] = useState<Player[]>([
    { id: uid(), name: '' },
    { id: uid(), name: '' },
  ]);
  const [randomizeOrder, setRandomizeOrder] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<Player[] | null>(null);

  const addPlayer = () => setPlayers(ps => [...ps, { id: uid(), name: '' }]);
  const removePlayer = (id: string) => setPlayers(ps => ps.filter(p => p.id !== id));
  const updateName = (id: string, name: string) =>
    setPlayers(ps => ps.map(p => (p.id === id ? { ...p, name } : p)));

  const canStart = players.length >= 2 && players.length <= 10 && rounds >= 1;

  const start = async (orderedPlayers: Player[]) => {
    const finalPlayers = orderedPlayers.map((p, idx) => ({
      ...p,
      name: p.name.trim() || `Joueur ${idx + 1}`,
    }));
    const gameId = await createGame({ players: finalPlayers, totalRounds: rounds, scoringPresetId: 'standard' });
    nav(`/game/${gameId}/round/1/bets`);
  };

  const handlePreviewOrder = () => {
    setPreviewOrder(shuffleArray(players));
  };

  return (
    <Layout title="Configuration">
      <div className="space-y-6">
        <section className="card p-4">
          <div className="section-title mb-2">Manches</div>
          <NumberStepper value={rounds} min={1} max={20} onChange={setRounds} />
        </section>

        <section className="card p-4">
          <div className="section-title mb-3">Joueurs</div>
          <div className="space-y-2">
            {players.map((p, idx) => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="w-6 text-right opacity-70 text-sm">{idx + 1}.</span>
                <div className="flex-1">
                  <PlayerNameCombobox
                    value={p.name}
                    onChange={name => updateName(p.id, name)}
                    placeholder={`Joueur ${idx + 1}`}
                    currentGamePlayers={players}
                  />
                </div>
                {players.length > 2 && (
                  <button className="btn btn-danger text-sm" onClick={() => removePlayer(p.id)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {players.length < 10 && (
            <button className="btn btn-ghost mt-3 text-sm" onClick={addPlayer}>
              + Ajouter un joueur
            </button>
          )}
        </section>

        <section className="card p-4">
          <div className="section-title mb-2">Ordre de jeu</div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={randomizeOrder}
              onChange={() => { setRandomizeOrder(v => !v); setPreviewOrder(null); }}
              className="rounded"
            />
            <span>Ordre aléatoire</span>
          </label>
          {randomizeOrder && (
            <button className="btn btn-ghost mt-2 text-sm" onClick={handlePreviewOrder}>
              Mélanger & prévisualiser
            </button>
          )}
        </section>

        {previewOrder && (
          <section className="card p-4 border-accent/40">
            <div className="section-title mb-2">Ordre prévisualisé</div>
            <ol className="space-y-1 mb-3">
              {previewOrder.map((p, idx) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 opacity-60">{idx + 1}.</span>
                  <span>{p.name || `Joueur ${idx + 1}`}</span>
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              <button className="btn btn-primary text-sm" onClick={() => start(previewOrder)}>
                Confirmer et démarrer
              </button>
              <button className="btn btn-ghost text-sm" onClick={() => setPreviewOrder(null)}>
                Mélanger à nouveau
              </button>
            </div>
          </section>
        )}

        {!previewOrder && (
          <div className="flex justify-end">
            <button
              disabled={!canStart}
              className="btn btn-primary disabled:opacity-40"
              onClick={() => start(players)}
            >
              Démarrer la partie
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
