import { useEffect, useState } from "react";
import { base44, tokenStore } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Lock, Eye, Bookmark, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const PRO_OR_HIGHER = ["pro", "elite", "founder"];
const ELITE_OR_HIGHER = ["elite", "founder"];

function LockedCard({ tier_required, message }) {
  return (
    <div className="bg-card/50 border border-dashed border-border rounded-xl p-6 text-center">
      <Lock className="w-5 h-5 text-muted-foreground/50 mx-auto mb-3" />
      <p className="text-sm font-semibold text-foreground">{message}</p>
      <Link to="/pricing">
        <button className="mt-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] font-mono text-primary hover:underline" data-testid="locked-upgrade-cta">
          Upgrade to {tier_required.toUpperCase()} <ChevronRight className="w-3 h-3" />
        </button>
      </Link>
    </div>
  );
}

export default function AnalyticsAdvanced() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!tokenStore.get()) { setLoading(false); return; }
      try {
        const res = await base44.http.get("/api/analytics/summary");
        if (!cancelled) setData(res.data);
      } catch { /* no profile yet */ }
      finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 my-8" data-testid="analytics-advanced-loading">
        {[0, 1].map((i) => <div key={i} className="h-40 rounded-xl bg-card border border-border animate-pulse" />)}
      </div>
    );
  }
  if (!data) return null;

  const tier = data.tier || "free";
  const isPro = PRO_OR_HIGHER.includes(tier);
  const isElite = ELITE_OR_HIGHER.includes(tier);

  return (
    <div className="space-y-6 my-8" data-testid="analytics-advanced">
      {/* SpotScore history */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-5 sm:p-6">
        <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider mb-4" data-testid="spotscore-history-heading">
          SpotScore History · Last 90 days
        </h3>
        {data.spot_score_history && data.spot_score_history.length >= 2 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.spot_score_history.map((h) => ({ date: new Date(h.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }), score: h.score }))} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="#E6FF00" strokeWidth={2} dot={{ r: 3, fill: "#E6FF00" }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Your SpotScore history will appear here as you use the platform.</p>
            <p className="text-xs text-muted-foreground mt-2">Current score: <span className="text-primary font-bold">{data.profile.spot_score}/100</span></p>
          </div>
        )}
      </motion.div>

      {/* Who saved you — PRO+ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2" data-testid="who-saved-heading">
            <Bookmark className="w-4 h-4 text-primary" /> Who's saved you
          </h3>
          <span className="text-[10px] uppercase tracking-[0.08em] font-mono text-muted-foreground">{data.totals.saves} total</span>
        </div>
        {!isPro ? (
          <LockedCard tier_required="pro" message="Upgrade to PRO to see who's saving your profile" />
        ) : (data.who_saved_you || []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No saves yet — share your profile to get the ball rolling.</p>
        ) : (
          <div className="space-y-2" data-testid="who-saved-list">
            {data.who_saved_you.slice(0, 12).map((s, i) => s.profile && (
              <Link key={i} to={`/u/${s.profile.profile_slug || s.profile.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-secondary overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {s.profile.profile_photo ? (
                    <img src={s.profile.profile_photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground">{(s.profile.full_name || "U").slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{s.profile.preferred_name || s.profile.full_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{s.profile.primary_role}</p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.08em] font-mono text-muted-foreground">{timeAgo(s.saved_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </motion.div>

      {/* Who revealed your contact — Elite+ */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2" data-testid="who-revealed-heading">
            <Eye className="w-4 h-4 text-primary" /> Who revealed your contact
          </h3>
          <span className="text-[10px] uppercase tracking-[0.08em] font-mono text-muted-foreground">{data.totals.reveals} total</span>
        </div>
        {tier === "free" ? (
          <LockedCard tier_required="elite" message="Upgrade to Elite to see who's revealed your contact" />
        ) : tier === "pro" ? (
          <div className="bg-primary/[0.04] border border-primary/20 rounded-lg p-5 text-center">
            <p className="text-2xl font-display font-bold text-primary">{data.who_revealed_contact?.count_only ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">people revealed your contact</p>
            <Link to="/pricing">
              <button className="mt-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.08em] font-mono text-primary hover:underline">
                Upgrade to Elite to see who <ChevronRight className="w-3 h-3" />
              </button>
            </Link>
          </div>
        ) : !isElite ? null : (data.who_revealed_contact || []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No contact reveals yet.</p>
        ) : (
          <div className="space-y-2" data-testid="who-revealed-list">
            {data.who_revealed_contact.slice(0, 12).map((r, i) => r.profile && (
              <Link key={i} to={`/u/${r.profile.profile_slug || r.profile.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  {(r.profile.full_name || "U").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.profile.full_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.profile.primary_role}</p>
                </div>
                <span className="text-[10px] uppercase tracking-[0.08em] font-mono text-muted-foreground">{timeAgo(r.revealed_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
