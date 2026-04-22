import { Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  return (
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
  );
}
