import type { BranchOption } from "@/growth/diagnostic/branchTypes";

type Props = {
  brand?: string;
  progressLabel: string;
  progressRatio: number;
  prompt: string;
  options: BranchOption[];
  onSelect: (value: string) => void;
  onBack?: () => void;
};

export function QuestionScreen({
  brand = "Workforce Europe",
  progressLabel,
  progressRatio,
  prompt,
  options,
  onSelect,
  onBack,
}: Props) {
  return (
    <div className="diag__shell diag__fade-in">
      <p className="diag__brand">{brand}</p>
      <p className="diag__progress" aria-live="polite">
        {progressLabel}
      </p>
      <div className="diag__bar" aria-hidden="true">
        <span style={{ width: `${Math.round(progressRatio * 100)}%` }} />
      </div>
      <h1 className="diag__title">{prompt}</h1>
      <div className="diag__options" role="list">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="diag__option"
            onClick={() => onSelect(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {onBack ? (
        <div className="diag__nav">
          <button type="button" className="diag__btn diag__btn--ghost" onClick={onBack}>
            Back
          </button>
        </div>
      ) : null}
    </div>
  );
}
