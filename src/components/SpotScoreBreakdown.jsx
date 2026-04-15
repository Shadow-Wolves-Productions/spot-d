import { Link } from "react-router-dom";
import { CheckCircle2, Circle, TrendingUp } from "lucide-react";

const PERCENTILE_BADGE = (percentile) => {
  if (percentile >= 99) return { label: "Top 1%", bg: "#000", color: "#E8FC6C", border: "#E8FC6C" };
  if (percentile >= 95) return { label: "Top 5%", bg: "#534AB7", color: "#fff", border: "#534AB7" };
  if (percentile >= 90) return { label: "Top 10%", bg: "#22c55e", color: "#000", border: "#22c55e" };
  if (percentile >= 75) return { label: "Top 25%", bg: "#B8860B", color: "#fff", border: "#B8860B" };
  return null;
};

export function PercentileBadge({ percentile }) {
  const badge = PERCENTILE_BADGE(percentile);
  if (!badge) return null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.08em]"
      style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
    >
      {badge.label}
    </span>
  );
}

export default function SpotScoreBreakdown({ profile, endorsementCount = 0, savedByCount = 0, revealedByCount = 0 }) {
  const p = profile;

  const items = [
    // Completeness
    { label: "Profile photo", earned: !!p.profile_photo, points: 5, tip: "Upload a profile photo" },
    { label: "Bio written", earned: !!p.bio, points: 5, tip: "Write a bio about yourself" },
    { label: "Primary role set", earned: !!p.primary_role, points: 3, tip: null },
    { label: "City/location set", earned: !!p.city, points: 2, tip: "Add your city" },
    { label: "IMDb link added", earned: !!p.imdb_link, points: 5, tip: "Add your IMDb profile link" },
    { label: "Showreel link added", earned: !!p.showreel_link, points: 5, tip: "Add your showreel or portfolio link" },
    // Verification
    { label: "Email verified", earned: !!p.email_verified, points: 7, tip: "Verify your email address" },
    { label: "Phone verified", earned: !!p.phone_verified, points: 8, tip: "Verify your phone number" },
    // Endorsements
    {
      label: `Endorsements (${endorsementCount})`,
      earned: endorsementCount >= 1,
      points: endorsementCount >= 10 ? 25 : endorsementCount >= 6 ? 20 : endorsementCount >= 3 ? 14 : endorsementCount >= 1 ? 8 : 0,
      maxPoints: 25,
      tip: endorsementCount === 0 ? "Ask colleagues to endorse you" : endorsementCount < 10 ? `Get ${10 - endorsementCount} more endorsements for max points` : null,
    },
    // Social
    {
      label: `Saved by others (${savedByCount})`,
      earned: savedByCount >= 1,
      points: savedByCount >= 15 ? 20 : savedByCount >= 5 ? 12 : savedByCount >= 1 ? 5 : 0,
      maxPoints: 20,
      tip: savedByCount < 15 ? "Improve your profile to get saved by more users" : null,
    },
    { label: "Contact revealed 3+ times", earned: revealedByCount >= 3, points: 5, tip: "Make your profile more discoverable" },
  ];

  const suggestions = items.filter(i => !i.earned && i.tip);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold text-foreground">{p.spot_score || 0}</span>
          <span className="text-muted-foreground text-sm">/ 100</span>
        </div>
        <PercentileBadge percentile={p.spot_percentile || 0} />
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {item.earned
                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                : <Circle className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
              }
              <span className={item.earned ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
            </div>
            <span className={`font-mono text-xs font-semibold ${item.earned ? "text-primary" : "text-muted-foreground/40"}`}>
              +{item.points}
            </span>
          </div>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">How to improve</p>
          </div>
          <ul className="space-y-1.5">
            {suggestions.slice(0, 4).map((s) => (
              <li key={s.label} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary font-bold mt-0.5">+{s.points}</span>
                <span>{s.tip}</span>
              </li>
            ))}
          </ul>
          <Link to="/create-profile" className="block mt-3 text-xs text-primary hover:underline">
            Edit profile to improve your score →
          </Link>
        </div>
      )}
    </div>
  );
}