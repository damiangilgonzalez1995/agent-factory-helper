import type { VariantKey } from '../types';

interface Props {
  active: VariantKey;
  onChange: (v: VariantKey) => void;
}

const labels: Record<VariantKey, string> = {
  basic: 'básica',
  intermediate: 'intermedia',
  advanced: 'avanzada',
};

export default function VariantSwitcher({ active, onChange }: Props) {
  const variants: VariantKey[] = ['basic', 'intermediate', 'advanced'];
  return (
    <div className="variant-switcher" role="tablist">
      {variants.map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={v === active}
          className={v === active ? 'active' : ''}
          onClick={() => onChange(v)}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}
