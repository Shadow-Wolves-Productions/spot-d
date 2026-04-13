import HeroSection from "../components/landing/HeroSection";
import HowItWorks from "../components/landing/HowItWorks";
import FeaturedProfiles from "../components/landing/FeaturedProfiles";
import PricingPreview from "../components/landing/PricingPreview";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Film, Search, Shield, Star, Users, Camera } from "lucide-react";
import { motion } from "framer-motion";

const FEATURES = [
  { icon: Search, title: "Smart Search", desc: "Filter by role, location, experience, availability, and more." },
  { icon: Shield, title: "CineScore Trust", desc: "Credibility scores based on verification, credits, and connections." },
  { icon: Film, title: "IMDb Integration", desc: "Link your IMDb profile and showcase your top credits." },
  { icon: Users, title: "Worked With", desc: "Professional connection confirmations from real collaborators." },
  { icon: Star, title: "Endorsements", desc: "Structured professional endorsements from your network." },
  { icon: Camera, title: "PRO Profiles", desc: "Stand out with portfolio, priority placement, and unlimited reveals." },
];

export default function Landing() {
  return (
    <div>
      <HeroSection />
      <FeaturedProfiles />

      {/* Features — editorial grid */}
      <section className="py-20 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <span className="text-[10px] uppercase tracking-[0.25em] text-primary font-semibold">Built For Film People</span>
            <h2 className="font-display font-bold text-4xl sm:text-5xl text-foreground mt-1">
              Why CineConnect?
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
                <h3 className="font-display text-base font-bold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <HowItWorks />
      <PricingPreview />

      {/* Founding Member CTA */}
      <section className="py-20 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-0 border border-foreground">
            <div className="p-10 lg:p-14 border-b lg:border-b-0 lg:border-r border-foreground">
              <span className="text-[10px] uppercase tracking-[0.25em] text-primary font-semibold">Limited Offer</span>
              <h2 className="font-display font-bold text-4xl sm:text-5xl text-foreground mt-2 leading-tight">
                Founding<br />Member Access
              </h2>
              <p className="text-muted-foreground mt-4 text-base leading-relaxed max-w-sm">
                The first 500 members get lifetime free PRO access, a Founding Member badge, and priority listing in the directory.
              </p>
            </div>
            <div className="p-10 lg:p-14 bg-foreground flex flex-col justify-center">
              <div className="text-[10px] uppercase tracking-[0.25em] text-primary font-semibold mb-4">What You Get</div>
              <ul className="space-y-2 mb-8">
                {["Free PRO access forever", "Founding Member badge", "Verified profile status", "Priority search placement"].map((item) => (
                  <li key={item} className="text-sm text-background/80 flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link to="/create-profile">
                <Button size="lg" className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 rounded-none w-full sm:w-auto px-10">
                  Claim Your Spot Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}