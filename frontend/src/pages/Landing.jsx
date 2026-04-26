import HeroSection from "../components/landing/HeroSection";
import HowItWorks from "../components/landing/HowItWorks";
import FeaturedProfiles from "../components/landing/FeaturedProfiles";
import PricingPreview from "../components/landing/PricingPreview";
import CastingCallsPreview from "../components/landing/CastingCallsPreview";
import LiveStatsBar from "../components/landing/LiveStatsBar";
import TrustedByRow from "../components/landing/TrustedByRow";
import FoundingSection from "../components/landing/FoundingSection";
import { Search, Shield, Users, Zap, Phone, Megaphone } from "lucide-react";
import { motion } from "framer-motion";

const FEATURES = [
  { icon: Search,    title: "Smart search",          desc: "Filter by role, location, experience, availability — across Talent, Crew and Companies." },
  { icon: Shield,    title: "SpotScore trust",       desc: "A 0-100 credibility score built from verifications, peer Spots, and real activity. Not followers. Not vibes." },
  { icon: Users,     title: "Frequently Spotted with",desc: "Automatic crew connections from shared project credits. If you've worked together, Spot'd finds it." },
  { icon: Zap,       title: "Spot them",             desc: "Peer endorsements that mean something — because the other person has to agree." },
  { icon: Phone,     title: "Direct contact",        desc: "Reveal contact details instantly. No internal messaging, no waiting, no middleman." },
  { icon: Megaphone, title: "Casting calls",         desc: "Post or find roles with a full application pipeline — from open call to booked." },
];

export default function Landing() {
  return (
    <div>
      <HeroSection />

      <LiveStatsBar />

      <TrustedByRow />

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

      <FoundingSection source="landing" />
    </div>
  );
}
