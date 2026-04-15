import { Check, Crown, Sparkles, X, Star, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
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
  const MAX_SPOTS = 500;

  useEffect(() => {
    base44.entities.Profile.list("-created_date", 500).then((all) => {
      const taken = Math.min(all.length, MAX_SPOTS);
      setSpotsLeft(Math.max(0, MAX_SPOTS - taken));
    });
  }, []);

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
            className="relative rounded-2xl p-7 md:-mt-4 md:-mb-4 border border-primary"
            style={{ background: "hsl(var(--card))" }}
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap bg-primary text-primary-foreground">
                Recommended
              </span>
            </div>
            <p className="text-[11px] uppercase tracking-[0.08em] font-bold mb-3 mt-2 text-primary">PRO</p>
            <div className="flex items-end gap-1">
              <span className="font-display text-5xl font-semibold text-foreground" style={{ letterSpacing: "-1px" }}>
                {annual ? "$79" : "$9.99"}
              </span>
              <span className="text-muted-foreground mb-2">/{annual ? "year" : "month"}</span>
            </div>
            <p className="text-xs font-semibold mt-1 text-primary">
              {annual ? "~$6.58/month · best value" : "or $79/year — save 30%"}
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-[1.7]">Unlock full access and get seen</p>
            <Button className="w-full mt-6 h-11 text-sm font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Crown className="w-4 h-4 mr-2" /> Get Spot'd PRO
            </Button>
            <FeatureList features={PRO_FEATURES} />
          </motion.div>

          {/* ELITE */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative rounded-2xl p-7 overflow-hidden border border-primary"
            style={{ background: "hsl(var(--card))" }}
          >
            <div className="relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap bg-primary text-primary-foreground">
                  Best for serious talent
                </span>
              </div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-bold mb-3 mt-2 text-primary">Elite</p>
              <div className="flex items-end gap-1">
                <span className="font-display text-5xl font-semibold text-foreground" style={{ letterSpacing: "-1px" }}>
                  {annual ? "$149" : "$14.99"}
                </span>
                <span className="text-muted-foreground mb-2">/{annual ? "year" : "month"}</span>
              </div>
              <p className="text-xs font-semibold mt-1 text-primary">
                {annual ? "~$12.42/month · best value" : "or $149/year — save 16%"}
              </p>
              <p className="text-sm text-muted-foreground mt-3 leading-[1.7]">Stand out and get ahead of the competition</p>
              <Button className="w-full mt-6 h-11 text-sm font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                <Star className="w-4 h-4 mr-2" /> Go Elite
              </Button>
              <FeatureList features={ELITE_FEATURES} />
            </div>
          </motion.div>
        </div>

        {/* Founding member CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="max-w-2xl mx-auto mt-24"
        >
          <div className="relative rounded-2xl p-10 text-center overflow-hidden border border-primary"
            style={{ background: "hsl(var(--card))" }}>
            <div className="relative">
              <span className="text-primary text-2xl mb-3 block">✦</span>
              <h3 className="font-display text-2xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>Founding member offer</h3>
              <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm leading-[1.7]">
                Join now and lock in PRO access for life — free. The first 500 members receive a founding member badge, verified profile, and permanent priority listing. No credit card required.
              </p>

              {/* Spot counter */}
              <div className="mt-6 inline-flex items-center gap-3 rounded-full px-5 py-2.5 border border-border bg-secondary/60">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-medium text-foreground">
                  {spotsLeft === null ? (
                    <span className="text-muted-foreground">Loading spots...</span>
                  ) : spotsLeft === 0 ? (
                    <span className="text-destructive">All spots claimed!</span>
                  ) : (
                    <>
                      <span className="text-primary">{spotsLeft}</span>
                      <span className="text-muted-foreground"> / {MAX_SPOTS} spots remaining</span>
                    </>
                  )}
                </span>
              </div>

              <Link to="/create-profile" className="block mt-6">
                <Button
                  size="lg"
                  disabled={spotsLeft === 0}
                  className="font-bold px-10 h-12 text-sm rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Sparkles className="w-4 h-4 mr-2" /> Claim your spot
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-3">Free forever · no credit card · limited to first 500</p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}