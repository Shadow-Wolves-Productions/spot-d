import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { Plus, MapPin, DollarSign, Search, SlidersHorizontal, Film, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { usePullToRefresh } from "../hooks/usePullToRefresh";

const PROJECT_TYPES = [
  "Feature Film", "Short Film", "TV Series", "Web Series",
  "Documentary", "Commercial", "Music Video", "Proof of Concept", "Student Film",
];

const PROJECT_STAGES = [
  "Development", "Packaging", "Financing", "Pre-Production", "Production",
  "Post-Production", "Festival Run", "Seeking Distribution", "Released",
];

const SEEKING_OPTIONS = [
  "Seeking Cast", "Seeking Crew", "Seeking Producers", "Seeking Investors",
  "Seeking Distribution", "Seeking Sales Agent", "Seeking Composer",
  "Seeking Post House", "Seeking Finishing Funds", "Seeking Sponsors",
  "Seeking Locations", "Seeking Brand Partnerships",
];

const STAGE_STYLES = {
  "Development":         "text-slate-400  bg-slate-500/10  border-slate-500/20",
  "Packaging":           "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Financing":           "text-amber-400  bg-amber-500/10  border-amber-500/20",
  "Pre-Production":      "text-blue-400   bg-blue-500/10   border-blue-500/20",
  "Production":          "text-green-400  bg-green-500/10  border-green-500/20",
  "Post-Production":     "text-teal-400   bg-teal-500/10   border-teal-500/20",
  "Festival Run":        "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "Seeking Distribution":"text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Released":            "text-primary    bg-primary/10    border-primary/20",
};

const TYPE_STYLES = {
  "Feature Film":      "text-blue-400   bg-blue-500/10   border-blue-500/20",
  "Short Film":        "text-green-400  bg-green-500/10  border-green-500/20",
  "TV Series":         "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Web Series":        "text-violet-400 bg-violet-500/10 border-violet-500/20",
  "Documentary":       "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Commercial":        "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "Music Video":       "text-pink-400   bg-pink-500/10   border-pink-500/20",
  "Proof of Concept":  "text-teal-400   bg-teal-500/10   border-teal-500/20",
  "Student Film":      "text-slate-400  bg-slate-500/10  border-slate-500/20",
};

function computeCompleteness(p) {
  const checks = [
    !!p.title,
    !!p.project_type,
    !!p.stage,
    !!p.genre,
    !!p.logline,
    Array.isArray(p.seeking) && p.seeking.length > 0,
    !!p.poster_image,
    !!p.contact_role,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function ProjectCard({ project, index, isOwner }) {
  const navigate = useNavigate();
  const stageCls = STAGE_STYLES[project.stage] || "text-muted-foreground border-border bg-secondary/40";
  const typeCls  = TYPE_STYLES[project.project_type] || "text-muted-foreground border-border bg-secondary/40";
  const seekingTags = (project.seeking || []).slice(0, 3);
  const completeness = isOwner ? computeCompleteness(project) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.28 }}
      className="group bg-card border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.12] transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-black/30"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="flex gap-0">
        {/* Poster thumbnail */}
        <div className="w-[88px] sm:w-[110px] flex-shrink-0 bg-secondary/40 relative overflow-hidden">
          {project.poster_image ? (
            <img
              src={project.poster_image}
              alt={project.title}
              className="w-full h-full object-cover absolute inset-0"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Film className="w-6 h-6 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card/20" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-4 sm:p-5">
          {/* Top row — type + stage */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {project.project_type && (
              <span className={`text-[10px] uppercase tracking-[0.07em] font-semibold px-2 py-0.5 rounded-full border ${typeCls}`}>
                {project.project_type}
              </span>
            )}
            {project.stage && (
              <span className={`text-[10px] uppercase tracking-[0.07em] font-semibold px-2 py-0.5 rounded-full border ${stageCls}`}>
                {project.stage}
              </span>
            )}
            {project.is_verified && (
              <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" title="Verified project" />
            )}
          </div>

          {/* Title + genre */}
          <h3 className="font-display text-base sm:text-lg font-semibold text-foreground leading-tight mb-0.5">
            {project.title}
          </h3>
          {project.genre && (
            <p className="text-[11px] text-muted-foreground/70 mb-2">{project.genre}</p>
          )}

          {/* Logline */}
          {project.logline && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
              {project.logline}
            </p>
          )}

          {/* Seeking tags */}
          {seekingTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {seekingTags.map((tag) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-secondary/50 text-muted-foreground">
                  {tag}
                </span>
              ))}
              {(project.seeking || []).length > 3 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-secondary/50 text-muted-foreground">
                  +{project.seeking.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-muted-foreground/60">
            {(project.filming_location || project.country) && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {project.filming_location || project.country}
              </span>
            )}
            {project.budget_range && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {project.budget_range}
              </span>
            )}
            {project.production_company && (
              <span className="font-mono">{project.production_company}</span>
            )}
            {project.view_count > 0 && (
              <span>{project.view_count} view{project.view_count !== 1 ? "s" : ""}</span>
            )}
          </div>

          {/* Owner completeness bar */}
          {isOwner && completeness !== null && completeness < 100 && (
            <div className="mt-3 pt-3 border-t border-border/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground/60">Completeness</span>
                <span className="text-[10px] font-mono text-muted-foreground/60">{completeness}%</span>
              </div>
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{ width: `${completeness}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [filterSeeking, setFilterSeeking] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("newest");

  const load = useCallback(async () => {
    setLoading(true);
    const isAuth = await base44.auth.isAuthenticated();
    if (isAuth) {
      const me = await base44.auth.me();
      setUser(me);
    }
    const data = await base44.entities.Project.list("-created_date", 200);
    setProjects(data.filter((p) => p.is_published !== false));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const { pullY, refreshing } = usePullToRefresh(load);

  const sorted = [...projects].sort((a, b) => {
    if (sortBy === "views")   return (b.view_count || 0) - (a.view_count || 0);
    if (sortBy === "saves")   return (b.save_count || 0) - (a.save_count || 0);
    return new Date(b.created_date || 0) - new Date(a.created_date || 0);
  });

  const filtered = sorted.filter((p) => {
    if (filterType !== "all" && p.project_type !== filterType) return false;
    if (filterStage !== "all" && p.stage !== filterStage) return false;
    if (filterSeeking !== "all" && !(p.seeking || []).includes(filterSeeking)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (p.title || "").toLowerCase().includes(q) ||
        (p.logline || "").toLowerCase().includes(q) ||
        (p.production_company || "").toLowerCase().includes(q) ||
        (p.genre || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeFilters = [
    filterType !== "all" && filterType,
    filterStage !== "all" && filterStage,
    filterSeeking !== "all" && filterSeeking,
  ].filter(Boolean);

  const clearFilter = (f) => {
    if (f === filterType) setFilterType("all");
    else if (f === filterStage) setFilterStage("all");
    else if (f === filterSeeking) setFilterSeeking("all");
  };

  return (
    <div className="min-h-screen pt-20">
      {(pullY > 0 || refreshing) && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center w-9 h-9 bg-card border border-border rounded-full shadow-md"
          style={{ transform: `translateX(-50%) translateY(${Math.min(pullY, 56)}px)` }}
        >
          <div
            className={`w-4 h-4 border-2 border-primary border-t-transparent rounded-full ${refreshing ? "animate-spin" : ""}`}
            style={{ transform: refreshing ? undefined : `rotate(${(pullY / 56) * 360}deg)` }}
          />
        </div>
      )}

      {/* Hero */}
      <div className="relative py-12 sm:py-16 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-primary/4 blur-[140px] rounded-full pointer-events-none" />
        <div className="relative max-w-5xl mx-auto text-center">
          <p className="text-[11px] uppercase tracking-[0.15em] font-mono text-primary mb-3">
            Indie Film Industry
          </p>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            Projects
          </h1>
          <p className="text-muted-foreground mt-3 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Discover productions at every stage. Attach yourself. Find collaborators, investors, and distribution.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            {user ? (
              <Link to="/projects/new">
                <Button className="glass-gold text-primary-foreground font-semibold">
                  <Plus className="w-4 h-4 mr-2" /> List Your Project
                </Button>
              </Link>
            ) : (
              <Button onClick={() => base44.auth.redirectToLogin()} className="glass-gold text-primary-foreground font-semibold">
                <Plus className="w-4 h-4 mr-2" /> List Your Project
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search + filter bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects, genres, companies…"
              className="pl-9 bg-secondary border-border text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`border-border gap-1.5 text-xs ${showFilters ? "border-primary/50 text-primary bg-primary/5" : "text-muted-foreground"}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilters.length > 0 && (
              <span className="ml-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                {activeFilters.length}
              </span>
            )}
          </Button>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-card border border-white/[0.06] rounded-xl p-4 mb-4 space-y-4">
                {/* Type filter */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">Format</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setFilterType("all")} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filterType === "all" ? "bg-primary/15 border border-primary/40 text-primary" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"}`}>
                      All
                    </button>
                    {PROJECT_TYPES.map((t) => (
                      <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filterType === t ? "bg-primary/15 border border-primary/40 text-primary" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Stage filter */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">Stage</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setFilterStage("all")} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filterStage === "all" ? "bg-primary/15 border border-primary/40 text-primary" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"}`}>
                      All
                    </button>
                    {PROJECT_STAGES.map((s) => (
                      <button key={s} onClick={() => setFilterStage(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filterStage === s ? "bg-primary/15 border border-primary/40 text-primary" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Seeking filter */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">Seeking</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setFilterSeeking("all")} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filterSeeking === "all" ? "bg-primary/15 border border-primary/40 text-primary" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"}`}>
                      All
                    </button>
                    {SEEKING_OPTIONS.map((s) => (
                      <button key={s} onClick={() => setFilterSeeking(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filterSeeking === s ? "bg-primary/15 border border-primary/40 text-primary" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Sort */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">Sort by</p>
                  <div className="flex gap-1.5">
                    {[["newest", "Recently Added"], ["views", "Most Viewed"], ["saves", "Most Saved"]].map(([val, label]) => (
                      <button key={val} onClick={() => setSortBy(val)} className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${sortBy === val ? "bg-primary/15 border border-primary/40 text-primary" : "bg-secondary border border-border text-muted-foreground hover:text-foreground"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {activeFilters.map((f) => (
              <button
                key={f}
                onClick={() => clearFilter(f)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs text-primary font-medium"
              >
                {f} <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}

        {/* Count row */}
        <div className="flex items-center justify-between mb-4 text-xs text-muted-foreground">
          <span>{filtered.length} project{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <Film className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground">No projects found</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
              {activeFilters.length > 0 || search
                ? "Try adjusting your filters."
                : "Be the first to list a project on Spot'd."}
            </p>
            {user && !search && activeFilters.length === 0 && (
              <Link to="/projects/new" className="mt-6 inline-block">
                <Button className="bg-primary text-primary-foreground mt-4">
                  <Plus className="w-4 h-4 mr-2" /> List Your Project
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3 pb-24">
            {filtered.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                index={i}
                isOwner={user?.id === p.creator_user_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
