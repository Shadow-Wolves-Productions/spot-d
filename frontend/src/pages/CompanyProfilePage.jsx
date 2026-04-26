import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Building2, MapPin, Globe, Mail, Phone, Instagram, Film, Users, Calendar, BadgeCheck, ExternalLink, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SpotScoreBadge from "@/components/SpotScoreBadge";
import { ensureAbsoluteUrl, ensureMailto } from "@/lib/url";

function resolveAsset(url) {
  if (!url) return "";
  if (url.startsWith("/api/static/")) return `${base44.baseURL}${url}`;
  if (url.startsWith("/static/")) return `${base44.baseURL}/api${url}`;
  return url;
}

export default function CompanyProfilePage() {
  const { slug } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState([]);
  const [me, setMe] = useState(null);

  useEffect(() => {
    const load = async () => {
      const matches = await base44.entities.CompanyProfile.filter({ company_slug: slug });
      const c = matches[0];
      setCompany(c || null);
      if (c?.team_members?.length) {
        const ids = c.team_members.map((m) => m.profile_id).filter(Boolean);
        if (ids.length) {
          const profiles = await Promise.all(ids.map((id) => base44.entities.Profile.get(id).catch(() => null)));
          setTeam(profiles.filter(Boolean));
        }
      }
      try { setMe(await base44.auth.me()); } catch { setMe(null); }
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-32 text-center">
        <Building2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-semibold text-foreground">Company not found</h2>
        <p className="text-sm text-muted-foreground mt-2">No company at /c/{slug}</p>
        <Link to="/search" className="mt-6 inline-block text-sm text-primary hover:underline">← Back to directory</Link>
      </div>
    );
  }

  const isOwner = me && company.user_id === me.id;
  const hasCover = !!company.cover_image;

  return (
    <div className="min-h-screen pb-24">
      {/* Cover */}
      <div className="relative h-48 sm:h-64 lg:h-72 overflow-hidden">
        {hasCover ? (
          <img src={resolveAsset(company.cover_image)} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-card to-primary/5">
            <div className="absolute inset-0" style={{
              backgroundImage: "radial-gradient(circle at 20% 50%, rgba(232,252,108,0.2), transparent 50%), radial-gradient(circle at 80% 30%, rgba(255,92,53,0.15), transparent 50%)"
            }} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
        <Link to="/search" className="absolute top-4 left-4 inline-flex items-center gap-1 text-xs font-medium bg-card/80 backdrop-blur border border-border rounded-full px-3 py-1.5 text-foreground hover:bg-card transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Directory
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-12 sm:-mt-16 relative">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-card border border-border rounded-2xl p-6 sm:p-8"
          data-testid="company-profile-card"
        >
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-secondary border border-border flex-shrink-0 flex items-center justify-center -mt-16 sm:-mt-20 shadow-xl">
              {company.logo ? (
                <img src={resolveAsset(company.logo)} alt={company.company_name} className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-10 h-10 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="font-display text-3xl sm:text-4xl font-500 text-foreground" style={{ letterSpacing: "-1px" }}>
                    {company.company_name}
                    {company.is_verified && <BadgeCheck className="inline-block w-6 h-6 text-primary ml-2 align-middle" />}
                  </h1>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {company.company_type && (
                      <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                        {company.company_type}
                      </Badge>
                    )}
                    {company.team_size && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />{company.team_size}
                      </span>
                    )}
                    {company.founded_year && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />Founded {company.founded_year}
                      </span>
                    )}
                  </div>
                  {(company.city || company.country) && (
                    <p className="text-sm text-muted-foreground mt-2 inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />{[company.city, company.state, company.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <SpotScoreBadge score={company.spot_score || 0} size="md" />
                  {isOwner && (
                    <Link to="/create-company">
                      <Button variant="outline" size="sm" data-testid="edit-company-btn">Edit</Button>
                    </Link>
                  )}
                </div>
              </div>
              {company.bio && (
                <p className="text-sm text-foreground/80 leading-[1.7] mt-5">{company.bio}</p>
              )}
            </div>
          </div>

          {/* Contact strip */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {company.website && (
              <a href={ensureAbsoluteUrl(company.website)} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 hover:bg-secondary text-sm text-foreground/80 transition-colors">
                <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">Website</span>
              </a>
            )}
            {company.email && (
              <a href={ensureMailto(company.email)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 hover:bg-secondary text-sm text-foreground/80 transition-colors">
                <Mail className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{company.email}</span>
              </a>
            )}
            {company.phone && (
              <a href={`tel:${company.phone}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 hover:bg-secondary text-sm text-foreground/80 transition-colors">
                <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{company.phone}</span>
              </a>
            )}
            {company.instagram && (
              <a href={ensureAbsoluteUrl(company.instagram.startsWith("@") ? `instagram.com/${company.instagram.slice(1)}` : (company.instagram.includes("instagram.com") ? company.instagram : `instagram.com/${company.instagram}`))} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/40 hover:bg-secondary text-sm text-foreground/80 transition-colors">
                <Instagram className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{company.instagram}</span>
              </a>
            )}
          </div>
        </motion.div>

        {/* Services */}
        {company.services?.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-foreground mb-4">Services</h2>
            <div className="flex flex-wrap gap-2">
              {company.services.map((s) => (
                <Badge key={s} variant="outline" className="border-border text-foreground/80 px-3 py-1">{s}</Badge>
              ))}
            </div>
          </section>
        )}

        {/* Showreel */}
        {company.reel_link && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-foreground mb-4">Showreel</h2>
            <a href={ensureAbsoluteUrl(company.reel_link)} target="_blank" rel="noreferrer" className="block bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-3">
                <Film className="w-5 h-5 text-primary" />
                <span className="text-sm text-foreground truncate">{company.reel_link.replace(/^https?:\/\//, "").replace(/^www\./, "")}</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
              </div>
            </a>
          </section>
        )}

        {/* Past productions */}
        {company.past_productions?.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-foreground mb-4">Past productions</h2>
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {company.past_productions.map((p, i) => (
                <div key={i} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground truncate">{[p.year, p.role_on_project].filter(Boolean).join(" · ")}</p>
                  </div>
                  {p.link && (
                    <a href={ensureAbsoluteUrl(p.link)} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Team */}
        {team.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-foreground mb-4">Team</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {team.map((m) => (
                <Link key={m.id} to={`/u/${m.profile_slug || m.id}`} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition-colors">
                  <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                    {m.profile_photo && <img src={resolveAsset(m.profile_photo)} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{m.preferred_name || m.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.primary_role}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
