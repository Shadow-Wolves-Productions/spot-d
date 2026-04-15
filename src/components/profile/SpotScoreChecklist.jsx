import { Check, X } from "lucide-react";

const CHECKLIST = [
  // Profile completeness
  { key: "profile_photo", label: "Profile photo uploaded", points: 5, check: (f) => !!f.profile_photo },
  { key: "bio", label: "Bio written", points: 5, check: (f) => !!f.bio },
  { key: "primary_role", label: "Primary role selected", points: 3, check: (f) => !!f.primary_role },
  { key: "city", label: "City / location set", points: 2, check: (f) => !!f.city },
  { key: "imdb_link", label: "IMDb profile linked", points: 5, check: (f) => !!f.imdb_link },
  { key: "showreel_link", label: "Showreel / reel linked", points: 5, check: (f) => !!f.showreel_link },
  // Verified identity
  { key: "email_verified", label: "Email verified", points: 7, check: (f) => !!f.email_verified },
  { key: "phone_verified", label: "Phone verified", points: 8, check: (f) => !!f.phone_verified },
  // Extra engagement (informational — these are computed server-side)
  { key: "_endorsements", label: "Receive endorsements (Spots)", points: "up to 25", check: () => null },
  { key: "_saved", label: "Get saved by other members", points: "up to 17", check: () => null },
  { key: "_casting", label: "Apply to or post a casting call", points: "up to 7", check: () => null },
];

export default function SpotScoreChecklist({ form }) {
  const done = CHECKLIST.filter((item) => item.check(form) === true).length;
  const countable = CHECKLIST.filter((item) => item.check(form) !== null).length;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        {done} of {countable} profile items complete. Community actions are calculated automatically.
      </p>
      <div className="space-y-1.5">
        {CHECKLIST.map((item) => {
          const status = item.check(form);
          const isDone = status === true;
          const isInfo = status === null;

          return (
            <div
              key={item.key}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors ${
                isDone
                  ? "border-green-500/20 bg-green-500/5"
                  : isInfo
                  ? "border-border bg-secondary/30"
                  : "border-border bg-secondary/10"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                  isDone ? "bg-green-500/20 text-green-400" : isInfo ? "bg-muted text-muted-foreground" : "bg-secondary text-muted-foreground/40"
                }`}>
                  {isDone ? <Check className="w-2.5 h-2.5" /> : isInfo ? <span className="text-[8px] font-bold">~</span> : <X className="w-2.5 h-2.5" />}
                </span>
                <span className={isDone ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
              </div>
              <span className={`font-mono text-[10px] font-semibold ${isDone ? "text-green-400" : isInfo ? "text-muted-foreground/60" : "text-muted-foreground/40"}`}>
                +{item.points}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}