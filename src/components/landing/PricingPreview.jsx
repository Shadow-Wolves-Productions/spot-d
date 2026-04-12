import { Link } from "react-router-dom";
import { Check, ArrowRight, Crown, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    desc: "Get listed. Start exploring.",
    features: ["Basic profile creation", "1 headshot upload", "Browse casting calls", "2 contact reveals / month"],
    cta: "Get Started",
    ctaLink: "/create-profile",
    highlight: false,
    dark: false,
  },
  {
    name: "Pro",
    label: "Most Popular",
    price: "$79",
    priceSub: "/year",
    monthly: "~$6.58/mo",
    desc: "Unlock full access and get seen faster.",
    features: ["Unlimited contact reveals", "Full portfolio uploads", "Advanced search filters", "Priority placement", "Save favourite profiles"],
    cta: "Upgrade to Pro",
    ctaLink: "/pricing",
    highlight: true,
    dark: false,
  },
  {
    name: "Elite",
    label: "Best for Serious Actors",
    price: "$149",
    priceSub: "/year",
    monthly: "~$12.42/mo",
    desc: "Stand out. Get cast. Stay ahead.",
    features: ["Everything in Pro", "Highest priority placement", "Rotating homepage spotlight", "Analytics & engagement insights", "Premium verified badge"],
    cta: "Go Elite",
    ctaLink: "/pricing",
    highlight: false,
    dark: true,
  },
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

        <div className="grid sm:grid-cols-3 gap-5 max-w-4xl">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative p-7 rounded-xl border ${
                tier.highlight
                  ? "border-primary bg-card shadow-lg shadow-primary/10"
                  : tier.dark
                  ? "border-foreground bg-foreground"
                  : "border-border bg-card"
              }`}
            >
              {tier.label && (
                <div className="absolute -top-3 left-4">
                  <span className="bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full whitespace-nowrap">
                    {tier.label}
                  </span>
                </div>
              )}
              <div className={`text-[10px] uppercase tracking-widest font-semibold mb-2 mt-1 ${tier.dark ? "text-primary" : "text-muted-foreground"}`}>
                {tier.name}
              </div>
              <div className={`font-display text-3xl font-bold ${tier.dark ? "text-background" : "text-foreground"}`}>
                {tier.price}
                {tier.priceSub && <span className={`text-sm font-normal ${tier.dark ? "text-background/50" : "text-muted-foreground"}`}>{tier.priceSub}</span>}
              </div>
              {tier.monthly && (
                <p className="text-xs text-primary mt-0.5">{tier.monthly}</p>
              )}
              <p className={`text-sm mt-2 mb-5 ${tier.dark ? "text-background/60" : "text-muted-foreground"}`}>{tier.desc}</p>
              <div className="space-y-2 mb-6">
                {tier.features.map((f) => (
                  <div key={f} className={`flex items-center gap-2.5 text-sm ${tier.dark ? "text-background/80" : "text-foreground/80"}`}>
                    <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <Link to={tier.ctaLink}>
                <Button
                  className={`w-full font-semibold rounded-none text-sm ${
                    tier.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : tier.dark
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-foreground/20 bg-transparent text-foreground hover:bg-secondary"
                  }`}
                  variant={tier.highlight || tier.dark ? "default" : "outline"}
                >
                  {tier.cta} {(tier.highlight || tier.dark) && <ArrowRight className="w-3.5 h-3.5 ml-1" />}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}