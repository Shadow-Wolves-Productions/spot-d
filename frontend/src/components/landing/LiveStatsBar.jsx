import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

export default function LiveStatsBar() {
  const [stats, setStats] = useState({ profile_count: 0, role_count: 0, casting_call_count: 0 });

  useEffect(() => {
    base44.http.get("/api/public-stats").then(({ data }) => setStats(data)).catch(() => { /* keep zeros */ });
  }, []);

  const items = [
    { value: stats.profile_count || "—", label: "Profiles" },
    { value: stats.role_count || "—", label: "Roles" },
    { value: stats.casting_call_count || "—", label: "Casting calls" },
    { value: "Instant", label: "Direct contact" },
  ];

  return (
    <section className="py-12 px-4 border-t border-border bg-card/30" data-testid="live-stats-bar">
      <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((s) => (
          <div key={s.label} className="text-center sm:text-left">
            <div className="font-display text-3xl sm:text-4xl font-semibold text-foreground" style={{ letterSpacing: "-0.5px" }}>
              {s.value}
            </div>
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
