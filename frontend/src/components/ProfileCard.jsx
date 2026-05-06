import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Crown, CheckCircle, Film, Bookmark, Zap, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { PercentileBadge } from "./SpotScoreBreakdown";
import FoundingMemberBadge from "./FoundingMemberBadge";
import { ensureAbsoluteUrl } from "@/lib/url";

// Score dot colour based on score value
function ScoreDot({ score }) {
  const color = score >= 80 ? "#E6FF00" : score >= 55 ? "#FF5C35" : "#888";
  return (
    <div className="flex items-center gap-1" title={`SpotScore: ${score}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="font-display font-bold text-[11px]" style={{ color }}>{score}</span>
    </div>
  );
}

const TIER_BADGE = {
  pro:     { label: "PRO",     bg: "#FF5C35", color: "#fff" },
  founder: { label: "FOUNDER", bg: "#E6FF00", color: "#0D0D0D" },
  elite:   { label: "ELITE",   bg: "#E6FF00", color: "#0D0D0D" },
};

// Resolve any photo URL — includes legacy /api/static/uploads/... support.
function resolvePhoto(p) {
  if (!p) return null;
  if (p.startsWith("/api/static/")) return p;
  if (p.startsWith("/static/")) return `/api${p}`;
  return p;
}

/**
 * ProfileCard — compact directory card.
 *
 * Shows Full Name (line 1) and a Preferred-name annotation in italics + quotes
 * on line 2 only when the preferred name differs from the legal first name
 * (e.g. "Brendan Byrne" / "Brent"). Hosts a swipe carousel of profile_photo +
 * additional_photos (max 5 visible) inside the headshot frame; arrows fade
 * in on hover, dots indicate position.
 */
export default function ProfileCard({ profile, subscription, isFoundingMember, onSave, isSaved, index = 0, featured = false, spotCount }) {
  // Build the photo carousel — primary photo first, then any additional photos.
  const photos = [];
  if (profile.profile_photo) photos.push(profile.profile_photo);
  if (Array.isArray(profile.additional_photos)) {
    for (const p of profile.additional_photos) {
      if (p && !photos.includes(p)) photos.push(p);
    }
  }
  const hasCarousel = photos.length > 1;
  const [photoIdx, setPhotoIdx] = useState(0);
  const currentPhoto = photos[photoIdx];

  const advance = (e, delta) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotoIdx((i) => (i + delta + photos.length) % photos.length);
  };

  // Preferred-name annotation logic — only show if preferred ≠ first token
  // of full name. Handles whitespace + case-insensitive comparison.
  const firstName = (profile.full_name || "").trim().split(/\s+/)[0] || "";
  const preferred = (profile.preferred_name || "").trim();
  const showPreferred = preferred && preferred.toLowerCase() !== firstName.toLowerCase();

  const availabilityStyle = profile.availability_status === "Available Now"
    ? { background: "#22C55E", color: "#0D0D0D", label: "Available now" }
    : profile.availability_status === "Available Soon"
    ? { background: "#FF5C35", color: "#fff", label: "Available soon" }
    : { background: "#2A2A2A", color: "#888", label: "Unavailable" };

  const tierBadge = subscription ? TIER_BADGE[subscription.tier] : null;
  // Show the founding-member glyph when the user is flagged. Used in place of
  // the chunky "FOUNDER" pill so the headshot stays clean at small sizes.
  const showFounderGlyph = !!isFoundingMember || subscription?.tier === "founder";
  const isAvailableNow = profile.availability_status === "Available Now";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.4), duration: 0.35 }}
      data-testid={`profile-card-${profile.profile_slug || profile.id}`}
    >
      <Link to={`/profile/${profile.profile_slug || profile.id}`} className="block group">
        <div className="overflow-hidden rounded-md border border-border/60 transition-all duration-200 group-hover:border-primary/30" style={{ background: "#161616" }}>
          {/* Headshot frame — 4:5 ratio, more like a portrait card */}
          <div className="relative aspect-[4/5] overflow-hidden" style={{ background: "#1A1A1A" }}>
            {currentPhoto ? (
              <img
                key={currentPhoto}
                src={resolvePhoto(currentPhoto)}
                alt={profile.full_name}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center select-none"
                data-testid="profile-card-placeholder"
                style={{ background: "#0D0D0D" }}
              >
                <img
                  src="/brand/lens-only.png"
                  alt=""
                  aria-hidden="true"
                  className="object-contain"
                  style={{ width: "55%", height: "55%", opacity: 0.85 }}
                />
              </div>
            )}

            {/* Gradient overlay for legibility of name + role */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent pointer-events-none" />

            {/* Carousel arrows — only when 2+ photos */}
            {hasCarousel && (
              <>
                <button
                  onClick={(e) => advance(e, -1)}
                  aria-label="Previous photo"
                  data-testid="profile-card-photo-prev"
                  className="absolute top-1/2 -translate-y-1/2 left-1.5 w-6 h-6 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => advance(e, 1)}
                  aria-label="Next photo"
                  data-testid="profile-card-photo-next"
                  className="absolute top-1/2 -translate-y-1/2 right-1.5 w-6 h-6 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                {/* Dots */}
                <div className="absolute bottom-[58px] left-1/2 -translate-x-1/2 flex gap-1">
                  {photos.map((_, i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full transition-all"
                      style={{ background: i === photoIdx ? "#fff" : "rgba(255,255,255,0.35)" }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Top-left status icons — founder + available */}
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 pointer-events-none">
              {showFounderGlyph && (
                <span
                  data-testid="founder-diamond"
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold leading-none"
                  style={{ background: "#38BDF8", color: "#0D0D0D" }}
                  title="Founding Member"
                >
                  ◆
                </span>
              )}
              {isAvailableNow && (
                <span
                  data-testid="available-tick"
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: "#22C55E", color: "#0D0D0D" }}
                  title="Available now"
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              )}
            </div>

            {/* Top-right: tier (if not founder) + featured + minor + score */}
            <div className="absolute top-1.5 right-1.5 flex items-start gap-1 pointer-events-none">
              <div className="flex gap-1 flex-wrap items-center">
                {featured && (
                  <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] rounded bg-primary text-primary-foreground">
                    Featured
                  </span>
                )}
                {tierBadge && tierBadge.label !== "FOUNDER" && (
                  <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] rounded flex items-center gap-0.5" style={{ background: tierBadge.bg, color: tierBadge.color }}>
                    <Crown className="w-2 h-2" /> {tierBadge.label}
                  </span>
                )}
                {profile.is_minor_profile && (
                  <span data-testid="minor-badge" className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] rounded bg-amber-500/90 text-black">
                    Minor
                  </span>
                )}
                {profile.spot_score > 0 && (
                  <div className="px-1.5 py-0.5 rounded flex items-center" style={{ background: "rgba(0,0,0,0.65)" }}>
                    <ScoreDot score={profile.spot_score} />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom-right percentile (top-N%) — opposite the name/role */}
            {profile.spot_percentile >= 75 && (
              <div className="absolute bottom-1.5 right-1.5 pointer-events-none">
                <PercentileBadge percentile={profile.spot_percentile} compact />
              </div>
            )}

            {/* Bottom name + role overlay */}
            <div className="absolute bottom-0 left-0 right-12 p-2.5">
              <h3 className="font-display text-[13px] font-semibold text-white leading-tight tracking-tight" data-testid="profile-card-name">
                {profile.full_name || preferred}
              </h3>
              {showPreferred && (
                <p className="text-[10px] text-white/70 italic mt-0.5 leading-tight" data-testid="profile-card-preferred">
                  &ldquo;{preferred}&rdquo;
                </p>
              )}
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/55 mt-1 truncate">
                {profile._displayRole || profile.primary_role}
              </p>
            </div>
          </div>

          {/* Compact footer — city, save */}
          <div className="px-2.5 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              {profile.city ? (
                <div className="flex items-center gap-1 text-[10px] truncate" style={{ color: "#888" }}>
                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                  <span className="truncate">{profile.city}{profile.state ? `, ${profile.state}` : ""}</span>
                </div>
              ) : (
                <span />
              )}
              {profile.experience_level && (
                <span className="text-[8px] uppercase tracking-[0.05em] text-muted-foreground whitespace-nowrap">{profile.experience_level}</span>
              )}
            </div>

            <div className="flex items-center justify-between pt-0.5 gap-1">
              <div className="flex items-center gap-1.5">
                {(profile.email_verified || profile.imdb_verified) && (
                  <CheckCircle className="w-3 h-3 text-primary" title="Verified" />
                )}
                {profile.imdb_link && (
                  <span
                    role="link"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(ensureAbsoluteUrl(profile.imdb_link), "_blank", "noopener,noreferrer"); }}
                    className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold hover:opacity-80 cursor-pointer"
                    style={{ background: "#F5C518", color: "#0D0D0D" }}
                    title="View on IMDb"
                  >
                    <Film className="w-2 h-2" /> IMDb
                  </span>
                )}
                {spotCount > 0 && (
                  <div className="flex items-center gap-0.5 px-1 py-0.5 rounded" style={{ background: "rgba(255,92,53,0.15)" }} title={`${spotCount} spot${spotCount !== 1 ? "s" : ""}`}>
                    <Zap className="w-2 h-2" style={{ color: "#FF5C35" }} />
                    <span className="text-[9px] font-bold" style={{ color: "#FF5C35" }}>{spotCount}</span>
                  </div>
                )}
              </div>
              {onSave && !profile._isOwnProfile && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(profile.id); }}
                  className="w-5 h-5 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                  data-testid="profile-card-save-btn"
                  aria-label={isSaved ? "Unsave" : "Save"}
                >
                  <Bookmark className={`w-2.5 h-2.5 ${isSaved ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
