import { Search, User, Eye, Phone } from "lucide-react";
import { motion } from "framer-motion";

const STEPS = [
  { icon: Search, step: "01", title: "Search", description: "Browse cast, crew, and creative talent by role, location, experience, and availability." },
  { icon: User, step: "02", title: "Discover", description: "View editorial profiles with credits, CineScore trust rating, verifications, and endorsements." },
  { icon: Eye, step: "03", title: "Reveal", description: "Reveal contact details instantly. No waiting, no internal messaging, no friction." },
  { icon: Phone, step: "04", title: "Connect", description: "Reach out directly via email, phone, Instagram, or LinkedIn. That simple." },
];

export default function HowItWorks() {
  return (
    <section className="py-20 px-4 bg-foreground text-background">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <span className="text-[10px] uppercase tracking-[0.25em] text-primary font-semibold">How It Works</span>
          <h2 className="font-display font-bold text-4xl sm:text-5xl text-background mt-2">
            Search. Discover. Connect.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 border border-background/10">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="p-8 border-r border-background/10 last:border-r-0 border-b sm:border-b-0 group hover:bg-background/5 transition-colors"
            >
              <div className="font-display text-5xl font-bold text-primary/30 mb-4 leading-none">{step.step}</div>
              <step.icon className="w-5 h-5 text-primary mb-4" />
              <h3 className="font-display text-xl font-bold text-background mb-2">{step.title}</h3>
              <p className="text-sm text-background/55 leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}