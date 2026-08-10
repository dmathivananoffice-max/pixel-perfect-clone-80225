import { getGlossary } from "@/growth/analytics/glossary";

export function DefinitionTip({
  glossaryKey,
  onClose,
}: {
  glossaryKey: string;
  onClose: () => void;
}) {
  const g = getGlossary(glossaryKey);
  return (
    <div className="dash__tip" role="dialog" aria-label={g.label} data-testid="definition-tip">
      <h3>{g.label}</h3>
      <p>{g.plain}</p>
      <button type="button" onClick={onClose}>
        Got it
      </button>
    </div>
  );
}
