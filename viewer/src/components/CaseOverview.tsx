import type { Architecture, VariantKey } from '../types';

interface Props {
  arch: Architecture;
  variantKey: VariantKey;
}

export default function CaseOverview({ arch, variantKey }: Props) {
  const variant = arch.variants[variantKey];
  const complexity = arch.case.complexity;

  const verdictColor =
    complexity?.verdict.toLowerCase().includes('single') ? 'var(--info)' : 'var(--success)';

  const MAX_CONSTRAINTS = 6;
  const constraints = arch.case.constraints ?? [];
  const visibleConstraints = constraints.slice(0, MAX_CONSTRAINTS);
  const hiddenCount = constraints.length - MAX_CONSTRAINTS;

  return (
    <div className="case-overview">
      {/* Cabecera */}
      <div className="panel-section">
        <div className="case-overview-label">Caso activo</div>
        <p style={{ fontWeight: 600, color: 'var(--text-0)', marginBottom: 'var(--sp-2)' }}>
          {arch.case.title}
        </p>
        <p className="case-overview-desc">{arch.case.description}</p>
      </div>

      {/* Stats */}
      <div className="panel-section">
        <div className="case-overview-stats">
          <div className="case-stat">
            <span className="case-stat-value" style={{ color: 'var(--agent)' }}>
              {variant.agents.length}
            </span>
            <span className="case-stat-label">agentes</span>
          </div>
          <div className="case-stat">
            <span className="case-stat-value" style={{ color: 'var(--tool)' }}>
              {variant.tools.length}
            </span>
            <span className="case-stat-label">tools</span>
          </div>
          <div className="case-stat">
            <span className="case-stat-value" style={{ color: 'var(--bridge)' }}>
              {variant.bridges.length}
            </span>
            <span className="case-stat-label">bridges</span>
          </div>
          <div className="case-stat">
            <span className="case-stat-value" style={{ color: 'var(--warning)' }}>
              {complexity?.total ?? '—'}
            </span>
            <span className="case-stat-label">compl.</span>
          </div>
        </div>
      </div>

      {/* Restricciones */}
      {constraints.length > 0 && (
        <div className="panel-section">
          <h3>Restricciones</h3>
          <div className="tag-list">
            {visibleConstraints.map((c, i) => (
              <span key={i} className="tag">{c}</span>
            ))}
            {hiddenCount > 0 && (
              <span className="tag" style={{ color: 'var(--text-2)' }}>+{hiddenCount} más</span>
            )}
          </div>
        </div>
      )}

      {/* Veredicto KISS */}
      {complexity && (
        <div className="panel-section">
          <div className="case-overview-label">Veredicto KISS</div>
          <p style={{ color: verdictColor, fontWeight: 600, fontSize: 'var(--text-sm)', margin: '4px 0 4px' }}>
            {complexity.verdict}
          </p>
          <p style={{ color: 'var(--text-2)', fontSize: 'var(--text-xs)' }}>
            {complexity.total}/25 · {complexity.rationale.slice(0, 80)}{complexity.rationale.length > 80 ? '…' : ''}
          </p>
        </div>
      )}

      {/* Hint */}
      <div className="panel-section">
        <p style={{ color: 'var(--text-2)', fontSize: 'var(--text-xs)' }}>
          Haz clic en un nodo para ver su detalle →
        </p>
      </div>
    </div>
  );
}
