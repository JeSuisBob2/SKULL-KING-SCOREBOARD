import Layout from '../components/Layout';
import { rulesSections } from '../components/rulesSections';

export default function Rules() {
  return (
    <Layout title="📖 Règles du jeu">
      <div className="space-y-4 pb-8">
        {/* Navigation rapide */}
        <div className="flex flex-wrap gap-2">
          {rulesSections.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
            >
              {s.icon} {s.title}
            </a>
          ))}
        </div>

        {rulesSections.map(s => (
          <div key={s.id} id={s.id} className="scroll-mt-20">
            <div className="section-title mb-2">{s.icon} {s.title}</div>
            {s.content}
          </div>
        ))}
      </div>
    </Layout>
  );
}
