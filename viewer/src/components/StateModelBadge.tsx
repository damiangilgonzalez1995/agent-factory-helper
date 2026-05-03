import type { StateModel } from '../types';

interface Props {
  stateModel: StateModel;
}

export default function StateModelBadge({ stateModel }: Props) {
  return (
    <span className="state-badge" title="State model de la variante activa">
      <span className="dot" />
      stateModel: <code>{stateModel}</code>
    </span>
  );
}
