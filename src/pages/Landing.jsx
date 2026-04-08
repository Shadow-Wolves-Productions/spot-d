import HeroSection from "../components/landing/HeroSection";
import HowItWorks from "../components/landing/HowItWorks";
import FeaturedProfiles from "../components/landing/FeaturedProfiles";
import PricingPreview from "../components/landing/PricingPreview";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Crown, Search, Shield, Film, Star, Users } from "lucide-react";
import { motion } from "framer-motion";

const FEATURES = [
  { icon: Search, title: "Smart Search", desc: "Filter by role, location, experience, availability, and more." },
  { icon: Shield, title: "CineScore Trust", desc: "Credibility scores based on verification, credits, and connections." },
  { icon: Film, title: "IMDb Integration", desc: "Link your IMDb profile and showcase your top credits." },
  { icon: Users, title: "Worked With", desc: "Professional connection confirmations from real collaborators." },
  { icon: Star, title: "Endorsements", desc: "Structured professional endorsements from your network." },
  { icon: Crown, title: "PRO Profiles", desc: "Stand out with portfolio, priority placement, and unlimited reveals." },
];

export default function Landing() {
  return (
    <div>
      <HeroSection />

      {/* Features */}
      <section className="py-24 px-4 border-t border-border/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs uppercase tracking-[0.2em] text-primary font-medium">Why CineConnect</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mt-3">
              Built for Filmmakers
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
              A focused directory designed for the film industry. No fluff, no bloat.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="bg-card/50 border border-border/40 rounded-xl p-6 hover:border-primary/20 transition-all duration-300"
              >
                <feat.icon className="w-5 h-5 text-primary mb-4" />
                <h3 className="font-display text-base font-semibold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <HowItWorks />
      <FeaturedProfiles />

      <PricingPreview />

      {/* Founding Member CTA */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-effect rounded-2xl p-12 gold-glow"
          >
            <Crown className="w-8 h-8 text-primary mx-auto mb-4" />
            <h2 className="font-display text-3xl font-bold text-foreground">
              Founding Member Offer
            </h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto">
              The first 500 members get free PRO access, a Founding Member badge, verified profile, and priority listing.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/create-profile">
                <Button size="lg" className="glass-gold text-primary-foreground font-semibold px-8">
                  Claim Your Spot
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}