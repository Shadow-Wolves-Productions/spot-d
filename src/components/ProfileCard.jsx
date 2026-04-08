import { Link } from "react-router-dom";
import { MapPin, Crown, CheckCircle, Film, Bookmark, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CineScoreBadge from "./CineScoreBadge";
import { motion } from "framer-motion";

const AVAILABILITY_STYLES = {
  "Available Now": "bg-green-500/20 text-green-400 border-green-500/30",
  "Available Soon": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Not Available": "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function ProfileCard({ profile, onSave, isSaved, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Link to={`/profile/${profile.id}`}>
        <div className="group relative bg-card border border-border/60 rounded-xl overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
          {/* Image */}
          <div className="relative aspect-[3/4] bg-secondary overflow-hidden">
            {profile.profile_photo ? (
              <img
                src={profile.profile_photo}
                alt={profile.full_name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                <Film className="w-16 h-16" />
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

            {/* Top badges */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
              <div className="flex gap-1.5">
                {profile.is_pro && (
                  <span className="glass-gold px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                    <Crown className="w-3 h-3" /> PRO
                  </span>
                )}
                {profile.is_founding_member && (
                  <span className="glass-effect px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Founder
                  </span>
                )}
              </div>
              {onSave && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSave(profile.id);
                  }}
                  className="w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-card transition-colors"
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>
              )}
            </div>

            {/* Bottom info overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="font-display text-lg font-semibold text-foreground leading-tight">
                {profile.preferred_name || profile.full_name}
              </h3>
              <p className="text-primary text-sm font-medium mt-0.5">{profile.primary_role}</p>
            </div>
          </div>

          {/* Details */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              {profile.city && (
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <MapPin className="w-3 h-3" />
                  <span>{profile.city}{profile.state ? `, ${profile.state}` : ""}</span>
                </div>
              )}
              {profile.experience_level && (
                <span className="text-xs text-muted-foreground">{profile.experience_level}</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {profile.availability_status && (
                  <Badge variant="outline" className={`text-[10px] ${AVAILABILITY_STYLES[profile.availability_status] || ""}`}>
                    <Clock className="w-3 h-3 mr-1" />
                    {profile.availability_status}
                  </Badge>
                )}
              </div>
              <CineScoreBadge score={profile.cine_score} size="sm" showLabel={false} />
            </div>

            {/* Verification icons */}
            <div className="flex items-center gap-1.5">
              {profile.email_verified && <CheckCircle className="w-3.5 h-3.5 text-green-400" title="Email Verified" />}
              {profile.phone_verified && <CheckCircle className="w-3.5 h-3.5 text-blue-400" title="Phone Verified" />}
              {profile.imdb_verified && <CheckCircle className="w-3.5 h-3.5 text-primary" title="IMDb Verified" />}
              {profile.imdb_link && <Film className="w-3.5 h-3.5 text-primary/60" title="IMDb Linked" />}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}