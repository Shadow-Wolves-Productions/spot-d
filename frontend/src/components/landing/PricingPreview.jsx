import { Link } from "react-router-dom";
import { Check, ArrowRight, Crown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    desc: "Get started and explore opportunities",
    features: ["Basic profile creation", "1 headshot upload", "Browse casting calls", "2 contact reveals per month", "Limited search visibility"],
    cta: "Get started",
    ctaLink: "/create-profile",
    highlight: false,
    elite: false,
  },
  {
    name: "PRO",
    label: "Recommended",
    price: "$79",
    priceSub: "/year",
    monthly: "~$6.58/month · best value",
    desc: "Unlock full access and get seen",
    features: ["Unlimited contact reveals", "Multiple headshots + full portfolio", "Advanced search filters", "IMDb profile visibility", "Increased search visibility"],
    cta: "Get Spot'd PRO",
    ctaLink: "/pricing",
    highlight: true,
    elite: false,
    icon: Crown,
  },
  {
    name: "Elite",
    label: "Best for serious talent",
    price: "$149",
    priceSub: "/year",
    monthly: "~$12.42/month · best value",
    desc: "Stand out and get ahead of the competition",
    features: ["Everything in Pro", "Highest priority search placement", "Rotating homepage spotlight", "Advanced analytics & engagement insights", "Premium verified badge"],
    cta: "Go Elite",
    ctaLink: "/pricing",
    highlight: false,
    elite: true,
    icon: Star,
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

        <div className="grid sm:grid-cols-3 gap-6 items-start max-w-5xl">
           {TIERS.map((tier, i) => {
             const Icon = tier.icon;
             return (
               <motion.div
                 key={tier.name}
                 initial={{ opacity: 0, y: 24 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true }}
                 transition={{ delay: i * 0.1 }}
                 className={`relative rounded-2xl p-7 border ${tier.highlight ? "sm:-mt-4 sm:-mb-4" : ""}`}
                 style={{
                   background: "hsl(var(--card))",
                   borderColor: tier.highlight ? "#FF5C35" : tier.elite ? "#E6FF00" : "hsl(var(--border))",
                 }}
               >
                 {tier.label && (
                   <div className={`absolute -top-4 left-1/2 -translate-x-1/2 ${tier.highlight ? "" : ""}`}>
                     <span
                       className="px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap"
                       style={{
                         background: tier.highlight ? "#FF5C35" : tier.elite ? "#E6FF00" : undefined,
                         color: tier.highlight ? "white" : tier.elite ? "black" : undefined,
                       }}
                     >
                       {tier.label}
                     </span>
                   </div>
                 )}
                 <p className="text-[11px] uppercase tracking-[0.08em] font-bold mb-3 mt-2" style={{
                   color: tier.highlight ? "#FF5C35" : tier.elite ? "#E6FF00" : "hsl(var(--muted-foreground))",
                 }}>
                   {tier.name}
                 </p>
                 <div className="flex items-end gap-1">
                   <span className="font-display text-5xl font-semibold text-foreground" style={{ letterSpacing: "-1px" }}>
                     {tier.price}
                   </span>
                   {tier.priceSub && <span className="text-muted-foreground mb-2">{tier.priceSub}</span>}
                 </div>
                 {tier.monthly && (
                   <p className="text-xs font-semibold mt-1" style={{
                     color: tier.highlight ? "#FF5C35" : tier.elite ? "#E6FF00" : undefined,
                   }}>
                     {tier.monthly}
                   </p>
                 )}
                 <p className="text-sm text-muted-foreground mt-3 leading-[1.7] mb-6">{tier.desc}</p>
                 <Link to={tier.ctaLink}>
                   <Button
                     className="w-full h-11 text-sm font-semibold rounded-full"
                     style={{
                       background: tier.highlight ? "#FF5C35" : tier.elite ? "#E6FF00" : undefined,
                       color: tier.highlight ? "white" : tier.elite ? "black" : undefined,
                     }}
                     variant={tier.highlight || tier.elite ? "default" : "outline"}
                   >
                     {Icon && <Icon className="w-4 h-4 mr-2" />}
                     {tier.cta}
                   </Button>
                 </Link>
                 <ul className="space-y-3 mt-6">
                   {tier.features.map((f) => (
                     <li key={f} className="flex items-start gap-3 text-sm text-foreground">
                       <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{
                         color: tier.highlight ? "#FF5C35" : tier.elite ? "#E6FF00" : "hsl(var(--primary))",
                       }} />
                       {f}
                     </li>
                   ))}
                 </ul>
               </motion.div>
             );
           })}
         </div>
      </div>
    </section>
  );
}