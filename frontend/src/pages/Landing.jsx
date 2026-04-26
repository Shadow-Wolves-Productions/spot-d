import HeroSection from "../components/landing/HeroSection";
import HowItWorks from "../components/landing/HowItWorks";
import FeaturedProfiles from "../components/landing/FeaturedProfiles";
import PricingPreview from "../components/landing/PricingPreview";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, Shield, Film, Users, Star, Camera } from "lucide-react";
import { motion } from "framer-motion";

const FEATURES = [
  { icon: Search, title: "Smart search", desc: "Filter by role, location, experience, availability, union status, and more." },
  { icon: Shield, title: "Spot Score trust", desc: "Credibility scores based on verification, credits, and real connections." },
  { icon: Film, title: "IMDb integration", desc: "Link your IMDb profile and showcase your top credits directly." },
  { icon: Users, title: "Frequently Spotted with", desc: "Automatic crew connections from shared project credits — no claiming, no gatekeeping." },
  { icon: Star, title: "Spots", desc: "Peer Spots from real collaborators. Request one, earn one, or give one." },
  { icon: Camera, title: "PRO profiles", desc: "Stand out with portfolio, priority placement, and unlimited contact reveals." },
];

export default function Landing() {
  return (
    <div>
      <HeroSection />
      <FeaturedProfiles />

      {/* Features */}
      <section className="py-20 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Built for film people</span>
            <h2 className="font-display font-500 text-4xl sm:text-5xl text-foreground mt-2" style={{ letterSpacing: "-1px" }}>
              Why Spot'd?
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-border">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className="p-7 border-b border-r border-border group hover:bg-secondary/40 transition-colors"
              >
                <feat.icon className="w-5 h-5 text-primary mb-4" />
                <h3 className="font-display text-base font-medium text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-[1.7]">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <HowItWorks />
      <PricingPreview />

      {/* Founding member CTA */}
      <section className="py-20 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-0 border border-border rounded-xl overflow-hidden">
            <div className="p-10 lg:p-14 border-b lg:border-b-0 lg:border-r border-border bg-card">
              <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Limited offer</span>
              <h2 className="font-display font-500 text-4xl sm:text-5xl text-foreground mt-2 leading-tight" style={{ letterSpacing: "-1px" }}>
                Founding<br />member access
              </h2>
              <p className="text-muted-foreground mt-4 text-base leading-[1.7] max-w-sm">
                The first 500 members get lifetime free PRO access, a founding member badge, and priority listing in the directory.
              </p>
            </div>
            <div className="p-10 lg:p-14 flex flex-col justify-center bg-primary">
              <div className="text-[11px] uppercase tracking-[0.08em] text-primary-foreground/60 mb-4">What you get</div>
              <ul className="space-y-2 mb-8">
                {["Free PRO access forever", "Founding member badge", "Verified profile status", "Priority search placement"].map((item) => (
                  <li key={item} className="text-sm text-primary-foreground flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary-foreground/40 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link to="/create-profile">
                <Button size="lg" className="bg-foreground text-background font-semibold hover:bg-foreground/80 rounded-full w-full sm:w-auto px-10">
                  Claim your spot
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}