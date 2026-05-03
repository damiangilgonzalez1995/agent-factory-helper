import type { HistoryEntry } from '../types';

interface Props {
  history: HistoryEntry[];
  onSelect?: (entry: HistoryEntry) => void;
}

export default function HistoryPanel({ history, onSelect }: Props) {
  if (history.length === 0) {
    return <p className="empty">Sin iteraciones aún.</p>;
  }
  // Show newest first
  const sorted = [...history].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return (
    <div className="history-list">
      {sorted.map((h) => (
        <button
          key={h.timestamp}
          className="history-item"
          onClick={() => onSelect?.(h)}
          type="button"
          style={{ textAlign: 'left', border: '1px solid var(--border)', font: 'inherit' }}
        >
          <div className="ts">
            {new Date(h.timestamp).toLocaleString()}
            <span className="variant-tag">{h.variant}</span>
          </div>
          <div className="summary">{h.summary}</div>
        </button>
      ))}
    </div>
  );
}
