import type { Variant } from '../types';
import BridgeIcon from '../lib/icons/BridgeIcon';

interface Props {
  bridgeId: string;
  variant: Variant;
  onClose: () => void;
}

/**
 * Panel inline (dentro del canvas) que aparece al hacer click en un bridge.
 * Muestra el "informe" del bridge: kind, implementación, qué hace, qué filtra,
 * conectores entre los que opera. Glass background, slide-in desde la derecha.
 */
export default function BridgeReportPanel({ bridgeId, variant, onClose }: Props) {
  const bridge = variant.bridges.find((b) => b.id === bridgeId);
  if (!bridge) return null;

  // Inferir conexiones source → bridge → target a partir de las edges con via
  const incoming = variant.edges.filter((e) => e.via === bridge.id).map((e) => e.source);
  const outgoing = variant.edges.filter((e) => e.via === bridge.id).map((e) => e.target);

  const labelOf = (id: string): string => {
    const a = variant.agents.find((x) => x.id === id);
    if (a) return a.name;
    const t = variant.tools.find((x) => x.id === id);
    if (t) return t.name;
    const d = variant.dataStores.find((x) => x.id === id);
    if (d) return d.name;
    return id;
  };

  return (
    <aside className="bridge-report" role="complementary" aria-label={`Análisis del bridge ${bridge.name}`}>
      <header className="br-head">
        <div className="br-head-icon">
          <BridgeIcon size={28} />
        </div>
        <div className="br-head-meta">
          <h3>{bridge.name}</h3>
          <code className="br-id">{bridge.id}</code>
        </div>
        <button className="br-close" onClick={onClose} aria-label="Cerrar análisis">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="br-badges">
        <span className="br-chip kind">kind: <strong>{bridge.kind}</strong></span>
        <span className="br-chip impl">impl: <strong>{bridge.implementation}</strong></span>
      </div>

      <Section label="Qué hace">
        <p className="br-desc">{bridge.description || 'Sin descripción.'}</p>
      </Section>

      {(incoming.length > 0 || outgoing.length > 0) && (
        <Section label="Sits between">
          <div className="br-sits">
            <div className="br-sits-side">
              <div className="br-sits-title">Entra de</div>
              {incoming.length > 0 ? (
                <ul>{incoming.map((id) => <li key={id}>{labelOf(id)}</li>)}</ul>
              ) : (
                <span className="br-empty">—</span>
              )}
            </div>
            <BridgeIcon size={22} />
            <div className="br-sits-side">
              <div className="br-sits-title">Sale a</div>
              {outgoing.length > 0 ? (
                <ul>{outgoing.map((id) => <li key={id}>{labelOf(id)}</li>)}</ul>
              ) : (
                <span className="br-empty">—</span>
              )}
            </div>
          </div>
        </Section>
      )}

      <Section label="Schemas">
        <div className="br-schemas">
          <div className="br-schema-block">
            <div className="br-schema-title">input</div>
            <code>{bridge.inputSchema || '—'}</code>
          </div>
          <div className="br-schema-block">
            <div className="br-schema-title">output</div>
            <code>{bridge.outputSchema || '—'}</code>
          </div>
        </div>
      </Section>

      <p className="br-hint">
        Los bridges filtran qué datos cruzan entre nodos para no saturar contextos.
      </p>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="br-section">
      <div className="br-section-label">{label}</div>
      {children}
    </section>
  );
}
