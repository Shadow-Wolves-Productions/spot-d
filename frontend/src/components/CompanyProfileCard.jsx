import { Link } from "react-router-dom";
import { Building2, MapPin, Users, BadgeCheck } from "lucide-react";
import { motion } from "framer-motion";
import SpotScoreBadge from "./SpotScoreBadge";
import { base44 } from "@/api/base44Client";

function resolveAsset(url) {
  if (!url) return "";
  if (url.startsWith("/static/")) return `${base44.baseURL}${url}`;
  return url;
}

const TYPE_BADGE_COLORS = {
  "Production Company":  "bg-primary/10 text-primary border-primary/20",
  "VFX Studio":          "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20",
  "Post Production":     "bg-blue-500/10 text-blue-300 border-blue-500/20",
  "Casting Agency":      "bg-orange-500/10 text-orange-300 border-orange-500/20",
};

export default function CompanyProfileCard({ company, index = 0 }) {
  if (!company) return null;
  const slug = company.company_slug || company.id;
  const typeColor = TYPE_BADGE_COLORS[company.company_type] || "bg-secondary text-muted-foreground border-border";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.35 }}
      data-testid={`company-card-${slug}`}
      className="group relative"
    >
      <Link
        to={`/c/${slug}`}
        className="block bg-card border border-border rounded-xl p-5 h-full hover:border-primary/40 transition-colors"
      >
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary border border-border flex-shrink-0 flex items-center justify-center">
            {company.logo ? (
              <img src={resolveAsset(company.logo)} alt={company.company_name} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-7 h-7 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1">
              <h3 className="font-display text-base font-semibold text-foreground truncate" data-testid={`company-name-${slug}`}>
                {company.company_name}
              </h3>
              {company.is_verified && (
                <BadgeCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              )}
            </div>
            {company.company_type && (
              <span className={`inline-block text-[10px] font-mono uppercase tracking-[0.08em] border rounded-full px-2 py-0.5 ${typeColor}`}>
                {company.company_type}
              </span>
            )}
          </div>
          <SpotScoreBadge score={company.spot_score || 0} size="sm" />
        </div>

        <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          {(company.city || company.country) && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{[company.city, company.state, company.country].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {company.team_size && (
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 flex-shrink-0" />
              <span>{company.team_size}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <span className="inline-flex items-center text-xs font-semibold text-primary group-hover:gap-1.5 transition-all gap-1">
            View company →
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
