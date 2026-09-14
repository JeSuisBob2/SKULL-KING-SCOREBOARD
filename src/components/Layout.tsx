import { Link } from 'react-router-dom';
import { ReactNode, useState } from 'react';
import RulesDrawer from './RulesDrawer';
import { useRoomStore } from '../store/useRoomStore';

interface LayoutProps {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}

export default function Layout({ title, right, children }: LayoutProps) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const roomCode = useRoomStore(s => s.room?.code);

  const copyCode = () => {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-10 bg-gradient-to-b from-surface/95 to-surface/70 backdrop-blur border-b border-white/10">
        <div className="container flex items-center justify-between py-3">
          <Link to="/" className="text-accent font-bold text-lg tracking-tight">
            Skull King
          </Link>
          <div className="flex items-center gap-3">
            {right && <div>{right}</div>}
            <button
              className={`text-lg transition-opacity ${rulesOpen ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
              onClick={() => setRulesOpen(v => !v)}
              title="Règles du jeu"
            >
              📖
            </button>
          </div>
        </div>
        <div className="container pb-2 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{title}</h1>
          {roomCode && (
            <button
              onClick={copyCode}
              title="Copier le code de la salle"
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <span className="text-xs opacity-50">Code</span>
              <span className="font-bold tracking-widest text-accent tabular-nums">{roomCode}</span>
              <span className="text-xs opacity-60">{copied ? '✓' : '📋'}</span>
            </button>
          )}
        </div>
      </header>
      <main className="flex-1 container py-4">{children}</main>

      <RulesDrawer open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
