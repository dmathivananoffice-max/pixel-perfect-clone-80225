interface ScoreBarProps {
  score: number;
  maxScore?: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Muted, semantic-only fill tones. Success/warning/error — nothing decorative.
function getScoreColor(score: number, maxScore: number): string {
  const pct = score / maxScore;
  if (pct >= 0.85) return "bg-emerald-500/80";
  if (pct >= 0.7) return "bg-primary";
  if (pct >= 0.5) return "bg-amber-500/80";
  if (pct >= 0.3) return "bg-orange-500/80";
  return "bg-red-500/80";
}

export function ScoreBar({
  score,
  maxScore = 100,
  showLabel = true,
  size = "md",
  className = "",
}: ScoreBarProps) {
  const pct = Math.min(Math.max((score / maxScore) * 100, 0), 100);
  const colorClass = getScoreColor(score, maxScore);
  const heightClass = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-muted-foreground">{score.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">{maxScore}</span>
        </div>
      )}
      <div className={`w-full ${heightClass} bg-muted rounded-full overflow-hidden`}>
        <div
          className={`${heightClass} ${colorClass} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
