import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Home from './routes/Home';
import NewGame from './routes/NewGame';
import Bets from './routes/Bets';
import Results from './routes/Results';
import Summary from './routes/Summary';
import CreateRoom from './routes/CreateRoom';
import JoinRoom from './routes/JoinRoom';
import RoomLobby from './routes/RoomLobby';
import RoomBets from './routes/RoomBets';
import RoomResults from './routes/RoomResults';
import Rules from './routes/Rules';
import { useRoomStore } from './store/useRoomStore';

function RoomAutoReconnect() {
  const nav = useNavigate();
  const location = useLocation();
  const room = useRoomStore(s => s.room);

  useEffect(() => {
    // Si on est sur l'accueil et qu'une room vient d'être récupérée (après refresh),
    // rediriger vers la bonne page
    if (!room || location.pathname.startsWith('/room/')) return;

    const r = room;
    const base = `/room/${r.id}/round/${r.current_round}`;

    if (r.status === 'lobby') {
      nav(`/room/${r.id}/lobby`, { replace: true });
    } else if (r.status === 'bidding' || r.status === 'revealing') {
      nav(`${base}/bets`, { replace: true });
    } else if (r.status === 'scoring' || r.status === 'round-complete') {
      nav(`${base}/results`, { replace: true });
    }
  }, [room?.id]);

  return null;
}

export default function App() {
  return (
    <>
    <RoomAutoReconnect />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/new" element={<NewGame />} />
      <Route path="/game/:gameId/round/:roundNumber/bets" element={<Bets />} />
      <Route path="/game/:gameId/round/:roundNumber/results" element={<Results />} />
      <Route path="/game/:gameId/summary" element={<Summary />} />
      <Route path="/game/:gameId/dashboard" element={<Navigate to="../summary" replace />} />
      <Route path="/game/:gameId/final" element={<Navigate to="../summary" replace />} />

      {/* Multiplayer routes */}
      <Route path="/create-room" element={<CreateRoom />} />
      <Route path="/join" element={<JoinRoom />} />
      <Route path="/join/:code" element={<JoinRoom />} />
      <Route path="/room/:roomId/lobby" element={<RoomLobby />} />
      <Route path="/room/:roomId/round/:roundNumber/bets" element={<RoomBets />} />
      <Route path="/room/:roomId/round/:roundNumber/results" element={<RoomResults />} />

      <Route path="/rules" element={<Rules />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
