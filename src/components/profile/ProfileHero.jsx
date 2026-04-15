import { MapPin, Crown, CheckCircle, Film, Clock, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SpotScoreBadge from "../SpotScoreBadge";

const AVAILABILITY_STYLES = {
  "Available Now": "text-black border-0",
  "Available Soon": "text-white border-0",
  "Not Available": "text-white border-0",
};
const AVAILABILITY_BG = {
  "Available Now": "#22C55E",
  "Available Soon": "#FF5C35",
  "Not Available": "#444",
};

export default function ProfileHero({ profile }) {
  return (
    <div className="relative pt-20">
      {/* Background */}
      <div className="absolute inset-0 h-[400px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background/95 to-background" />
        <div className="absolute top-0 left-1/3 w-[500px] h-[300px] bg-primary/8 blur-[100px] rounded-full" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Photo */}
          <div className="relative flex-shrink-0">
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden border-2 border-border/60 shadow-2xl shadow-black/30">
              {profile.profile_photo ? (
                <img src={profile.profile_photo} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-secondary flex items-center justify-center">
                  <Film className="w-12 h-12 text-muted-foreground/30" />
                </div>
              )}
            </div>
            {profile.is_pro && (
              <div className="absolute -bottom-2 -right-2 px-2.5 py-1 rounded-full flex items-center gap-1 bg-primary">
                <Crown className="w-3.5 h-3.5 text-primary-foreground" />
                <span className="text-[10px] font-bold text-primary-foreground uppercase tracking-[0.08em]">PRO</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {profile.is_founding_member && (
                <Badge variant="outline" className="border-primary/30 text-primary text-[10px] uppercase tracking-wider">
                  Founding Member
                </Badge>
              )}
              {profile.is_boosted && (
                <Badge variant="outline" className="border-primary/20 text-primary/80 text-[10px]">Featured</Badge>
              )}
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
              {profile.full_name}
            </h1>
            {profile.preferred_name && profile.preferred_name !== profile.full_name && (
              <p className="text-muted-foreground text-sm mt-1">"{profile.preferred_name}"</p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="text-primary font-semibold text-lg">{profile.primary_role}</span>
              {profile.secondary_roles?.length > 0 && (
                <div className="flex gap-1.5">
                  {profile.secondary_roles.slice(0, 3).map((r) => (
                    <Badge key={r} variant="outline" className="border-border text-muted-foreground text-xs">{r}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
              {profile.city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {profile.city}{profile.state ? `, ${profile.state}` : ""}{profile.country ? `, ${profile.country}` : ""}
                </span>
              )}
              {profile.experience_level && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  {profile.experience_level} · {profile.years_of_experience || 0}+ years
                </span>
              )}
              {profile.availability_status && (
                <Badge
                  variant="outline"
                  className={AVAILABILITY_STYLES[profile.availability_status]}
                  style={{ background: AVAILABILITY_BG[profile.availability_status] }}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  {profile.availability_status}
                </Badge>
              )}
            </div>

            {/* Verification icons */}
            <div className="flex items-center gap-2 mt-4">
              {profile.email_verified && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" /> Email
                </span>
              )}
              {profile.phone_verified && (
                <span className="flex items-center gap-1 text-xs text-blue-400">
                  <CheckCircle className="w-3.5 h-3.5" /> Phone
                </span>
              )}
              {profile.imdb_verified && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <CheckCircle className="w-3.5 h-3.5" /> IMDb
                </span>
              )}
              {profile.union_verified && (
                <span className="flex items-center gap-1 text-xs text-purple-400">
                  <CheckCircle className="w-3.5 h-3.5" /> Union
                </span>
              )}
            </div>
          </div>

          {/* SpotScore */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <SpotScoreBadge score={profile.spot_score || 0} size="lg" />
            <span className="text-[10px] uppercase tracking-[0.08em] font-mono text-muted-foreground">SpotScore</span>
          </div>
        </div>
      </div>
    </div>
  );
}