import { rulesSections } from './rulesSections';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function RulesDrawer({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-surface border-l border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <span className="font-bold text-lg">📖 Règles du jeu</span>
          <button
            className="text-2xl opacity-60 hover:opacity-100 transition-opacity"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">

          {/* Navigation rapide */}
          <div className="flex flex-wrap gap-2">
            {rulesSections.map(s => (
              <a
                key={s.id}
                href={`#rules-${s.id}`}
                className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
              >
                {s.icon} {s.title}
              </a>
            ))}
          </div>

          {rulesSections.map(s => (
            <div key={s.id} id={`rules-${s.id}`} className="scroll-mt-4 space-y-2">
              <div className="section-title">{s.icon} {s.title}</div>
              {s.content}
            </div>
          ))}

          {/* Lien PDF */}
          <div className="pt-2 border-t border-white/10 text-center">
            <a
              href={`${import.meta.env.BASE_URL}regleskull.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-accent opacity-70 hover:opacity-100 transition-opacity"
            >
              📄 Ouvrir le PDF des règles officielles
            </a>
          </div>

        </div>
      </div>
    </>
  );
}
