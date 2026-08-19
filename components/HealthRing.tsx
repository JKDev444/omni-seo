import type { HealthRing as HealthRingData } from "@/lib/data/dashboard";

const SIZE = 76;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function colorForScore(score: number): string {
  if (score >= 85) return "var(--color-success)";
  if (score >= 60) return "var(--color-warning)";
  return "var(--color-critical)";
}

export function HealthRing({ ring }: { ring: HealthRingData }) {
  const offset = CIRCUMFERENCE * (1 - ring.score / 100);
  const color = colorForScore(ring.score);

  return (
    <div className="card ring-card">
      <svg
        className="ring-svg"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${ring.label} health score: ${ring.score} out of 100`}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-mono)"
          fontSize="20"
          fontWeight="700"
          fill="var(--color-ink)"
        >
          {ring.score}
        </text>
      </svg>
      <div className="ring-info">
        <div className="ring-label">{ring.label}</div>
        <div className="ring-count">
          {ring.openCount} open finding{ring.openCount === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}
