import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

/**
 * Single source of truth for the founding-member CTA.
 * - Reads founder_count + founder_cap live from /api/public-stats
 * - Auto-hides + shows waitlist when cap is reached
 * - Applies urgency thresholds (amber under 75 remaining, orange under 25, pulse final 10)
 * Used on both /landing and /pricing.
 */
export default function FoundingSection({ source = "landing" }) {
  const [stats, setStats] = useState(null);
  const [waitEmail, setWaitEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data } = await base44.http.get("/api/public-stats");
        if (alive) setStats(data);
      } catch { /* silent */ }
    };
    load();
    // Poll every 5 minutes to catch new claims without redeployment
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!stats) return null;

  const { founder_count = 0, founder_remaining = 0, founder_cap = 100 } = stats;
  const isFull = founder_remaining <= 0;

  // Urgency tier
  let urgency = "standard"; // standard / amber / orange / final
  if (founder_remaining > 0) {
    if (founder_remaining <= 10) urgency = "final";
    else if (founder_remaining < 25) urgency = "orange";
    else if (founder_remaining < 75) urgency = "amber";
  }

  const colour = urgency === "final" || urgency === "orange"
    ? "#FF5C35"
    : urgency === "amber" ? "#F59E0B" : "hsl(var(--primary))";
  const pulseClass = (urgency === "final") ? "animate-pulse" : "";

  // ---------- WAITLIST (when full) ---------- //
  const submitWait = async (e) => {
    e.preventDefault();
    if (!waitEmail.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await base44.http.post("/api/waitlist", {
        email: waitEmail.trim().toLowerCase(),
        source,
      });
      setWaitlisted(true);
      toast.success(data.already_listed ? "You're already on the waitlist." : "You're on the waitlist.");
    } catch (err) {
      toast.error("Could not save — try again");
    } finally {
      setSubmitting(false);
    }
  };

  if (isFull) {
    return (
      <section className="py-20 px-4 border-t border-border" data-testid="founding-waitlist-section">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Founding cohort</span>
          <h2 className="font-display font-500 text-4xl sm:text-5xl text-foreground mt-3 leading-tight" style={{ letterSpacing: "-1px" }}>
            Founding member spots are full.
          </h2>
          <p className="text-muted-foreground mt-5 text-base leading-[1.7] max-w-xl mx-auto">
            All {founder_cap} founding spots have been claimed. Join the waitlist for our next early access round.
          </p>
          {waitlisted ? (
            <div className="mt-10 inline-flex items-center gap-2 text-sm font-mono text-primary" data-testid="founding-waitlist-success">
              <Check className="w-4 h-4" /> You're on the list.
            </div>
          ) : (
            <form onSubmit={submitWait} className="mt-10 flex flex-col sm:flex-row gap-3 max-w-md mx-auto" data-testid="founding-waitlist-form">
              <Input
                type="email"
                required
                value={waitEmail}
                onChange={(e) => setWaitEmail(e.target.value)}
                placeholder="you@email.com"
                className="bg-card border-border h-12 flex-1"
                data-testid="founding-waitlist-input"
              />
              <Button type="submit" size="lg" className="bg-primary text-primary-foreground font-semibold h-12 px-8 rounded-full" disabled={submitting} data-testid="founding-waitlist-submit">
                {submitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                Join waitlist
              </Button>
            </form>
          )}
        </div>
      </section>
    );
  }

  // ---------- ACTIVE FOUNDING CTA ---------- //
  // Urgency-aware headline
  const remainingLine =
    urgency === "final"
      ? `Final ${founder_remaining} spots — claim yours now`
      : urgency === "orange"
      ? `Almost full — ${founder_remaining} spots left`
      : urgency === "amber"
      ? `Only ${founder_remaining} founding spots remaining`
      : `${founder_remaining} founding spots remaining`;

  return (
    <section className="py-20 px-4 border-t border-border" data-testid="founding-member-section">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-0 border border-border rounded-xl overflow-hidden">
          {/* Left — pitch + live counter */}
          <div className="p-10 lg:p-14 border-b lg:border-b-0 lg:border-r border-border bg-card">
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Limited offer</span>
            <h2 className="font-display font-500 text-4xl sm:text-5xl text-foreground mt-2 leading-tight" style={{ letterSpacing: "-1px" }}>
              Founding<br />member access
            </h2>
            <p className="text-muted-foreground mt-4 text-base leading-[1.7] max-w-sm">
              The first {founder_cap} members get lifetime free PRO access, a founding member badge, and priority listing in the directory.
            </p>

            <motion.div
              key={founder_remaining}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-8 inline-flex items-baseline gap-3"
              data-testid="founding-remaining"
            >
              <span className={`font-display text-6xl sm:text-7xl font-bold leading-none ${pulseClass}`} style={{ letterSpacing: "-2px", color: colour }}>
                {founder_remaining}
              </span>
              <span className="text-[11px] uppercase tracking-[0.08em] font-mono" style={{ color: colour }}>
                spots<br />remaining
              </span>
            </motion.div>

            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mt-3 font-mono" data-testid="founding-counter">
              <span className="text-foreground font-semibold">{founder_count}</span> of {founder_cap} founding spots claimed
            </p>

            {urgency !== "standard" && (
              <p className="text-sm font-semibold mt-5" style={{ color: colour }} data-testid="founding-urgency-message">
                {remainingLine}
              </p>
            )}
          </div>

          {/* Right — what you get + CTA */}
          <div className="p-10 lg:p-14 flex flex-col justify-center bg-primary">
            <div className="text-[11px] uppercase tracking-[0.08em] text-primary-foreground/60 mb-4">What you get</div>
            <ul className="space-y-2 mb-8">
              {[
                "Free PRO access for life",
                "Founding member badge",
                "Priority placement in search",
                "Unlimited contact reveals",
                "Full portfolio uploads",
                "Post casting calls",
              ].map((item) => (
                <li key={item} className="text-sm text-primary-foreground flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-primary-foreground/40 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/create-profile">
              <Button
                size="lg"
                className={`bg-foreground text-background font-semibold hover:bg-foreground/80 rounded-full w-full sm:w-auto px-10 ${urgency === "final" ? "animate-pulse" : ""}`}
                data-testid="founding-cta"
              >
                Claim your spot
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
