import { getGlossary } from "@/growth/analytics/glossary";

type Props = {
  glossaryKey: string;
  value: string | number;
  sub?: string;
  onDefine: (key: string) => void;
};

/** Tap any metric for a plain-English definition (FR-DB-01). */
export function MetricTile({ glossaryKey, value, sub, onDefine }: Props) {
  const g = getGlossary(glossaryKey);
  return (
    <button
      type="button"
      className="dash__tile"
      data-testid={`metric-${glossaryKey}`}
      onClick={() => onDefine(glossaryKey)}
      aria-label={`${g.label}: ${value}. Tap for definition.`}
    >
      <p className="dash__tile-label">{g.label}</p>
      <p className="dash__tile-value">{value}</p>
      {sub ? <p className="dash__meta">{sub}</p> : null}
      <p className="dash__tile-hint">Tap for definition</p>
    </button>
  );
}
