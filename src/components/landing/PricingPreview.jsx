import { Link } from "react-router-dom";
import { Check, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const FREE_FEATURES = [
  "Basic profile creation",
  "Profile photo upload",
  "Basic search filters",
  "5 contact reveals / month",
  "Public profile visibility",
];

const PRO_FEATURES = [
  "Full profile with portfolio",
  "Unlimited contact reveals",
  "Advanced search filters",
  "PRO badge on profile",
  "Priority search placement",
  "Verification indicators",
  "Save favourite profiles",
  "Portfolio & reel uploads",
  "Full credits visibility",
];

export default function PricingPreview() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs uppercase tracking-[0.2em] text-primary font-medium">Pricing</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mt-3">
            Simple, Transparent Pricing
          </h2>
          <p className="text-muted-foreground mt-3">Start free. Upgrade when you're ready.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Free */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-card border border-border/60 rounded-xl p-8"
          >
            <h3 className="font-display text-xl font-semibold text-foreground">Free</h3>
            <div className="mt-4">
              <span className="font-display text-4xl font-bold text-foreground">$0</span>
              <span className="text-muted-foreground text-sm ml-1">/forever</span>
            </div>
            <p className="text-sm text-muted-foreground mt-3">Get started and explore the directory.</p>
            <div className="mt-6 space-y-3">
              {FREE_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm text-foreground/80">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <Link to="/create-profile">
              <Button variant="outline" className="w-full mt-8 border-border hover:bg-secondary/50">
                Get Started Free
              </Button>
            </Link>
          </motion.div>

          {/* PRO */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative bg-card border border-primary/30 rounded-xl p-8 gold-glow"
          >
            <div className="absolute -top-3 left-6">
              <span className="glass-gold px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Most Popular
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              <h3 className="font-display text-xl font-semibold text-foreground">PRO</h3>
            </div>
            <div className="mt-4">
              <span className="font-display text-4xl font-bold text-foreground">$9.99</span>
              <span className="text-muted-foreground text-sm ml-1">/month</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">or $79/year (save 34%)</p>
            <p className="text-sm text-muted-foreground mt-3">Everything you need to stand out and connect.</p>
            <div className="mt-6 space-y-3">
              {PRO_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <Link to="/pricing">
              <Button className="w-full mt-8 bg-primary text-primary-foreground hover:bg-primary/90">
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to PRO
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}