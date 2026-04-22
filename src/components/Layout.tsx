import { Link } from 'react-router-dom';
import { ReactNode, useState } from 'react';
import RulesDrawer from './RulesDrawer';

interface LayoutProps {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}

export default function Layout({ title, right, children }: LayoutProps) {
  const [rulesOpen, setRulesOpen] = useState(false);

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
        <div className="container pb-2">
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
      </header>
      <main className="flex-1 container py-4">{children}</main>

      <RulesDrawer open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
