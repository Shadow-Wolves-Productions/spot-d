import { Search, User, Eye, Phone } from "lucide-react";
import { motion } from "framer-motion";

const STEPS = [
  { icon: Search, step: "01", title: "Search", description: "Browse cast, crew, and creative talent by role, location, experience, and availability." },
  { icon: User, step: "02", title: "Discover", description: "View profiles with credits, Spot Score trust rating, verifications, and endorsements from real collaborators." },
  { icon: Eye, step: "03", title: "Reveal", description: "Reveal contact details instantly. No waiting, no internal messaging, no friction." },
  { icon: Phone, step: "04", title: "Connect", description: "Reach out directly via email, phone, Instagram, or LinkedIn. That simple." },
];

export default function HowItWorks() {
  return (
    <section className="py-20 px-4 border-t border-border" style={{ background: "#111" }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">How it works</span>
          <h2 className="font-display font-500 text-4xl sm:text-5xl text-foreground mt-2" style={{ letterSpacing: "-1px" }}>
            Search. Discover. Connect.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 border border-border rounded-lg overflow-hidden">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="p-8 border-r border-border last:border-r-0 border-b lg:border-b-0 group hover:bg-white/5 transition-colors"
            >
              <div className="font-display text-5xl font-bold mb-4 leading-none" style={{ color: "#E8FF47", opacity: 0.25 }}>{step.step}</div>
              <step.icon className="w-5 h-5 text-primary mb-4" />
              <h3 className="font-display text-xl font-medium text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-[1.7]">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}