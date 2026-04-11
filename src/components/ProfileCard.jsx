import { Link } from "react-router-dom";
import { MapPin, Crown, CheckCircle, Film, Bookmark } from "lucide-react";
import { motion } from "framer-motion";

const AVAILABILITY_STYLES = {
  "Available Now": "bg-green-500/15 text-green-700 border-green-500/30",
  "Available Soon": "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  "Not Available": "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function ProfileCard({ profile, onSave, isSaved, index = 0, featured = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
    >
      <Link to={`/profile/${profile.profile_slug || profile.id}`} className="block group">
        <div className="paper-card paper-card-hover overflow-hidden">
          {/* Poster image */}
          <div className="relative aspect-[3/4] bg-secondary overflow-hidden">
            {profile.profile_photo ? (
              <img
                src={profile.profile_photo}
                alt={profile.full_name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/20 bg-secondary">
                <Film className="w-10 h-10 mb-2" />
                <span className="text-[10px] uppercase tracking-widest">No Photo</span>
              </div>
            )}

            {/* Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/10 to-transparent" />

            {/* Top badges */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
              <div className="flex gap-1.5 flex-wrap">
                {featured && (
                  <span className="bg-primary text-primary-foreground px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest">
                    Featured
                  </span>
                )}
                {profile.is_pro && (
                  <span className="bg-foreground text-background px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5" /> PRO
                  </span>
                )}
                {profile.is_founding_member && (
                  <span className="bg-foreground/80 text-background px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest">
                    Founder
                  </span>
                )}
              </div>
              {onSave && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(profile.id); }}
                  className="w-7 h-7 bg-background/90 flex items-center justify-center hover:bg-background transition-colors"
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isSaved ? "fill-primary text-primary" : "text-foreground"}`} />
                </button>
              )}
            </div>

            {/* Bottom overlay — name & role */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="font-display text-base font-bold text-background leading-tight">
                {profile.preferred_name || profile.full_name}
              </h3>
              <p className="text-primary text-xs font-semibold mt-0.5 uppercase tracking-wide">{profile.primary_role}</p>
            </div>
          </div>

          {/* Card footer */}
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              {profile.city && (
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <MapPin className="w-3 h-3" />
                  <span>{profile.city}{profile.state ? `, ${profile.state}` : ""}</span>
                </div>
              )}
              {profile.experience_level && (
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{profile.experience_level}</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              {profile.availability_status && (
                <span className={`text-[9px] uppercase tracking-widest font-semibold px-2 py-0.5 border ${AVAILABILITY_STYLES[profile.availability_status] || ""}`}>
                  {profile.availability_status === "Available Now" ? "Available" :
                   profile.availability_status === "Available Soon" ? "Soon" : "Unavailable"}
                </span>
              )}
              {profile.cine_score > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground">CS</span>
                  <span className="font-display font-bold text-sm text-foreground">{profile.cine_score}</span>
                </div>
              )}
            </div>

            {/* Verification row */}
            <div className="flex items-center gap-1.5 pt-0.5">
              {profile.email_verified && <CheckCircle className="w-3 h-3 text-green-600" title="Email Verified" />}
              {profile.phone_verified && <CheckCircle className="w-3 h-3 text-blue-600" title="Phone Verified" />}
              {profile.imdb_verified && <CheckCircle className="w-3 h-3 text-primary" title="IMDb Verified" />}
              {profile.imdb_link && <Film className="w-3 h-3 text-primary/60" title="IMDb Linked" />}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}