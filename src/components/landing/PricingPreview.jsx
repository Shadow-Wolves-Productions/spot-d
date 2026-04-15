import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    desc: "Get listed. Start exploring.",
    features: ["Basic profile creation", "1 headshot upload", "Browse casting calls", "2 contact reveals / month"],
    cta: "Get started",
    ctaLink: "/create-profile",
    highlight: false,
    dark: false,
  },
  {
    name: "PRO",
    label: "Recommended",
    price: "$79",
    priceSub: "/year",
    monthly: "~$6.58/mo",
    desc: "Unlock full access and get seen faster.",
    features: ["Unlimited contact reveals", "Full portfolio uploads", "Advanced search filters", "Priority placement", "Save favourite profiles"],
    cta: "Get Spot'd PRO",
    ctaLink: "/pricing",
    highlight: true,
    dark: false,
  },
  {
    name: "Elite",
    label: "Best for serious talent",
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
    <section className="py-20 px-4 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Membership</span>
          <h2 className="font-display font-500 text-4xl sm:text-5xl text-foreground mt-2" style={{ letterSpacing: "-1px" }}>Simple pricing.</h2>
          <p className="text-muted-foreground mt-3 text-base leading-[1.7]">Start free. Upgrade when you're ready to be seen.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 max-w-4xl">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative p-7 rounded-xl border"
              style={{
                background: "hsl(var(--card))",
                borderColor: tier.highlight ? "#E8FC6C" : tier.dark ? "#534AB7" : "hsl(var(--border))",
              }}
            >
              {tier.label && (
                <div className="absolute -top-3 left-4">
                  <span
                    className="text-[10px] uppercase tracking-[0.08em] font-bold px-3 py-1 rounded-full whitespace-nowrap"
                    style={tier.highlight ? { background: "#E8FC6C", color: "#0D0D0D" } : { background: "#534AB7", color: "#fff" }}
                  >
                    {tier.label}
                  </span>
                </div>
              )}
              <div className="text-[10px] uppercase tracking-[0.08em] font-medium mb-2 mt-1 text-muted-foreground">
                {tier.name}
              </div>
              <div className="font-display text-3xl font-semibold text-foreground" style={{ letterSpacing: "-0.5px" }}>
                {tier.price}
                {tier.priceSub && <span className="text-sm font-normal text-muted-foreground">{tier.priceSub}</span>}
              </div>
              {tier.monthly && (
                <p className="text-xs font-semibold mt-0.5" style={{ color: tier.dark ? "#534AB7" : "#E8FC6C" }}>{tier.monthly}</p>
              )}
              <p className="text-sm mt-2 mb-5 text-muted-foreground leading-[1.7]">{tier.desc}</p>
              <div className="space-y-2 mb-6">
                {tier.features.map((f) => (
                  <div key={f} className="flex items-center gap-2.5 text-sm text-foreground/80">
                    <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <Link to={tier.ctaLink}>
                <Button
                  className="w-full font-semibold rounded-full text-sm"
                  style={
                    tier.highlight
                      ? { background: "#E8FC6C", color: "#0D0D0D" }
                      : tier.dark
                      ? { background: "#534AB7", color: "#fff" }
                      : undefined
                  }
                  variant="outline"
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