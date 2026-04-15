import { Link } from "react-router-dom";
import { MapPin, Crown, CheckCircle, Film, Bookmark } from "lucide-react";
import { motion } from "framer-motion";

export default function ProfileCard({ profile, onSave, isSaved, index = 0, featured = false }) {
  const availabilityStyle = profile.availability_status === "Available Now"
    ? { background: "#E8FF47", color: "#000", label: "Available now" }
    : profile.availability_status === "Available Soon"
    ? { background: "#534AB7", color: "#fff", label: "Available soon" }
    : { background: "#333", color: "#888", label: "Unavailable" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
    >
      <Link to={`/profile/${profile.profile_slug || profile.id}`} className="block group">
        <div className="overflow-hidden rounded-lg border border-border transition-all duration-200 group-hover:border-primary/30" style={{ background: "#161616" }}>
          {/* Poster image */}
          <div className="relative aspect-[3/4] overflow-hidden" style={{ background: "#111" }}>
            {profile.profile_photo ? (
              <img
                src={profile.profile_photo}
                alt={profile.full_name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center" style={{ color: "#333" }}>
                <Film className="w-10 h-10 mb-2" />
                <span className="text-[10px] uppercase tracking-[0.08em]">No photo</span>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

            {/* Top badges */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
              <div className="flex gap-1.5 flex-wrap">
                {featured && (
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded" style={{ background: "#E8FF47", color: "#000" }}>
                    Featured
                  </span>
                )}
                {profile.is_pro && (
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded flex items-center gap-1" style={{ background: "#E8FF47", color: "#000" }}>
                    <Crown className="w-2.5 h-2.5" /> PRO
                  </span>
                )}
                {profile.is_founding_member && (
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded" style={{ background: "#534AB7", color: "#fff" }}>
                    Founder
                  </span>
                )}
              </div>
              {onSave && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(profile.id); }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: "rgba(0,0,0,0.6)" }}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isSaved ? "fill-primary text-primary" : "text-white"}`} />
                </button>
              )}
            </div>

            {/* Hover CTA */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <span className="px-4 py-2 rounded-full text-xs font-semibold" style={{ background: "#E8FF47", color: "#000" }}>
                Spot this person
              </span>
            </div>

            {/* Bottom name + role */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="font-display text-base font-semibold text-white leading-tight" style={{ letterSpacing: "-0.3px" }}>
                {profile.preferred_name || profile.full_name}
              </h3>
              <p className="text-[10px] uppercase tracking-[0.08em] text-white/50 mt-0.5">{profile.primary_role}</p>
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
              {profile.spot_score > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] uppercase tracking-[0.08em]" style={{ color: "#888" }}>Spot Score</span>
                  <span className="font-display font-semibold text-sm" style={{ color: "#E8FF47" }}>{profile.spot_score}</span>
                </div>
              )}
            </div>

            {/* Verification row */}
            <div className="flex items-center gap-1.5 pt-0.5">
              {profile.email_verified && <CheckCircle className="w-3 h-3 text-green-500" title="Email verified" />}
              {profile.phone_verified && <CheckCircle className="w-3 h-3" style={{ color: "#534AB7" }} title="Phone verified" />}
              {profile.imdb_verified && <CheckCircle className="w-3 h-3 text-primary" title="IMDb verified" />}
              {profile.imdb_link && <Film className="w-3 h-3 text-primary/50" title="IMDb linked" />}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}