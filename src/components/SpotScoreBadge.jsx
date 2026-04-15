import { useTheme } from "@/lib/useTheme";

// SpotScore ring badge — Electric lime ≥80 (dark) / Signal orange ≥80 (light), Signal orange ≥50, Slate <50
const SIZE_MAP = {
  sm: { size: 36, stroke: 3, text: "text-[10px]" },
  md: { size: 48, stroke: 3.5, text: "text-xs" },
  lg: { size: 64, stroke: 4, text: "text-sm" },
};

function getColor(score, isLight) {
  if (score >= 80) return isLight ? "#FF5C35" : "#E8FC6C";
  if (score >= 50) return "#FF5C35";
  return "#6B6B6B";
}

export default function SpotScoreBadge({ score = 0, size = "md" }) {
  const { theme } = useTheme();
  const { size: sz, stroke, text } = SIZE_MAP[size] || SIZE_MAP.md;
  const r = (sz - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const color = getColor(score, theme === "light");

  return (
    <div className="relative flex-shrink-0" style={{ width: sz, height: sz }}>
      <svg width={sz} height={sz} className="-rotate-90">
        <circle cx={sz / 2} cy={sz / 2} r={r} fill="none" stroke="#2A2A2A" strokeWidth={stroke} />
        <circle
          cx={sz / 2} cy={sz / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-mono font-bold leading-none ${text}`} style={{ color }}>
          {score}
        </span>
      </div>
    </div>
  );
}