import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
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
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <span className="text-[10px] uppercase tracking-[0.25em] text-primary font-semibold">Membership</span>
          <h2 className="font-display font-bold text-4xl sm:text-5xl text-foreground mt-1">Simple Pricing.</h2>
          <p className="text-muted-foreground mt-3 text-base">Start free. Upgrade when you're ready to be seen.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-0 border border-border max-w-3xl">
          {/* Free */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-8 border-r border-border"
          >
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Free Tier</div>
            <h3 className="font-display text-2xl font-bold text-foreground">$0</h3>
            <p className="text-sm text-muted-foreground mt-2 mb-6">Get listed. Start exploring.</p>
            <div className="space-y-2.5 mb-8">
              {FREE_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-foreground/40 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <Link to="/create-profile">
              <Button variant="outline" className="w-full border-foreground/20 text-foreground hover:bg-secondary rounded-none">
                Get Started Free
              </Button>
            </Link>
          </motion.div>

          {/* PRO */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="p-8 bg-foreground text-background relative"
          >
            <div className="absolute top-4 right-4">
              <span className="bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-semibold px-2 py-1">Popular</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1">PRO Membership</div>
            <h3 className="font-display text-2xl font-bold text-background">$9.99 <span className="text-sm font-normal text-background/50">/month</span></h3>
            <p className="text-xs text-background/50 mt-0.5 mb-6">or $79/year — save 34%</p>
            <div className="space-y-2.5 mb-8">
              {PRO_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm text-background/80">
                  <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <Link to="/pricing">
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-none font-semibold">
                Upgrade to PRO <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}