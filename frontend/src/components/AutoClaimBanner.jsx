import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, Camera, Film, Phone, BadgeCheck, BookOpen, Award, X, ArrowRight, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const ICONS = {
  profile_photo: Camera,
  showreel_link: Film,
  email_verified: BadgeCheck,
  bio: BookOpen,
  imdb_link: Award,
};

/**
 * Auto-claim screen — shown ONCE for users with a pre-built imported profile
 * (welcome_email_sent=false). Highlights top 3 quick wins to grow SpotScore.
 */
export default function AutoClaimBanner() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState(false);
  const [scoreBumped, setScoreBumped] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const res = await base44.http.get("/api/auto-claim/check");
        if (!cancelled && res.data?.eligible) setData(res.data);
      } catch { /* not eligible */ }
      finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const dismiss = async () => {
    setDismissing(true);
    try { await base44.http.post("/api/auto-claim/dismiss"); } catch { /* noop */ }
    setData(null);
  };

  const goToEdit = (suggestion) => {
    // Send them to /create-profile and pass a hint via hash
    navigate(`/create-profile#${suggestion.key}`);
  };

  if (loading || !data) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="relative bg-gradient-to-br from-primary/10 via-card to-primary/5 border border-primary/30 rounded-2xl p-6 sm:p-8 mb-8 overflow-hidden"
        data-testid="auto-claim-banner"
      >
        <button
          onClick={dismiss}
          disabled={dismissing}
          aria-label="Dismiss"
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-secondary transition-colors"
          data-testid="auto-claim-dismiss"
        >
          {dismissing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 text-muted-foreground" />}
        </button>

        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-[11px] uppercase tracking-[0.08em] font-mono text-primary">Founding member · welcome back</p>
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-500 text-foreground mt-2" style={{ letterSpacing: "-0.5px" }}>
          Welcome to Spot'd, <span className="text-primary">{data.profile.preferred_name}</span>.
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-[1.6]">
          Your founding member profile is live. Complete a few quick wins below to climb the directory in 60 seconds.
        </p>

        {/* Score + completion */}
        <div className="grid grid-cols-2 gap-4 mt-6 max-w-md">
          <div className="bg-card/60 border border-border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-[0.08em] font-mono text-muted-foreground">SpotScore</p>
            <motion.p
              key={data.profile.spot_score}
              initial={scoreBumped ? { scale: 1.2, color: "#E6FF00" } : false}
              animate={{ scale: 1, color: "#fff" }}
              transition={{ duration: 0.45 }}
              className="font-display text-3xl font-bold mt-1"
            >
              {data.profile.spot_score}<span className="text-sm font-normal text-muted-foreground ml-1">/100</span>
            </motion.p>
          </div>
          <div className="bg-card/60 border border-border rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-[0.08em] font-mono text-muted-foreground">Profile complete</p>
            <p className="font-display text-3xl font-bold text-foreground mt-1">{data.completion_pct}<span className="text-sm font-normal text-muted-foreground">%</span></p>
            <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${data.completion_pct}%` }} />
            </div>
          </div>
        </div>

        {/* Quick wins */}
        {data.suggestions.length > 0 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.08em] font-mono text-muted-foreground mb-3">Top 3 quick wins</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {data.suggestions.map((s) => {
                const Icon = ICONS[s.key] || Sparkles;
                return (
                  <button
                    key={s.key}
                    onClick={() => goToEdit(s)}
                    data-testid={`auto-claim-action-${s.key}`}
                    className="text-left bg-card/80 border border-border hover:border-primary/40 rounded-lg p-4 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="w-4 h-4 text-primary" />
                      <span className="text-[10px] uppercase tracking-[0.08em] font-mono text-primary">+{s.points} pts</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{s.label}</p>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-2 group-hover:text-primary transition-colors">
                      Quick fix <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Link to="/create-profile">
            <Button data-testid="auto-claim-edit-btn" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full">
              Complete my profile <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Button data-testid="auto-claim-skip-btn" variant="outline" onClick={dismiss} disabled={dismissing} className="rounded-full">
            Go to dashboard
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
