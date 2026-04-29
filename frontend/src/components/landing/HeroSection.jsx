import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";

function MiniProfileCard({ profile }) {
  const photoSrc = profile.profile_photo
    ? (profile.profile_photo.startsWith("/api/static/") || profile.profile_photo.startsWith("/static/")
        ? `/api${profile.profile_photo.startsWith("/static/") ? profile.profile_photo : profile.profile_photo.replace(/^\/api/, "")}`
        : profile.profile_photo)
    : null;
  const name = profile.preferred_name || profile.full_name || "—";
  const role = profile.primary_role || "Profile";
  const place = [profile.city, profile.state].filter(Boolean).join(", ");
  const isAvailableNow = profile.availability_status === "Available Now";

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border" style={{ background: "#161616" }} data-testid="hero-mini-card">
      <div className="relative aspect-[5/3] overflow-hidden" style={{ background: "#1A1A1A" }}>
        {photoSrc ? (
          <img src={photoSrc} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "#0D0D0D" }}>
            <img src="/brand/lens-only.png" alt="" aria-hidden="true" className="object-contain" style={{ width: "45%", height: "75%", opacity: 0.85 }} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {/* SpotScore badge top-right */}
        {profile.spot_score > 0 && (
          <div className="absolute top-2.5 right-2.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1" style={{ background: "rgba(0,0,0,0.65)", color: "#E6FF00" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#E6FF00" }} />
            {profile.spot_score}
          </div>
        )}
        {/* Bottom: name + role */}
        <div className="absolute bottom-0 left-0 right-0 p-3.5">
          <p className="font-display text-sm font-semibold text-white leading-tight">{name}</p>
          <p className="text-[10px] uppercase tracking-[0.08em] text-white/55 mt-0.5">{role}</p>
        </div>
      </div>
      <div className="px-3.5 py-2.5 flex items-center justify-between">
        {place ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="w-3 h-3" /> {place}
          </span>
        ) : <span />}
        {isAvailableNow && (
          <span className="text-[9px] uppercase tracking-[0.08em] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#E6FF00", color: "#0D0D0D" }}>
            Available now
          </span>
        )}
      </div>
    </div>
  );
}

export default function HeroSection() {
  const [stats, setStats] = useState({ profile_count: 0, role_count: 0 });
  const [topProfiles, setTopProfiles] = useState([]);
  const [spotlightKind, setSpotlightKind] = useState(null);  // "paid" | "admin" | "founder_fallback" | "auto"
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await base44.http.get("/api/public-stats");
        setStats(data);
      } catch { /* silent — keep zeros */ }
      try {
        // Spotlight feed: paid Elite picks first, then admin pins, then
        // founder fallbacks. Frontend just carousels whatever comes back.
        const { data } = await base44.http.get("/api/spotlight/active");
        const picks = data?.picks || [];
        if (picks.length > 0) {
          setTopProfiles(picks.slice(0, 4));
          setSpotlightKind(picks[0]?._spotlight?.kind || null);
        } else {
          // Last-ditch fallback if spotlight returns nothing.
          const top = await base44.entities.Profile.list("-spot_score", 6);
          const sorted = [...top].sort((a, b) => (b.profile_photo ? 1 : 0) - (a.profile_photo ? 1 : 0));
          setTopProfiles(sorted.slice(0, 3));
          setSpotlightKind("auto");
        }
      } catch { /* keep empty */ }
    };
    load();
  }, []);

  // Cycle the active card every 4s
  useEffect(() => {
    if (topProfiles.length < 2) return;
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % topProfiles.length);
    }, 4000);
    return () => clearInterval(id);
  }, [topProfiles.length]);

  // Label shown above the carousel — "Spot'd this month" for spotlight picks,
  // softer copy for the algorithmic fallback.
  const spotlightLabel = spotlightKind === "auto" ? "Top of the directory" : "Spot'd this month";

  const subhead = stats.profile_count
    ? `${stats.profile_count} verified cast and crew profiles. Casting calls. Direct contact. No middleman.`
    : "Verified cast and crew. Casting calls. Direct contact. No middleman.";

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-background pt-16">
      {/* Subtle electric warmth — radial gradient slightly left of centre */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 30% 50%, rgba(230, 255, 0, 0.06) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left: headline block */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-6 h-[1px] bg-primary" />
              <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-normal">
                The indie film directory
              </span>
            </div>

            <h1 className="font-display font-500 text-foreground leading-[1.0]" style={{ letterSpacing: "-1.5px" }}>
              <span className="block text-5xl sm:text-6xl lg:text-7xl">The indie film world,</span>
              <span className="block text-5xl sm:text-6xl lg:text-7xl text-primary">finally visible.</span>
            </h1>

            <p className="mt-8 text-base text-muted-foreground max-w-lg leading-[1.7]" data-testid="hero-subheadline">
              {subhead}
            </p>

            {/* CTAs — testid on the wrapping <Link> so href is testable */}
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link to="/create-profile" data-testid="hero-cta-primary">
                <Button size="lg" className="bg-primary text-primary-foreground font-semibold px-8 h-12 text-sm hover:bg-primary/90 rounded-full w-full sm:w-auto">
                  Get spot'd
                </Button>
              </Link>
              <Link to="/search" data-testid="hero-cta-secondary">
                <Button variant="outline" size="lg" className="border-border text-foreground h-12 px-8 text-sm hover:bg-secondary rounded-full w-full sm:w-auto">
                  Browse the directory
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            {/* Trust stats — live from API */}
            <div className="mt-12 grid grid-cols-3 gap-6 max-w-md" data-testid="hero-trust-stats">
              {[
                { label: "Profiles", value: stats.profile_count || 0 },
                { label: "Roles covered", value: stats.role_count || 0 },
                { label: "Direct contact", value: "Instant" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="font-display text-2xl sm:text-3xl font-semibold text-foreground" style={{ letterSpacing: "-0.5px" }}>{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: real profile cards carousel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block relative"
          >
            <div className="relative">
              {/* "Spot'd this month" eyebrow above the carousel */}
              <div className="mb-4 flex items-center gap-2" data-testid="hero-spotlight-label">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: spotlightKind === "auto" ? "rgba(255,255,255,0.4)" : "#E6FF00" }}
                />
                <span className="text-[11px] uppercase tracking-[0.18em] font-semibold" style={{ color: spotlightKind === "auto" ? "rgba(255,255,255,0.5)" : "#E6FF00" }}>
                  {spotlightLabel}
                </span>
              </div>

              {/* Subtle accent shape */}
              <div className="absolute -top-4 -right-4 w-40 h-56 border border-primary/10 rounded-lg pointer-events-none" />

              {/* Stack visual — 3 cards offset, top one cycles */}
              <div className="relative h-[420px]" data-testid="hero-cards-stack">
                {/* Phantom backdrop cards */}
                <div className="absolute top-8 left-8 right-2 h-[380px] rounded-xl border border-border/50 bg-card/40" />
                <div className="absolute top-4 left-4 right-1 h-[400px] rounded-xl border border-border/70 bg-card/70" />

                {/* Active card with crossfade */}
                <div className="absolute top-0 left-0 right-0 h-[420px]">
                  <AnimatePresence mode="wait">
                    {topProfiles.length > 0 && (
                      <motion.div
                        key={topProfiles[activeIdx]?.id || activeIdx}
                        initial={{ opacity: 0, y: 14, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -14, scale: 0.97 }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full"
                      >
                        <Link to={`/u/${topProfiles[activeIdx].profile_slug || topProfiles[activeIdx].id}`} className="block h-full">
                          <MiniProfileCard profile={topProfiles[activeIdx]} />
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Pagination dots */}
                {topProfiles.length > 1 && (
                  <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex gap-1.5" data-testid="hero-cards-dots">
                    {topProfiles.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveIdx(i)}
                        aria-label={`Show profile ${i + 1}`}
                        className="w-1.5 h-1.5 rounded-full transition-all"
                        style={{
                          background: i === activeIdx ? "#E6FF00" : "rgba(255,255,255,0.18)",
                          width: i === activeIdx ? 16 : 6,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Floating badge — keeps founding-member moment with live remaining */}
              <FoundingBadge />
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

function FoundingBadge() {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    base44.http.get("/api/public-stats")
      .then(({ data }) => setRemaining(Math.max(0, (data.founder_cap || 100) - (data.founder_count || 0))))
      .catch(() => setRemaining(null));
  }, []);
  // Hide entirely when cohort is full — landing page should never lie.
  if (remaining === 0) return null;
  return (
    <div className="absolute -bottom-12 -left-4 rounded-lg px-4 py-3 shadow-xl bg-primary z-10" data-testid="hero-founding-badge">
      <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-primary-foreground/70">
        Founding · Free PRO
      </div>
      <div className="font-display font-bold text-lg leading-none mt-1 text-primary-foreground">
        {remaining !== null ? `${remaining} spots left` : "Founding cohort"}
      </div>
    </div>
  );
}
