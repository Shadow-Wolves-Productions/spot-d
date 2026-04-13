import { Link } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-background pt-16">
      {/* Editorial rule top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-foreground" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: editorial text block */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Category label */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-[2px] bg-primary" />
              <span className="text-xs uppercase tracking-[0.22em] text-primary font-semibold">
                The Indie Film Directory
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display font-bold text-foreground leading-[1.0] tracking-tight">
              <span className="block text-5xl sm:text-6xl lg:text-7xl">Find the</span>
              <span className="block text-6xl sm:text-7xl lg:text-8xl text-primary">Right People</span>
              <span className="block text-5xl sm:text-6xl lg:text-7xl">for Your Film.</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-lg leading-relaxed">
              A curated directory of cast, crew, and creative talent built for the independent film world. No fluff, no recruiters — just real film people.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link to="/search">
                <Button size="lg" className="bg-foreground text-background font-semibold px-8 h-12 text-sm hover:bg-foreground/90 w-full sm:w-auto">
                  <Search className="w-4 h-4 mr-2" />
                  Browse the Directory
                </Button>
              </Link>
              <Link to="/create-profile">
                <Button variant="outline" size="lg" className="border-foreground/20 text-foreground h-12 px-8 text-sm hover:bg-secondary w-full sm:w-auto">
                  List Yourself
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            {/* Stats row */}
            <div className="mt-12 flex items-center gap-10">
              {[
                { label: "Roles", value: "30+" },
                { label: "Verified Profiles", value: "100%" },
                { label: "Direct Contact", value: "Instant" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="font-display text-2xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: editorial poster composition */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block relative"
          >
            <div className="relative">
              {/* Main accent block */}
              <div className="absolute -top-6 -right-6 w-48 h-64 bg-primary/8 border-2 border-primary/15 rounded" />
              
              {/* Big editorial label */}
              <div className="relative bg-foreground text-background p-8 rounded-sm">
                <div className="text-[10px] uppercase tracking-[0.3em] text-background/50 mb-4">Now in the Directory</div>
                <div className="space-y-4">
                  {[
                    { role: "Director", name: "Available Now", score: "92" },
                    { role: "Cinematographer", name: "Available Now", score: "87" },
                    { role: "Actor", name: "Available Soon", score: "79" },
                    { role: "Producer", name: "Available Now", score: "95" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-background/10 pb-3 last:border-0 last:pb-0">
                      <div>
                        <div className="text-sm font-semibold text-background font-display">{item.role}</div>
                        <div className="text-xs text-background/50 mt-0.5">{item.name}</div>
                      </div>
                      <div className="w-9 h-9 rounded-full border-2 border-primary flex items-center justify-center">
                        <span className="text-xs font-bold text-primary font-display">{item.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-background/10">
                  <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">First Look — Est. 2025</span>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -bottom-4 -left-4 bg-primary text-primary-foreground px-4 py-3 rounded-sm shadow-lg">
                <div className="text-[10px] uppercase tracking-widest font-semibold opacity-80">Founding Members</div>
                <div className="font-display font-bold text-lg leading-none mt-1">Free PRO</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom editorial rule */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6 pb-8">
            <div className="flex-1 h-[1px] bg-border" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Scroll to Discover</span>
            <div className="flex-1 h-[1px] bg-border" />
          </div>
        </div>
      </div>
    </section>
  );
}