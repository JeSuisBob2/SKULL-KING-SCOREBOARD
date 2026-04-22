import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export function useGame(gameId?: string) {
  const { currentGame, rounds, loadGame } = useStore();

  useEffect(() => {
    if (gameId) {
      loadGame(gameId);
    }
  }, [gameId, loadGame]);

  return { game: currentGame, rounds };
}
