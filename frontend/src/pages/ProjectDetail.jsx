import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, MapPin, DollarSign, Film, Building2, User as UserIcon,
  Share2, Mail, Pencil, Trash2, ExternalLink, Eye, Bookmark,
  MessageSquare, CheckCircle2, Clock, Globe, Timer,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { usePageMeta } from "@/lib/usePageMeta";

const STAGE_STYLES = {
  "Development":          "text-slate-400  bg-slate-500/10  border-slate-500/20",
  "Packaging":            "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Financing":            "text-amber-400  bg-amber-500/10  border-amber-500/20",
  "Pre-Production":       "text-blue-400   bg-blue-500/10   border-blue-500/20",
  "Production":           "text-green-400  bg-green-500/10  border-green-500/20",
  "Post-Production":      "text-teal-400   bg-teal-500/10   border-teal-500/20",
  "Festival Run":         "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "Seeking Distribution": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Released":             "text-primary    bg-primary/10    border-primary/20",
};

const TYPE_STYLES = {
  "Feature Film":     "text-blue-400   bg-blue-500/10   border-blue-500/20",
  "Short Film":       "text-green-400  bg-green-500/10  border-green-500/20",
  "TV Series":        "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Web Series":       "text-violet-400 bg-violet-500/10 border-violet-500/20",
  "Documentary":      "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Commercial":       "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "Music Video":      "text-pink-400   bg-pink-500/10   border-pink-500/20",
  "Proof of Concept": "text-teal-400   bg-teal-500/10   border-teal-500/20",
  "Student Film":     "text-slate-400  bg-slate-500/10  border-slate-500/20",
};

const ALL_STAGES = [
  "Development", "Packaging", "Financing", "Pre-Production", "Production",
  "Post-Production", "Festival Run", "Seeking Distribution", "Released",
];

function computeCompleteness(p) {
  const checks = [
    { label: "Title",             ok: !!p.title },
    { label: "Format",            ok: !!p.project_type },
    { label: "Stage",             ok: !!p.stage },
    { label: "Genre",             ok: !!p.genre },
    { label: "Logline",           ok: !!p.logline },
    { label: "Seeking category",  ok: Array.isArray(p.seeking) && p.seeking.length > 0 },
    { label: "Poster / key art",  ok: !!p.poster_image },
    { label: "Contact role",      ok: !!p.contact_role },
  ];
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { score, missing: checks.filter((c) => !c.ok).map((c) => c.label) };
}

function StageTracker({ currentStage }) {
  const idx = ALL_STAGES.indexOf(currentStage);
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {ALL_STAGES.map((stage, i) => {
        const isPast    = i < idx;
        const isCurrent = i === idx;
        const isFuture  = i > idx;
        return (
          <div key={stage} className="flex items-center">
            <div
              className={`px-2.5 py-1 text-[9px] uppercase tracking-[0.08em] font-semibold whitespace-nowrap rounded-full border transition-all ${
                isCurrent
                  ? (STAGE_STYLES[stage] || "text-primary bg-primary/10 border-primary/20")
                  : isPast
                  ? "text-muted-foreground/50 bg-secondary/30 border-border/30"
                  : "text-muted-foreground/30 bg-transparent border-border/20"
              }`}
            >
              {stage}
            </div>
            {i < ALL_STAGES.length - 1 && (
              <div className={`w-3 h-px mx-0.5 flex-shrink-0 ${i < idx ? "bg-border/60" : "bg-border/20"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const p = await base44.entities.Project.get(id);
        setProject(p);
        try { await base44.http.post(`/api/projects/${id}/view`, {}); } catch { /* non-critical */ }
        const me = await base44.auth.me().catch(() => null);
        setUser(me);
      } catch {
        setProject(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  usePageMeta({
    title: project ? `${project.title} — Spot'd Projects` : undefined,
    description: project
      ? `${project.project_type || "Project"}${project.genre ? " · " + project.genre : ""}${project.stage ? " · " + project.stage : ""}. ${project.logline || ""}`
      : undefined,
    image: project?.poster_image || undefined,
  });

  const isOwner = user?.id === project?.creator_user_id;
  const { score: completeness, missing: missingFields } = project
    ? computeCompleteness(project)
    : { score: 0, missing: [] };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    try {
      await base44.entities.Project.delete(id);
      toast.success("Project deleted");
      navigate("/projects");
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: project.title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center px-4 text-center">
        <Film className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
        <h1 className="font-display text-3xl font-semibold text-foreground">Project not found</h1>
        <p className="text-muted-foreground mt-3">It may have been removed or the link is wrong.</p>
        <Link to="/projects">
          <Button className="mt-6 bg-primary text-primary-foreground rounded-full">Browse projects</Button>
        </Link>
      </div>
    );
  }

  const typeCls  = TYPE_STYLES[project.project_type]  || "text-muted-foreground border-border bg-secondary/40";
  const stageCls = STAGE_STYLES[project.stage] || "text-muted-foreground border-border bg-secondary/40";

  const isCompanyPost = project.posted_as === "company" && project.posted_as_company_id;
  const attributionName = isCompanyPost ? project.posted_as_company_name : project.production_company;
  const attributionLogo = isCompanyPost ? project.posted_as_company_logo : project.company_logo;
  const attributionHref = isCompanyPost && project.posted_as_company_slug
    ? `/c/${project.posted_as_company_slug}`
    : null;

  return (
    <div className="pt-24 pb-16 min-h-screen" data-testid="project-detail-page">
      {/* Back nav */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All projects
        </Link>
      </div>

      {/* ── HERO BANNER ─────────────────────────────────────────────── */}
      <div className="relative mb-8">
        {/* Banner / poster backdrop */}
        <div className="h-[240px] sm:h-[320px] relative overflow-hidden bg-card">
          {project.banner_image || project.poster_image ? (
            <img
              src={project.banner_image || project.poster_image}
              alt=""
              className="w-full h-full object-cover opacity-30"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary/40 to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>

        {/* Poster + hero content overlay */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-5 sm:gap-8 -mt-20 sm:-mt-28 relative">
            {/* Poster */}
            <div className="w-[100px] sm:w-[160px] flex-shrink-0">
              <div className="rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl bg-secondary/60 aspect-[2/3]">
                {project.poster_image ? (
                  <img src={project.poster_image} alt={project.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                )}
              </div>
            </div>

            {/* Title block */}
            <div className="flex-1 min-w-0 pt-20 sm:pt-32">
              {/* Badges row */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {project.project_type && (
                  <span className={`text-[10px] uppercase tracking-[0.08em] font-semibold px-2.5 py-1 rounded-full border ${typeCls}`}>
                    {project.project_type}
                  </span>
                )}
                {project.stage && (
                  <span className={`text-[10px] uppercase tracking-[0.08em] font-semibold px-2.5 py-1 rounded-full border ${stageCls}`}>
                    {project.stage}
                  </span>
                )}
                {project.is_verified && (
                  <span className="text-[10px] uppercase tracking-[0.08em] font-semibold px-2.5 py-1 rounded-full border text-primary bg-primary/10 border-primary/20 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>

              <h1
                className="font-display text-2xl sm:text-4xl font-bold text-foreground leading-tight"
                style={{ letterSpacing: "-0.5px" }}
                data-testid="project-title"
              >
                {project.title}
              </h1>

              {project.genre && (
                <p className="text-sm text-muted-foreground mt-1">{project.genre}</p>
              )}

              {/* Attribution */}
              {(attributionName || attributionLogo) && (
                <div className="flex items-center gap-2 mt-2">
                  {attributionLogo && (
                    <img src={attributionLogo} alt="" className="w-5 h-5 rounded object-cover border border-border" />
                  )}
                  {attributionHref ? (
                    <Link to={attributionHref} className="text-[11px] uppercase tracking-[0.06em] font-mono text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {attributionName}
                    </Link>
                  ) : (
                    <span className="text-[11px] uppercase tracking-[0.06em] font-mono text-muted-foreground inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {attributionName}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stage tracker */}
        {project.stage && (
          <div className="mb-6 overflow-x-auto">
            <StageTracker currentStage={project.stage} />
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 mb-8">
          {project.contact_role && (
            <Button
              size="sm"
              className="bg-primary text-primary-foreground rounded-full font-semibold px-5"
              onClick={() => toast.info("Contact system coming soon — use the email below for now.")}
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Contact {project.contact_role}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-border rounded-full px-5"
            onClick={handleShare}
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
          </Button>
          {isOwner && (
            <>
              <Link to={`/projects/${id}/edit`}>
                <Button size="sm" variant="outline" className="border-border rounded-full px-5">
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-full px-5"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
              </Button>
            </>
          )}
        </div>

        {/* Owner completeness card */}
        {isOwner && completeness < 100 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-card border border-white/[0.06] rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Project Completeness</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete your listing to increase visibility
                </p>
              </div>
              <span className="font-display text-2xl font-bold text-primary">{completeness}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completeness}%` }}
              />
            </div>
            {missingFields.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">Missing</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingFields.map((f) => (
                    <span key={f} className="text-[11px] px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Main content — 2-column on desktop */}
        <div className="grid lg:grid-cols-[1fr_300px] gap-8">
          {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
          <div className="space-y-8">
            {/* Seeking tags */}
            {(project.seeking || []).length > 0 && (
              <section>
                <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-muted-foreground mb-3">Currently Seeking</p>
                <div className="flex flex-wrap gap-2">
                  {project.seeking.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Logline */}
            {project.logline && (
              <section data-testid="project-logline">
                <h2 className="font-display text-lg font-semibold text-foreground mb-2">Logline</h2>
                <p className="text-muted-foreground leading-[1.8] italic text-base">
                  "{project.logline}"
                </p>
              </section>
            )}

            {/* Synopsis */}
            {project.synopsis && (
              <section data-testid="project-synopsis">
                <h2 className="font-display text-lg font-semibold text-foreground mb-2">Synopsis</h2>
                <p className="text-muted-foreground leading-[1.8] whitespace-pre-wrap">
                  {project.synopsis}
                </p>
              </section>
            )}

            {/* Director Statement */}
            {project.director_statement && (
              <section>
                <h2 className="font-display text-lg font-semibold text-foreground mb-2">Director's Statement</h2>
                <p className="text-muted-foreground leading-[1.8] whitespace-pre-wrap">
                  {project.director_statement}
                </p>
              </section>
            )}

            {/* Production Notes */}
            {project.production_notes && (
              <section>
                <h2 className="font-display text-lg font-semibold text-foreground mb-2">Production Notes</h2>
                <p className="text-muted-foreground leading-[1.8] whitespace-pre-wrap">
                  {project.production_notes}
                </p>
              </section>
            )}

            {/* Trailer */}
            {project.trailer_url && (
              <section>
                <h2 className="font-display text-lg font-semibold text-foreground mb-3">Trailer</h2>
                <a
                  href={project.trailer_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground hover:border-primary/30 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  Watch trailer
                </a>
              </section>
            )}
          </div>

          {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Project details card */}
            <div className="bg-card border border-white/[0.06] rounded-xl p-5 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-muted-foreground mb-1">Project Details</p>
              {[
                { icon: Building2, label: "Production Co.",  value: project.production_company },
                { icon: UserIcon,  label: "Director",        value: project.director_name },
                { icon: MapPin,    label: "Location",        value: project.filming_location || project.country },
                { icon: DollarSign,label: "Budget",          value: project.budget_range },
                { icon: Timer,     label: "Runtime",         value: project.runtime },
                { icon: Globe,     label: "Language",        value: project.language },
                { icon: Clock,     label: "Festival Status", value: project.festival_status },
              ].filter((r) => r.value).map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3 text-sm">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground/60">{label}</p>
                    <p className="text-foreground">{value}</p>
                  </div>
                </div>
              ))}
              {project.imdb_link && (
                <a
                  href={project.imdb_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
                >
                  <ExternalLink className="w-3 h-3" /> IMDb
                </a>
              )}
            </div>

            {/* Release goals */}
            {project.release_goals && (
              <div className="bg-card border border-white/[0.06] rounded-xl p-5">
                <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-muted-foreground mb-2">Release Goals</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{project.release_goals}</p>
              </div>
            )}

            {/* Attachments */}
            {project.pitch_deck_url && (
              <div className="bg-card border border-white/[0.06] rounded-xl p-5">
                <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-muted-foreground mb-3">Attachments</p>
                <a
                  href={project.pitch_deck_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Pitch Deck
                </a>
              </div>
            )}

            {/* Analytics (owner only) */}
            {isOwner && (
              <div className="bg-card border border-white/[0.06] rounded-xl p-5">
                <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-muted-foreground mb-3">Analytics</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Eye,         label: "Views",    value: project.view_count    || 0 },
                    { icon: Bookmark,    label: "Saves",    value: project.save_count    || 0 },
                    { icon: MessageSquare, label: "Inquiries", value: project.inquiry_count || 0 },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="text-center p-2.5 rounded-lg bg-secondary/40">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground/60 mx-auto mb-1" />
                      <p className="font-display text-lg font-bold text-foreground">{value}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer meta */}
        <div className="text-[11px] uppercase tracking-[0.06em] font-mono text-muted-foreground/40 mt-12 pt-6 border-t border-border/40">
          {project.view_count > 0 && <>{project.view_count} view{project.view_count !== 1 ? "s" : ""} · </>}
          Listed {project.created_date ? new Date(project.created_date).toLocaleDateString() : "recently"}
          {project.updated_date && project.updated_date !== project.created_date && (
            <> · Updated {new Date(project.updated_date).toLocaleDateString()}</>
          )}
        </div>
      </div>
    </div>
  );
}
