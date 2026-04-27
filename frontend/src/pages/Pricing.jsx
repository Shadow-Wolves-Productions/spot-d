import { Check, Crown, Sparkles, X, Star, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

const FREE_FEATURES = [
  { text: "Basic profile creation", included: true },
  { text: "1 headshot upload", included: true },
  { text: "Browse casting calls", included: true },
  { text: "2 contact reveals per month", included: true },
  { text: "Limited search visibility", included: true },
  { text: "Advanced search filters", included: false },
  { text: "Portfolio uploads", included: false },
  { text: "Priority placement", included: false },
  { text: "Analytics & insights", included: false },
];

const PRO_FEATURES = [
  { text: "Unlimited contact reveals", included: true },
  { text: "Multiple headshots + full portfolio", included: true },
  { text: "Advanced search filters", included: true },
  { text: "IMDb profile visibility", included: true },
  { text: "Increased search visibility", included: true },
  { text: "Save favourite profiles & roles", included: true },
  { text: "Profile boost options", included: true },
  { text: "Full credits visibility", included: true },
  { text: "Analytics & insights", included: false },
];

const ELITE_FEATURES = [
  { text: "Everything in Pro", included: true },
  { text: "Highest priority search placement", included: true },
  { text: "Rotating homepage spotlight", included: true },
  { text: "Advanced analytics & engagement insights", included: true },
  { text: "Premium verified badge", included: true },
  { text: "Early access to casting calls", included: true },
  { text: "Exclusive Elite member status", included: true },
  { text: "Priority support", included: true },
];

function FeatureList({ features, dark = false }) {
  return (
    <ul className="space-y-3 mt-6">
      {features.map((f) => (
        <li key={f.text} className={`flex items-start gap-3 text-sm ${f.included ? (dark ? "text-white" : "text-foreground") : (dark ? "text-white/30" : "text-muted-foreground/40")}`}>
          {f.included ? (
          <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${dark ? "text-white/70" : "text-primary"}`} />
          ) : (
          <X className={`w-4 h-4 flex-shrink-0 mt-0.5 ${dark ? "text-white/20" : "text-muted-foreground/20"}`} />
          )}
          {f.text}
        </li>
      ))}
    </ul>
  );
}

export default function Pricing() {
  const [annual, setAnnual] = useState(true);
  const [spotsLeft, setSpotsLeft] = useState(null);
  const [maxSpots, setMaxSpots] = useState(100);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [waitEmail, setWaitEmail] = useState("");
  const [waitlisted, setWaitlisted] = useState(false);
  const [waitSubmitting, setWaitSubmitting] = useState(false);
  const navigate = useNavigate();

  const loadStats = () => {
    base44.http.get("/api/public-stats").then(({ data }) => {
      setSpotsLeft(data.founder_remaining ?? 0);
      setMaxSpots(data.founder_cap ?? 100);
    }).catch(() => setSpotsLeft(0));
  };

  useEffect(() => {
    loadStats();
    // Refresh every 5 minutes so the counter ticks down without redeployment.
    const id = setInterval(loadStats, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const startCheckout = async (planKey) => {
    setCheckoutError("");
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      navigate("/login?next=" + encodeURIComponent("/pricing"));
      return;
    }
    setLoadingPlan(planKey);
    try {
      const res = await base44.payments.startCheckout(planKey);
      window.location.href = res.url;
    } catch (e) {
      setCheckoutError(e?.response?.data?.detail || e.message || "Checkout failed");
      setLoadingPlan(null);
    }
  };

  const claimFounder = async () => {
    setCheckoutError("");
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      navigate("/login?next=" + encodeURIComponent("/pricing"));
      return;
    }
    setLoadingPlan("founder");
    try {
      await base44.payments.claimFounder();
      navigate("/welcome?plan=FOUNDER");
    } catch (e) {
      setCheckoutError(e?.response?.data?.detail || e.message || "Couldn't claim spot");
      setLoadingPlan(null);
    }
  };

  const submitWaitlist = async (e) => {
    e.preventDefault();
    if (!waitEmail.trim()) return;
    setWaitSubmitting(true);
    try {
      const { data } = await base44.http.post("/api/waitlist", {
        email: waitEmail.trim().toLowerCase(),
        source: "pricing",
      });
      setWaitlisted(true);
      if (data.already_listed) setCheckoutError("");
    } catch {
      setCheckoutError("Could not save — try again");
    } finally {
      setWaitSubmitting(false);
    }
  };

  // Urgency tier — colour + copy based on remaining spots.
  const urgency = spotsLeft === null
    ? "loading"
    : spotsLeft <= 0
    ? "full"
    : spotsLeft <= 10
    ? "final"
    : spotsLeft < 25
    ? "orange"
    : spotsLeft < 75
    ? "amber"
    : "standard";
  const urgencyColour = (urgency === "final" || urgency === "orange")
    ? "#FF5C35"
    : urgency === "amber" ? "#F59E0B" : "hsl(var(--primary))";

  return (
    <div className="pt-28 pb-24 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Membership</span>
            <h1 className="font-display text-4xl sm:text-5xl font-500 text-foreground mt-3" style={{ letterSpacing: "-1.5px" }}>
              Pricing that scales with you.
            </h1>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-base leading-[1.7]">
              Start free. Upgrade to get seen faster, unlock more opportunities, and stand out from the crowd.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setAnnual(false)}
                className={`text-sm font-normal transition-colors ${!annual ? "text-foreground" : "text-muted-foreground"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(!annual)}
                className="relative w-12 h-6 rounded-full transition-colors bg-primary"
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full shadow transition-transform bg-primary-foreground ${annual ? "left-7" : "left-1"}`} />
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`text-sm font-normal transition-colors ${annual ? "text-foreground" : "text-muted-foreground"}`}
              >
                Annual <span className="text-xs ml-1 font-semibold text-primary">Save ~30%</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* 3-column cards */}
        <div className="grid md:grid-cols-3 gap-6 items-start">

          {/* FREE */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl p-7 border"
            style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
          >
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-3">Free</p>
            <div className="flex items-end gap-1">
              <span className="font-display text-5xl font-semibold text-foreground" style={{ letterSpacing: "-1px" }}>$0</span>
            </div>
            <p className="text-sm text-muted-foreground mt-3 leading-[1.7]">Get started and explore opportunities</p>
            <Link to="/create-profile" className="block mt-6">
              <Button variant="outline" className="w-full border-border h-11 text-sm font-medium rounded-full hover:bg-secondary">
                Get started
              </Button>
            </Link>
            <FeatureList features={FREE_FEATURES} />
          </motion.div>

          {/* PRO */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative rounded-2xl p-7 md:-mt-4 md:-mb-4 border"
            style={{ background: "hsl(var(--card))", borderColor: "#FF5C35" }}
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-white" style={{ background: "#FF5C35" }}>
                Recommended
              </span>
            </div>
            <p className="text-[11px] uppercase tracking-[0.08em] font-bold mb-3 mt-2" style={{ color: "#FF5C35" }}>PRO</p>
            <div className="flex items-end gap-1">
              <span className="font-display text-5xl font-semibold text-foreground" style={{ letterSpacing: "-1px" }}>
                {annual ? "$79" : "$9.99"}
              </span>
              <span className="text-muted-foreground mb-2">/{annual ? "year" : "month"}</span>
            </div>
            <p className="text-xs font-semibold mt-1" style={{ color: "#FF5C35" }}>
              {annual ? "~$6.58/month · best value" : "or $79/year — save 30%"}
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-[1.7]">Unlock full access and get seen</p>
            <Button
              data-testid="pricing-pro-cta"
              onClick={() => startCheckout(annual ? "pro_annual" : "pro_monthly")}
              disabled={loadingPlan === "pro_monthly" || loadingPlan === "pro_annual"}
              className="w-full mt-6 h-11 text-sm font-semibold rounded-full text-white hover:opacity-90"
              style={{ background: "#FF5C35" }}
            >
              {loadingPlan === "pro_monthly" || loadingPlan === "pro_annual" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Crown className="w-4 h-4 mr-2" /> Get Spot'd PRO</>
              )}
            </Button>
            <FeatureList features={PRO_FEATURES} />
          </motion.div>

          {/* ELITE */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative rounded-2xl p-7 overflow-hidden border"
            style={{ background: "hsl(var(--card))", borderColor: "#E6FF00" }}
          >
            <div className="relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap text-black" style={{ background: "#E6FF00" }}>
                  Best for serious talent
                </span>
              </div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-bold mb-3 mt-2" style={{ color: "#E6FF00" }}>Elite</p>
              <div className="flex items-end gap-1">
                <span className="font-display text-5xl font-semibold text-foreground" style={{ letterSpacing: "-1px" }}>
                  {annual ? "$149" : "$14.99"}
                </span>
                <span className="text-muted-foreground mb-2">/{annual ? "year" : "month"}</span>
              </div>
              <p className="text-xs font-semibold mt-1" style={{ color: "#E6FF00" }}>
                {annual ? "~$12.42/month · best value" : "or $149/year — save 16%"}
              </p>
              <p className="text-sm text-muted-foreground mt-3 leading-[1.7]">Stand out and get ahead of the competition</p>
              <Button
                data-testid="pricing-elite-cta"
                onClick={() => startCheckout(annual ? "elite_annual" : "elite_monthly")}
                disabled={loadingPlan === "elite_monthly" || loadingPlan === "elite_annual"}
                className="w-full mt-6 h-11 text-sm font-semibold rounded-full text-black hover:opacity-90"
                style={{ background: "#E6FF00" }}
              >
                {loadingPlan === "elite_monthly" || loadingPlan === "elite_annual" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <><Star className="w-4 h-4 mr-2" /> Go Elite</>
                )}
              </Button>
              <FeatureList features={ELITE_FEATURES} />
            </div>
          </motion.div>
        </div>

        {/* Founding member CTA — auto-hides when full, replaced by waitlist */}
        {urgency !== "full" ? (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-2xl mx-auto mt-24"
            data-testid="pricing-founding-section"
          >
            <div className="relative rounded-2xl p-10 text-center overflow-hidden border" style={{ background: "hsl(var(--card))", borderColor: urgencyColour }}>
              <div className="relative">
                <span className="text-2xl mb-3 block" style={{ color: urgencyColour }}>✦</span>
                <h3 className="font-display text-2xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>Founding member offer</h3>
                <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm leading-[1.7]">
                  Join now and lock in PRO access for life — free. The first {maxSpots} members receive a founding member badge, verified profile, and permanent priority listing. No credit card required.
                </p>

                {/* Spot counter — colour-coded by urgency */}
                <div className="mt-6 inline-flex items-center gap-3 rounded-full px-5 py-2.5 border" style={{ borderColor: urgencyColour, background: "rgba(0,0,0,0.25)" }} data-testid="pricing-spot-counter">
                  <div className={`w-2 h-2 rounded-full ${urgency === "final" ? "animate-pulse" : ""}`} style={{ background: urgencyColour }} />
                  <span className="text-sm font-medium text-foreground">
                    {urgency === "loading" ? (
                      <span className="text-muted-foreground">Loading spots...</span>
                    ) : (
                      <>
                        <span style={{ color: urgencyColour }}>{spotsLeft}</span>
                        <span className="text-muted-foreground"> / {maxSpots} spots remaining</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Urgency message */}
                {urgency === "final" && (
                  <p className="text-sm font-bold mt-4 animate-pulse" style={{ color: urgencyColour }} data-testid="pricing-urgency-message">
                    Final {spotsLeft} spots — claim yours now
                  </p>
                )}
                {urgency === "orange" && (
                  <p className="text-sm font-semibold mt-4" style={{ color: urgencyColour }} data-testid="pricing-urgency-message">
                    Almost full — {spotsLeft} spots left
                  </p>
                )}
                {urgency === "amber" && (
                  <p className="text-sm font-semibold mt-4" style={{ color: urgencyColour }} data-testid="pricing-urgency-message">
                    Only {spotsLeft} founding spots remaining
                  </p>
                )}

                <Link to="/create-profile" className="block mt-6">
                  <Button
                    data-testid="pricing-founder-cta"
                    size="lg"
                    disabled={loadingPlan === "founder"}
                    onClick={(e) => { e.preventDefault(); claimFounder(); }}
                    className={`font-bold px-10 h-12 text-sm rounded-full bg-primary text-primary-foreground hover:bg-primary/90 ${urgency === "final" ? "animate-pulse" : ""}`}
                  >
                    {loadingPlan === "founder" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Claim your spot</>
                    )}
                  </Button>
                </Link>
                {checkoutError && (
                  <p className="text-xs text-destructive mt-3" data-testid="pricing-error">{checkoutError}</p>
                )}
                <p className="text-xs text-muted-foreground mt-3">Free forever · no credit card · limited to first {maxSpots}</p>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Waitlist — shown when founder cohort is full */
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-2xl mx-auto mt-24"
            data-testid="pricing-waitlist-section"
          >
            <div className="relative rounded-2xl p-10 text-center overflow-hidden border border-border bg-card">
              <h3 className="font-display text-2xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>
                Founding member spots are full.
              </h3>
              <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm leading-[1.7]">
                All {maxSpots} founding spots have been claimed. Join the waitlist for our next early access round.
              </p>
              {waitlisted ? (
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-mono text-primary" data-testid="pricing-waitlist-success">
                  <Check className="w-4 h-4" /> You're on the list.
                </div>
              ) : (
                <form onSubmit={submitWaitlist} className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <Input
                    type="email"
                    required
                    value={waitEmail}
                    onChange={(e) => setWaitEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="bg-secondary border-border h-12 flex-1"
                    data-testid="pricing-waitlist-input"
                  />
                  <Button type="submit" size="lg" className="bg-primary text-primary-foreground font-semibold h-12 px-8 rounded-full" disabled={waitSubmitting} data-testid="pricing-waitlist-submit">
                    {waitSubmitting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                    Join waitlist
                  </Button>
                </form>
              )}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}