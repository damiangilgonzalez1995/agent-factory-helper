import type { Architecture, SelectedNode, VariantKey } from '../types';
import CaseOverview from './CaseOverview';
import HistoryPanel from './HistoryPanel';

interface Props {
  arch: Architecture;
  variantKey: VariantKey;
  selected: SelectedNode | null;
}

export default function SidePanel({ arch, variantKey, selected }: Props) {
  const variant = arch.variants[variantKey];

  if (!selected) {
    return (
      <div>
        <CaseOverview arch={arch} variantKey={variantKey} />
        <div className="panel-section">
          <h3>Variante: {variantKey}</h3>
          {variant.patterns?.length ? (
            <div className="tag-list" style={{ marginBottom: 8 }}>
              {variant.patterns.map((p) => (
                <span key={p} className="tag">{p}</span>
              ))}
            </div>
          ) : null}
          <p>{variant.rationale}</p>
        </div>
        <div className="panel-section">
          <h3>Historial ({arch.history.length})</h3>
          <HistoryPanel history={arch.history} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SelectedNodePanel arch={arch} variantKey={variantKey} selected={selected} />
      <div className="panel-section">
        <h3>Historial ({arch.history.length})</h3>
        <HistoryPanel history={arch.history} />
      </div>
    </div>
  );
}

function SelectedNodePanel({ arch, variantKey, selected }: Props & { selected: SelectedNode }) {
  const v = arch.variants[variantKey];
  if (selected.kind === 'agent') {
    const a = v.agents.find((x) => x.id === selected.id);
    if (!a) return null;
    return (
      <div className="panel-section">
        <h3>Agente seleccionado</h3>
        <p style={{ fontWeight: 600, color: 'var(--text-0)' }}>{a.name}</p>
        <p style={{ marginBottom: 12 }}>{a.role}</p>
        <div className="kv">
          <span className="k">id</span><span className="v"><code>{a.id}</code></span>
          <span className="k">model</span><span className="v"><code>{a.model}</code></span>
          <span className="k">executionMode</span><span className="v"><code>{a.executionMode}</code></span>
          <span className="k">contextStrategy</span><span className="v"><code>{a.contextStrategy}</code></span>
        </div>
        <h3 style={{ marginTop: 16 }}>Justificación del modo</h3>
        <p>{a.executionModeRationale}</p>
        <h3 style={{ marginTop: 16 }}>System prompt</h3>
        <p>{a.systemPromptSummary}</p>
        <h3 style={{ marginTop: 16 }}>Tools ({a.tools.length})</h3>
        <div className="tag-list">
          {a.tools.map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
        <h3 style={{ marginTop: 16 }}>State reads</h3>
        <div className="tag-list">
          {a.stateReads.length > 0
            ? a.stateReads.map((s) => <span key={s} className="tag">{s}</span>)
            : <span className="empty">ninguno</span>}
        </div>
        <h3 style={{ marginTop: 16 }}>State writes</h3>
        <div className="tag-list">
          {a.stateWrites.length > 0
            ? a.stateWrites.map((s) => <span key={s} className="tag">{s}</span>)
            : <span className="empty">ninguno</span>}
        </div>
      </div>
    );
  }
  if (selected.kind === 'tool') {
    const t = v.tools.find((x) => x.id === selected.id);
    if (!t) return null;
    return (
      <div className="panel-section">
        <h3>Tool seleccionada</h3>
        <p style={{ fontWeight: 600, color: 'var(--text-0)' }}>{t.name}</p>
        <p style={{ marginBottom: 12 }}>{t.description}</p>
        <div className="kv">
          <span className="k">id</span><span className="v"><code>{t.id}</code></span>
          <span className="k">type</span><span className="v"><code>{t.type}</code></span>
          {t.idempotent !== undefined && (
            <><span className="k">idempotent</span><span className="v">{t.idempotent ? 'sí' : 'no'}</span></>
          )}
          {t.sideEffect && (
            <><span className="k">sideEffect</span><span className="v"><code>{t.sideEffect}</code></span></>
          )}
        </div>
        <h3 style={{ marginTop: 16 }}>Consumida por</h3>
        <div className="tag-list">
          {t.consumedBy.map((c) => <span key={c} className="tag">{c}</span>)}
        </div>
      </div>
    );
  }
  if (selected.kind === 'bridge') {
    const b = v.bridges.find((x) => x.id === selected.id);
    if (!b) return null;
    return (
      <div className="panel-section">
        <h3>Bridge seleccionado</h3>
        <p style={{ fontWeight: 600, color: 'var(--text-0)' }}>{b.name}</p>
        <p style={{ marginBottom: 12 }}>{b.description}</p>
        <div className="kv">
          <span className="k">id</span><span className="v"><code>{b.id}</code></span>
          <span className="k">kind</span><span className="v"><code>{b.kind}</code></span>
          <span className="k">implementation</span><span className="v"><code>{b.implementation}</code></span>
          {b.inputSchema && <><span className="k">input</span><span className="v"><code>{b.inputSchema}</code></span></>}
          {b.outputSchema && <><span className="k">output</span><span className="v"><code>{b.outputSchema}</code></span></>}
        </div>
      </div>
    );
  }
  if (selected.kind === 'datastore') {
    const d = v.dataStores.find((x) => x.id === selected.id);
    if (!d) return null;
    return (
      <div className="panel-section">
        <h3>DataStore seleccionado</h3>
        <p style={{ fontWeight: 600, color: 'var(--text-0)' }}>{d.name}</p>
        <div className="kv">
          <span className="k">id</span><span className="v"><code>{d.id}</code></span>
          <span className="k">type</span><span className="v"><code>{d.type}</code></span>
        </div>
      </div>
    );
  }
  return null;
}
