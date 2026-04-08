import { Check, Crown, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { motion } from "framer-motion";

const COMPARISON = [
  { feature: "Profile Creation", free: true, pro: true },
  { feature: "Profile Photo", free: true, pro: true },
  { feature: "Basic Search Filters", free: true, pro: true },
  { feature: "Contact Reveals", free: "5/month", pro: "Unlimited" },
  { feature: "Advanced Search Filters", free: false, pro: true },
  { feature: "Portfolio Uploads", free: false, pro: true },
  { feature: "PRO Badge", free: false, pro: true },
  { feature: "Priority Placement", free: false, pro: true },
  { feature: "Verification Indicators", free: false, pro: true },
  { feature: "Save Favourite Profiles", free: false, pro: true },
  { feature: "Full Credits Visibility", free: false, pro: true },
  { feature: "Featured Eligibility", free: false, pro: true },
  { feature: "Profile Boost Options", free: false, pro: true },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="pt-28 pb-20 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge className="glass-gold text-primary text-xs mb-4">
              <Sparkles className="w-3 h-3 mr-1" /> First 500 Members Get Free PRO
            </Badge>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground">
              Simple, Transparent Pricing
            </h1>
            <p className="text-muted-foreground mt-4 max-w-lg mx-auto">
              Start free. Upgrade when you're ready to unlock unlimited access and premium features.
            </p>

            {/* Toggle */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setAnnual(false)}
                className={`text-sm font-medium transition-colors ${!annual ? "text-foreground" : "text-muted-foreground"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(!annual)}
                className={`relative w-12 h-6 rounded-full transition-colors ${annual ? "bg-primary" : "bg-secondary"}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-primary-foreground transition-transform ${annual ? "left-7" : "left-1"}`} />
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`text-sm font-medium transition-colors ${annual ? "text-foreground" : "text-muted-foreground"}`}
              >
                Annual <span className="text-primary text-xs ml-1">Save 34%</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border/60 rounded-xl p-8"
          >
            <h3 className="font-display text-2xl font-semibold text-foreground">Free</h3>
            <div className="mt-4">
              <span className="font-display text-5xl font-bold text-foreground">$0</span>
            </div>
            <p className="text-sm text-muted-foreground mt-3">Get started and explore the directory.</p>
            <Button variant="outline" className="w-full mt-8 border-border hover:bg-secondary/50 h-11">
              Get Started Free
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="relative bg-card border border-primary/30 rounded-xl p-8 gold-glow"
          >
            <div className="absolute -top-3 left-6">
              <span className="glass-gold px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider text-primary">
                Recommended
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-primary" />
              <h3 className="font-display text-2xl font-semibold text-foreground">PRO</h3>
            </div>
            <div className="mt-4">
              <span className="font-display text-5xl font-bold text-foreground">
                ${annual ? "79" : "9.99"}
              </span>
              <span className="text-muted-foreground ml-1">/{annual ? "year" : "month"}</span>
            </div>
            {annual && <p className="text-xs text-primary mt-1">~$6.58/month</p>}
            <p className="text-sm text-muted-foreground mt-3">Everything you need to stand out and connect.</p>
            <Button className="w-full mt-8 bg-primary text-primary-foreground hover:bg-primary/90 h-11">
              <Crown className="w-4 h-4 mr-2" /> Upgrade to PRO
            </Button>
          </motion.div>
        </div>

        {/* Comparison Table */}
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-2xl font-bold text-foreground text-center mb-8">
            Feature Comparison
          </h2>
          <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 gap-4 p-4 border-b border-border bg-secondary/30">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Feature</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium text-center">Free</span>
              <span className="text-xs uppercase tracking-wider text-primary font-medium text-center">PRO</span>
            </div>
            {COMPARISON.map((row) => (
              <div key={row.feature} className="grid grid-cols-3 gap-4 p-4 border-b border-border/30 last:border-0">
                <span className="text-sm text-foreground">{row.feature}</span>
                <div className="text-center">
                  {typeof row.free === "string" ? (
                    <span className="text-sm text-muted-foreground">{row.free}</span>
                  ) : row.free ? (
                    <Check className="w-4 h-4 text-muted-foreground mx-auto" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                  )}
                </div>
                <div className="text-center">
                  {typeof row.pro === "string" ? (
                    <span className="text-sm text-primary font-medium">{row.pro}</span>
                  ) : row.pro ? (
                    <Check className="w-4 h-4 text-primary mx-auto" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Founding Member */}
        <div className="max-w-2xl mx-auto mt-20 text-center">
          <div className="glass-effect rounded-2xl p-10 gold-glow">
            <Crown className="w-8 h-8 text-primary mx-auto mb-4" />
            <h3 className="font-display text-2xl font-bold text-foreground">Founding Member Offer</h3>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm">
              The first 500 members get free PRO access, a Founding Member badge, verified profile, and priority listing.
            </p>
            <Button size="lg" className="mt-6 glass-gold text-primary-foreground font-semibold px-8">
              Claim Your Spot
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}