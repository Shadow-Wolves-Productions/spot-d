import { useEffect, useState } from "react";
import HeroSection from "../components/landing/HeroSection";
import HowItWorks from "../components/landing/HowItWorks";
import FeaturedProfiles from "../components/landing/FeaturedProfiles";
import PricingPreview from "../components/landing/PricingPreview";
import CastingCallsPreview from "../components/landing/CastingCallsPreview";
import LiveStatsBar from "../components/landing/LiveStatsBar";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, Shield, Users, Zap, Phone, Megaphone } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";

const FEATURES = [
  {
    icon: Search,
    title: "Smart search",
    desc: "Filter by role, location, experience, availability — across Talent, Crew and Companies.",
  },
  {
    icon: Shield,
    title: "SpotScore trust",
    desc: "A 0-100 credibility score built from verifications, peer Spots, and real activity. Not followers. Not vibes.",
  },
  {
    icon: Users,
    title: "Frequently Spotted with",
    desc: "Automatic crew connections from shared project credits. If you've worked together, Spot'd finds it.",
  },
  {
    icon: Zap,
    title: "Spot them",
    desc: "Peer endorsements that mean something — because the other person has to agree.",
  },
  {
    icon: Phone,
    title: "Direct contact",
    desc: "Reveal contact details instantly. No internal messaging, no waiting, no middleman.",
  },
  {
    icon: Megaphone,
    title: "Casting calls",
    desc: "Post or find roles with a full application pipeline — from open call to booked.",
  },
];

export default function Landing() {
  const [founderCount, setFounderCount] = useState(0);

  useEffect(() => {
    base44.http.get("/api/public-stats").then(({ data }) => setFounderCount(data.founder_count || 0)).catch(() => {});
  }, []);

  return (
    <div>
      <HeroSection />

      {/* Live counts strip — small, factual, on-brand */}
      <LiveStatsBar />

      <FeaturedProfiles />

      {/* Why Spot'd — feature tiles updated to current platform */}
      <section className="py-20 px-4 border-t border-border" data-testid="why-spotd-section">
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

      <CastingCallsPreview />

      <PricingPreview />

      {/* Founding member CTA — live count, current PRO benefits */}
      <section className="py-20 px-4 border-t border-border" data-testid="founding-member-section">
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
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mt-6 font-mono" data-testid="founding-counter">
                <span className="text-primary font-bold">{founderCount}</span> of 500 founding spots claimed
              </p>
            </div>
            <div className="p-10 lg:p-14 flex flex-col justify-center bg-primary">
              <div className="text-[11px] uppercase tracking-[0.08em] text-primary-foreground/60 mb-4">What you get</div>
              <ul className="space-y-2 mb-8">
                {[
                  "Free PRO access for life",
                  "Founding member badge",
                  "Priority placement in search",
                  "Unlimited contact reveals",
                  "Full portfolio uploads",
                  "Post casting calls",
                ].map((item) => (
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
