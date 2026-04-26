import { Link } from "react-router-dom";
import { MapPin, Crown, CheckCircle, Film, Bookmark, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { PercentileBadge } from "./SpotScoreBreakdown";
import { ensureAbsoluteUrl } from "@/lib/url";

// Score dot colour based on score value
function ScoreDot({ score }) {
  const color = score >= 80 ? "#E8FC6C" : score >= 55 ? "#FF5C35" : "#888";
  return (
    <div className="flex items-center gap-1" title={`SpotScore: ${score}`}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="font-display font-bold text-sm" style={{ color }}>{score}</span>
    </div>
  );
}

const TIER_BADGE = {
  pro:     { label: "PRO",     bg: "#FF5C35", color: "#fff" },
  founder: { label: "FOUNDER", bg: "#E8FC6C", color: "#0D0D0D" },
  elite:   { label: "ELITE",   bg: "#E8FC6C", color: "#0D0D0D" },
};

export default function ProfileCard({ profile, subscription, onSave, isSaved, index = 0, featured = false, spotCount }) {
  const availabilityStyle = profile.availability_status === "Available Now"
    ? { background: "#E8FC6C", color: "#0D0D0D", label: "Available now" }
    : profile.availability_status === "Available Soon"
    ? { background: "#FF5C35", color: "#fff", label: "Available soon" }
    : { background: "#2A2A2A", color: "#888", label: "Unavailable" };

  const tierBadge = subscription ? TIER_BADGE[subscription.tier] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
      data-testid={`profile-card-${profile.profile_slug || profile.id}`}
    >
      <Link to={`/profile/${profile.profile_slug || profile.id}`} className="block group">
        <div className="overflow-hidden rounded-lg border border-border transition-all duration-200 group-hover:border-primary/30" style={{ background: "#161616" }}>
          {/* Poster image */}
          <div className="relative aspect-[3/4] overflow-hidden" style={{ background: "#1A1A1A" }}>
            {profile.profile_photo ? (
              <img
                src={profile.profile_photo?.startsWith("/api/static/") || profile.profile_photo?.startsWith("/static/") ? `/api${profile.profile_photo.startsWith("/static/") ? profile.profile_photo : profile.profile_photo.replace(/^\/api/, "")}` : profile.profile_photo}
                alt={profile.full_name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              // Branded placeholder — Spot'd electric apostrophe at 30% opacity.
              // Replaces the generic film-frame icon for a cohesive directory grid.
              <div className="w-full h-full flex items-center justify-center select-none" data-testid="profile-card-placeholder" style={{ containerType: "size" }}>
                <span
                  className="font-display font-bold leading-none"
                  style={{
                    color: "#E8FC6C",
                    opacity: 0.3,
                    fontSize: "min(60cqw, 80cqh)",
                    lineHeight: 0.7,
                    letterSpacing: "-0.05em",
                    transform: "translateY(8%)",
                  }}
                  aria-hidden="true"
                >
                  '
                </span>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

            {/* Top badges */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
              <div className="flex gap-1.5 flex-wrap">
                {featured && (
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded bg-primary text-primary-foreground">
                    Featured
                  </span>
                )}
                {tierBadge && (
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded flex items-center gap-1" style={{ background: tierBadge.bg, color: tierBadge.color }}>
                    <Crown className="w-2.5 h-2.5" /> {tierBadge.label}
                  </span>
                )}
                {profile.is_minor_profile && (
                  <span data-testid="minor-badge" className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded bg-amber-500/90 text-black" title="Performer under 18">
                    Minor
                  </span>
                )}
              </div>
              {/* SpotScore dot in top-right of headshot */}
              {profile.spot_score > 0 && (
                <div className="px-1.5 py-0.5 rounded-md flex items-center gap-1" style={{ background: "rgba(0,0,0,0.65)" }}>
                  <ScoreDot score={profile.spot_score} />
                </div>
              )}
            </div>

            {/* Hover CTA */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="px-4 py-2 rounded-full text-xs font-semibold bg-primary text-primary-foreground">
                Spot this person
              </span>
            </div>

            {/* Bottom name + role */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="font-display text-base font-semibold text-white leading-tight" style={{ letterSpacing: "-0.3px" }}>
                {profile.preferred_name || profile.full_name}
              </h3>
              <p className="text-[10px] uppercase tracking-[0.08em] text-white/50 mt-0.5">
                {profile._displayRole || profile.primary_role}
                {profile._otherRoles && profile._otherRoles.length > 0 && (
                  <span className="text-white/35 normal-case tracking-normal"> · Also: {profile._otherRoles.slice(0, 2).join(", ")}{profile._otherRoles.length > 2 ? "…" : ""}</span>
                )}
              </p>
            </div>
          </div>

          {/* Card footer */}
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              {profile.city && (
                <div className="flex items-center gap-1 text-xs" style={{ color: "#888" }}>
                  <MapPin className="w-3 h-3" />
                  <span>{profile.city}{profile.state ? `, ${profile.state}` : ""}</span>
                </div>
              )}
              {profile.experience_level && (
                <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "#888" }}>{profile.experience_level}</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              {profile.availability_status && (
                <span className="text-[9px] uppercase tracking-[0.08em] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: availabilityStyle.background, color: availabilityStyle.color }}>
                  {availabilityStyle.label}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                {spotCount > 0 && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "rgba(255,92,53,0.15)" }} title={`${spotCount} spot${spotCount !== 1 ? "s" : ""}`}>
                    <Zap className="w-2.5 h-2.5" style={{ color: "#FF5C35" }} />
                    <span className="text-[10px] font-bold" style={{ color: "#FF5C35" }}>{spotCount}</span>
                  </div>
                )}
                {profile.spot_percentile >= 75 && (
                  <PercentileBadge percentile={profile.spot_percentile} />
                )}
              </div>
            </div>

            {/* Bottom row: bookmark + verified + imdb */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-2">
                {(profile.email_verified || profile.phone_verified || profile.imdb_verified || profile.union_verified) && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-primary" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-primary">Verified</span>
                  </div>
                )}
                {profile.imdb_link && (
                  <span
                    role="link"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(ensureAbsoluteUrl(profile.imdb_link), "_blank", "noopener,noreferrer"); }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold hover:opacity-80 transition-opacity cursor-pointer"
                    style={{ background: "#F5C518", color: "#0D0D0D" }}
                    title="View on IMDb"
                  >
                    <Film className="w-2.5 h-2.5" /> IMDb
                  </span>
                )}
              </div>
              {onSave && !profile._isOwnProfile && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(profile.id); }}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <Bookmark className={`w-3 h-3 ${isSaved ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}