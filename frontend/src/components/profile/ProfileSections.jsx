import { Film, Globe, Link as LinkIcon, ExternalLink, Award, Languages, Wrench, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function AboutSection({ bio }) {
  if (!bio) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-foreground">About</h2>
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{bio}</p>
    </section>
  );
}

export function ProfessionalDetails({ profile }) {
  const details = [
    { label: "Primary Role", value: profile.primary_role },
    { label: "Secondary Roles", value: profile.secondary_roles?.join(", ") },
    { label: "Experience", value: profile.experience_level ? `${profile.experience_level} · ${profile.years_of_experience || 0}+ years` : null },
    { label: "Day Rate", value: profile.day_rate_min ? `$${profile.day_rate_min}${profile.day_rate_max ? ` – $${profile.day_rate_max}` : "+"}/day` : null },
    { label: "Willing to Work For", value: profile.willing_to_work_for?.join(", ") },
    { label: "Union Status", value: profile.union_status?.join(", ") },
    { label: "Work Authorization", value: profile.work_authorization },
    { label: "Willing to Travel", value: profile.willing_to_travel ? `Yes${profile.travel_notes ? ` — ${profile.travel_notes}` : ""}` : null },
    { label: "Pronouns", value: profile.pronouns },
  ].filter((d) => d.value);

  if (details.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-foreground">Professional Details</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {details.map((d) => (
          <div key={d.label} className="bg-secondary/30 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{d.label}</p>
            <p className="text-sm text-foreground">{d.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SkillsSection({ profile }) {
  const hasContent = profile.equipment_owned?.length > 0 || profile.special_skills?.length > 0 || profile.languages_spoken?.length > 0;
  if (!hasContent) return null;

  return (
    <section className="space-y-4">
      {profile.special_skills?.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" /> Special Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {profile.special_skills.map((s) => (
              <Badge key={s} variant="outline" className="border-border text-foreground/80 text-xs">{s}</Badge>
            ))}
          </div>
        </div>
      )}
      {profile.languages_spoken?.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <Languages className="w-3.5 h-3.5" /> Languages
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {profile.languages_spoken.map((l) => (
              <Badge key={l} variant="outline" className="border-border text-foreground/80 text-xs">{l}</Badge>
            ))}
          </div>
        </div>
      )}
      {profile.equipment_owned?.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5" /> Equipment
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {profile.equipment_owned.map((e) => (
              <Badge key={e} variant="outline" className="border-border text-foreground/80 text-xs">{e}</Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function CreditsSection({ profile }) {
  if (!profile.credits?.length && !profile.imdb_link) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">IMDb & Credits</h2>
        {profile.imdb_link && (
          <a
            href={profile.imdb_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            <Film className="w-3.5 h-3.5" /> View IMDb Profile <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {profile.credits?.length > 0 && (
        <div className="space-y-2">
          {profile.credits.slice(0, 5).map((credit, i) => (
            <div key={i} className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{credit.project_title}</p>
                <p className="text-xs text-muted-foreground">{credit.role_on_project}</p>
              </div>
              <span className="text-xs text-muted-foreground">{credit.year}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function PortfolioSection({ profile }) {
  const hasContent = profile.showreel_link || profile.website || profile.resume_url || profile.headshots?.length > 0;
  if (!hasContent) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-foreground">Portfolio & Media</h2>
      <div className="space-y-2">
        {profile.showreel_link && (
          <a href={profile.showreel_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
            <Film className="w-4 h-4" /> Watch Showreel <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {profile.website && (
          <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
            <Globe className="w-4 h-4" /> Website <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {profile.resume_url && (
          <a href={profile.resume_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
            <LinkIcon className="w-4 h-4" /> Download CV / Resume <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {profile.headshots?.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-3">
          {profile.headshots.map((url, i) => (
            <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border/40">
              <img src={url} alt={`Headshot ${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}