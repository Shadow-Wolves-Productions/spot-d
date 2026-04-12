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

function FeatureList({ features }) {
  return (
    <ul className="space-y-3 mt-6">
      {features.map((f) => (
        <li key={f.text} className={`flex items-start gap-3 text-sm ${f.included ? "text-foreground" : "text-muted-foreground/50"}`}>
          {f.included ? (
            <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          ) : (
            <X className="w-4 h-4 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
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
    base44.entities.Profile.list("-created_date", 1).then((profiles) => {
      base44.entities.Profile.list("-created_date", 500).then((all) => {
        const taken = Math.min(all.length, MAX_SPOTS);
        setSpotsLeft(Math.max(0, MAX_SPOTS - taken));
      });
    });
  }, []);

  return (
    <div className="pt-28 pb-24 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs mb-4 px-3 py-1">
              <Sparkles className="w-3 h-3 mr-1" /> Join Australia's Indie Film Directory
            </Badge>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground">
              Pricing That Scales With You
            </h1>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-base">
              Start free. Upgrade to get seen faster, unlock more opportunities, and stand out from the crowd.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setAnnual(false)}
                className={`text-sm font-medium transition-colors ${!annual ? "text-foreground" : "text-muted-foreground"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(!annual)}
                className={`relative w-12 h-6 rounded-full transition-colors ${annual ? "bg-primary" : "bg-secondary border border-border"}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${annual ? "left-7" : "left-1"}`} />
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`text-sm font-medium transition-colors ${annual ? "text-foreground" : "text-muted-foreground"}`}
              >
                Annual <span className="text-primary text-xs ml-1">Save ~30%</span>
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
            className="bg-card border border-border/60 rounded-2xl p-7"
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Free</p>
            <div className="flex items-end gap-1">
              <span className="font-display text-5xl font-bold text-foreground">$0</span>
            </div>
            <p className="text-sm text-muted-foreground mt-3">Get started and explore opportunities</p>
            <Link to="/create-profile" className="block mt-6">
              <Button variant="outline" className="w-full border-border h-11 text-sm font-semibold">
                Get Started
              </Button>
            </Link>
            <FeatureList features={FREE_FEATURES} />
          </motion.div>

          {/* PRO — Most Popular */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative bg-card border-2 border-primary rounded-2xl p-7 shadow-lg shadow-primary/10 md:-mt-4 md:-mb-4"
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest whitespace-nowrap shadow-sm">
                ★ Most Popular
              </span>
            </div>
            <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3 mt-2">Pro</p>
            <div className="flex items-end gap-1">
              <span className="font-display text-5xl font-bold text-foreground">
                {annual ? "$79" : "$9.99"}
              </span>
              <span className="text-muted-foreground mb-2">/{annual ? "year" : "month"}</span>
            </div>
            <p className="text-xs text-primary font-medium mt-1">
              {annual ? "~$6.58/month · Best value" : "or $79/year — save 30%"}
            </p>
            <p className="text-sm text-muted-foreground mt-3">Unlock full access and get seen</p>
            <Button className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90 h-11 text-sm font-semibold">
              <Crown className="w-4 h-4 mr-2" /> Upgrade to Pro
            </Button>
            <FeatureList features={PRO_FEATURES} />
          </motion.div>

          {/* ELITE */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative bg-foreground border border-foreground rounded-2xl p-7 overflow-hidden"
          >
            {/* Subtle glow overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/5 pointer-events-none" />

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-primary" />
                <p className="text-xs uppercase tracking-widest text-primary font-semibold">Elite</p>
              </div>
              <div className="flex items-end gap-1">
                <span className="font-display text-5xl font-bold text-background">
                  {annual ? "$149" : "$14.99"}
                </span>
                <span className="text-background/50 mb-2">/{annual ? "year" : "month"}</span>
              </div>
              <p className="text-xs text-primary font-medium mt-1">
                {annual ? "~$12.42/month · Best value" : "or $149/year — save 16%"}
              </p>
              <p className="text-sm text-background/60 mt-3">Stand out and get ahead of the competition</p>
              <Badge className="mt-3 bg-primary/20 text-primary border-primary/30 text-[10px] px-2 py-0.5">
                Best for Serious Actors &amp; Crew
              </Badge>
              <Button className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90 h-11 text-sm font-semibold">
                <Star className="w-4 h-4 mr-2" /> Go Elite
              </Button>

              <ul className="space-y-3 mt-6">
                {ELITE_FEATURES.map((f) => (
                  <li key={f.text} className="flex items-start gap-3 text-sm text-background/80">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>

        {/* Founding Member CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="max-w-2xl mx-auto mt-24"
        >
          <div className="relative bg-card border border-primary/30 rounded-2xl p-10 text-center overflow-hidden gold-glow">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
            <div className="relative">
              <Crown className="w-9 h-9 text-primary mx-auto mb-4" />
              <h3 className="font-display text-2xl font-bold text-foreground">Founding Member Offer</h3>
              <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm leading-relaxed">
                Join now and lock in Pro access for life — free. The first 500 members receive a Founding Member badge, verified profile, and permanent priority listing. No credit card required.
              </p>

              {/* Countdown */}
              <div className="mt-6 inline-flex items-center gap-3 bg-secondary/70 border border-border/50 rounded-full px-5 py-2.5">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-semibold text-foreground">
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
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-10 h-12 text-sm"
                >
                  <Sparkles className="w-4 h-4 mr-2" /> Claim Your Founding Member Spot
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-3">Free forever · No credit card · Limited to first 500</p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}