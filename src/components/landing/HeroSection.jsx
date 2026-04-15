import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const DIRECTORY_PREVIEW = [
  { role: "Director", status: "Available now", score: "92" },
  { role: "Cinematographer", status: "Available now", score: "87" },
  { role: "Actor", status: "Available soon", score: "79" },
  { role: "Producer", status: "Available now", score: "95" },
];

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-background pt-16">
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left: headline block */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Label */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-6 h-[1px] bg-primary" />
              <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-normal">
                The indie film directory
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display font-500 text-foreground leading-[1.0]" style={{ letterSpacing: "-1.5px" }}>
              <span className="block text-5xl sm:text-6xl lg:text-7xl">The indie film world,</span>
              <span className="block text-5xl sm:text-6xl lg:text-7xl" style={{ color: "#E8FC6C" }}>finally visible.</span>
            </h1>

            <p className="mt-8 text-base text-muted-foreground max-w-lg leading-[1.7]">
              Spot'd is where independent filmmakers find the people who make their vision real — and where talent gets seen by the people who matter.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link to="/create-profile">
                <Button size="lg" className="bg-primary text-primary-foreground font-semibold px-8 h-12 text-sm hover:bg-primary/90 rounded-full w-full sm:w-auto">
                  Get spot'd
                </Button>
              </Link>
              <Link to="/search">
                <Button variant="outline" size="lg" className="border-border text-foreground h-12 px-8 text-sm hover:bg-secondary rounded-full w-full sm:w-auto">
                  Browse the directory
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            {/* Stats row */}
            <div className="mt-12 flex items-center gap-10">
              {[
                { label: "Roles covered", value: "30+" },
                { label: "Verified profiles", value: "100%" },
                { label: "Direct contact", value: "Instant" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="font-display text-2xl font-semibold text-foreground" style={{ letterSpacing: "-0.5px" }}>{stat.value}</div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: directory preview panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block relative"
          >
            <div className="relative">
              {/* Subtle accent shape */}
              <div className="absolute -top-4 -right-4 w-40 h-56 border border-primary/10 rounded-lg pointer-events-none" />

              {/* Panel */}
              <div className="relative rounded-xl overflow-hidden border border-border bg-card">
                <div className="px-6 pt-6 pb-4 border-b border-border">
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Now in the directory</div>
                </div>
                <div className="p-6 space-y-4">
                  {DIRECTORY_PREVIEW.map((item, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-border pb-3.5 last:border-0 last:pb-0">
                      <div>
                        <div className="text-sm font-medium text-foreground">{item.role}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{item.status}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Spot Score</div>
                        <span className="font-display font-semibold text-sm text-primary">{item.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 pb-5 pt-2 border-t border-border">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60">Spot'd — est. 2025</span>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-4 rounded-lg px-4 py-3 shadow-xl" style={{ background: "#E8FC6C" }}>
                <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-black/60">Founding members</div>
                <div className="font-display font-bold text-lg leading-none mt-0.5 text-black">Free PRO</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom divider */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 pb-8">
            <div className="flex-1 h-[1px] bg-border" />
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground/50">Scroll to discover</span>
            <div className="flex-1 h-[1px] bg-border" />
          </div>
        </div>
      </div>
    </section>
  );
}