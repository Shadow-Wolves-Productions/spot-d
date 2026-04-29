import { MapPin, Crown, CheckCircle, Film, Clock, Briefcase, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import SpotScoreBadge from "../SpotScoreBadge";
import FoundingMemberBadge from "../FoundingMemberBadge";
import { ensureAbsoluteUrl } from "@/lib/url";

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

async function trackImdbClick(profile) {
  try {
    await base44.entities.PortfolioClick.create({ profile_id: profile.id, asset_type: "imdb" });
  } catch (_) {}
}

export default function ProfileHero({ profile, subscription }) {
  return (
    <div className="relative pt-20">
      {/* Background */}
      <div className="absolute inset-0 h-[400px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background/95 to-background" />
        <div className="absolute top-0 left-1/3 w-[500px] h-[300px] bg-primary/8 blur-[100px] rounded-full" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          {/* Photo — full width on mobile, fixed size on desktop */}
          <div className="relative w-full lg:w-auto lg:flex-shrink-0">
            <div className="w-full lg:w-56 aspect-[4/5] sm:aspect-[3/4] lg:aspect-auto lg:h-72 rounded-xl lg:rounded-2xl overflow-hidden border-2 border-border/60 shadow-2xl shadow-black/30">
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
              <FoundingMemberBadge tier={subscription?.tier} />
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

            {/* IMDb button */}
            {profile.imdb_link && (
              <div className="mt-4">
                <a
                  href={ensureAbsoluteUrl(profile.imdb_link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackImdbClick(profile)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
                  style={{ background: "#F5C518", color: "#0D0D0D" }}
                >
                  <Film className="w-4 h-4" />
                  View on IMDb
                  {profile.imdb_verified && <CheckCircle className="w-3.5 h-3.5" />}
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </div>
            )}

            {/* Unified verification badge */}
            {(profile.email_verified || profile.phone_verified || profile.imdb_verified || profile.union_verified) && (
              <div className="flex items-center gap-1.5 mt-4">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Verified</span>
              </div>
            )}
          </div>

          {/* SpotScore — full width on mobile, sidebar card on desktop */}
          <div className="w-full lg:w-auto lg:flex-shrink-0 flex flex-col items-center gap-2">
            <div className="w-full lg:w-auto flex flex-row lg:flex-col items-center justify-center gap-4 rounded-2xl border border-primary/30 px-6 py-5" style={{ background: "rgba(230,255,0,0.06)", minWidth: 100 }} data-testid="profile-hero-spotscore">
              <span className="font-display font-bold text-primary" style={{ fontSize: 52, lineHeight: 1, color: "hsl(var(--primary))" }}>
                {profile.spot_score || 0}
              </span>
              <span className="text-[10px] uppercase tracking-[0.12em] font-mono text-muted-foreground lg:mt-1">SpotScore</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}