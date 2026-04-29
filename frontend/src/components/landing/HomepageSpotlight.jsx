import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ensureAbsoluteUrl } from "@/lib/url";

/**
 * Landing-page Spotlight — surfaces the single highest-SpotScore non-founder
 * non-minor profile of the month. The "Spotlight" slot is the headline perk
 * for Elite tier: this is the hero rotation feature promised on /pricing.
 *
 * If no qualifying profile exists, render nothing (keeps the page clean
 * during cold-start).
 */
export default function HomepageSpotlight() {
  const [pick, setPick] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Pull the top by SpotScore — keep the request small.
        const top = await base44.entities.Profile.list("-spot_score", 25);

        // Founder user-ids (we exclude founders since founder cards already
        // get prominence elsewhere; the spotlight is meant to give *fresh*
        // visibility to the next wave of high-quality talent).
        let founderIds = new Set();
        try {
          const subs = await base44.entities.Subscription.filter(
            { tier: "founder", status: "active" }, "-created_date", 200
          );
          founderIds = new Set((subs || []).map((s) => s.user_id));
        } catch { /* non-critical */ }

        const candidate = (top || []).find(
          (p) => !p.is_minor_profile && !p.is_hidden && !founderIds.has(p.user_id)
            && (p.spot_score || 0) >= 30
        );
        if (!cancelled) setPick(candidate || null);
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!pick) return null;

  const photo = pick.profile_photo ? ensureAbsoluteUrl(pick.profile_photo) : null;
  const role = pick.primary_role || "Creator";
  const location = [pick.city, pick.state].filter(Boolean).join(", ");

  return (
    <section className="py-16 sm:py-20 px-4 border-y border-border bg-secondary/20" data-testid="homepage-spotlight">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">Spot'd this month</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center"
        >
          <Link
            to={pick.profile_slug ? `/u/${pick.profile_slug}` : `/profile/${pick.id}`}
            className="block group"
            data-testid="spotlight-profile-link"
          >
            <div className="aspect-[4/5] w-full rounded-2xl overflow-hidden border border-border bg-secondary relative">
              {photo ? (
                <img
                  src={photo}
                  alt={pick.full_name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[140px] font-bold text-primary/30">
                  '
                </div>
              )}
              <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider">
                Spot'd this month
              </div>
            </div>
          </Link>

          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
              SpotScore {pick.spot_score}/100
            </div>
            <h2
              className="font-display font-bold text-foreground text-4xl sm:text-5xl md:text-6xl leading-[1.05]"
              style={{ letterSpacing: "-1.5px" }}
              data-testid="spotlight-name"
            >
              {pick.full_name}
            </h2>
            <p className="text-primary text-lg sm:text-xl font-semibold mt-3">
              {role}
              {pick.experience_level ? ` · ${pick.experience_level}` : ""}
            </p>
            {location && (
              <p className="text-muted-foreground text-base mt-1">{location}</p>
            )}
            {pick.bio && (
              <p className="text-muted-foreground text-base mt-6 leading-relaxed line-clamp-4 max-w-xl">
                {pick.bio}
              </p>
            )}
            <Link
              to={pick.profile_slug ? `/u/${pick.profile_slug}` : `/profile/${pick.id}`}
              className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              data-testid="spotlight-cta"
            >
              See the full profile <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
