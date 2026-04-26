import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Building2, User as UserIcon } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";

const TYPE_COLORS = {
  "Feature Film": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Short Film": "text-green-400 bg-green-500/10 border-green-500/20",
  "TV Series": "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Commercial": "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "Music Video": "text-pink-400 bg-pink-500/10 border-pink-500/20",
  "Documentary": "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

function PostedByChip({ call }) {
  const isCompany = call.posted_as === "company" && call.posted_as_company_name;
  const name = isCompany ? call.posted_as_company_name : (call.company_name || "");
  const logo = isCompany ? call.posted_as_company_logo : call.company_logo;
  if (!name && !logo) return null;
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.06em] font-mono text-muted-foreground">
      {logo ? (
        <img src={logo.startsWith("/api/static/") ? logo : logo} alt="" className="w-4 h-4 rounded object-cover border border-border flex-shrink-0" />
      ) : isCompany ? (
        <Building2 className="w-3.5 h-3.5" />
      ) : (
        <UserIcon className="w-3.5 h-3.5" />
      )}
      <span className="truncate">Posted by {name}</span>
    </div>
  );
}

export default function CastingCallsPreview() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.CastingCall.filter({ is_active: true }, "-created_date", 3);
        setCalls(data || []);
      } catch { /* keep empty */ }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <section className="py-20 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto flex justify-center h-32 items-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  // Hide section entirely when no active calls — landing should never lie.
  if (calls.length === 0) return null;

  return (
    <section className="py-20 px-4 border-t border-border" data-testid="casting-calls-preview-section">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 border-b border-border pb-4 flex items-end justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Now casting</span>
            <h2 className="font-display font-500 text-4xl sm:text-5xl text-foreground mt-1" style={{ letterSpacing: "-1px" }}>
              Latest casting calls
            </h2>
            <p className="text-sm text-muted-foreground mt-2">Real productions. Real opportunities.</p>
          </div>
          <Link to="/casting" className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Browse all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {calls.map((call, i) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.45 }}
              className="bg-card border border-border/60 rounded-xl p-6 flex flex-col hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5"
              data-testid={`landing-casting-card-${call.id}`}
            >
              <div className="mb-3">
                <PostedByChip call={call} />
              </div>

              <div className="mb-4 flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] rounded border ${TYPE_COLORS[call.project_type] || "text-muted-foreground border-border bg-secondary/40"}`}>
                  {call.project_type || "Project"}
                </span>
              </div>

              <h3 className="font-display text-xl font-semibold text-foreground leading-tight mb-2">
                {call.project_title}
              </h3>

              {call.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{call.description}</p>
              )}

              {call.roles_needed?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {call.roles_needed.slice(0, 4).map((r) => (
                    <span key={r} className="px-2 py-1 rounded-md bg-secondary/60 text-xs text-foreground">
                      {r}
                    </span>
                  ))}
                  {call.roles_needed.length > 4 && (
                    <span className="px-2 py-1 text-xs text-muted-foreground">+{call.roles_needed.length - 4}</span>
                  )}
                </div>
              )}

              <div className="mt-auto flex items-center justify-between pt-4 border-t border-border/50">
                {call.location ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" /> {call.location}
                  </span>
                ) : <span />}
                <Link to="/casting" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  View &amp; apply <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 sm:hidden">
          <Link to="/casting" className="flex items-center justify-center gap-2 text-sm font-medium text-foreground border border-border rounded-full py-3 hover:border-primary transition-colors">
            Browse all casting calls <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
