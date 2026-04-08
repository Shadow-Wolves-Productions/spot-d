import { Search, User, Eye, Phone } from "lucide-react";
import { motion } from "framer-motion";

const STEPS = [
  {
    icon: Search,
    title: "Search",
    description: "Browse cast, crew, and creative talent by role, location, experience, and availability.",
  },
  {
    icon: User,
    title: "Discover",
    description: "View professional profiles with credits, CineScore, verifications, and endorsements.",
  },
  {
    icon: Eye,
    title: "Reveal",
    description: "Reveal contact details instantly. No waiting, no internal messaging, no friction.",
  },
  {
    icon: Phone,
    title: "Connect",
    description: "Reach out directly via email, phone, Instagram, or LinkedIn. Simple.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs uppercase tracking-[0.2em] text-primary font-medium">How It Works</span>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mt-3">
            Search. Connect. Create.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="relative group"
            >
              <div className="bg-card border border-border/60 rounded-xl p-6 h-full hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
                  Step {i + 1}
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}