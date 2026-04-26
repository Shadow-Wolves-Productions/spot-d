import { useState, useEffect, useCallback } from "react";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, MapPin, Calendar, DollarSign, Briefcase, Users, Settings2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import ApplyModal from "../components/casting/ApplyModal";
import CastingCallShareCard from "../components/CastingCallShareCard";

const TYPE_COLORS = {
  "Feature Film": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Short Film": "text-green-400 bg-green-500/10 border-green-500/20",
  "TV Series": "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Commercial": "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "Music Video": "text-pink-400 bg-pink-500/10 border-pink-500/20",
  "Documentary": "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

function CastingCallCard({ call, myProfile, index, user, appliedCallIds }) {
  const [applyOpen, setApplyOpen] = useState(false);
  const alreadyApplied = appliedCallIds?.has(call.id);
  const isCreator = user?.id === call.creator_user_id;

  // "Posted by" attribution — company or personal
  const isCompanyPost = call.posted_as === "company" && call.posted_as_company_id;
  const attributionName = isCompanyPost ? call.posted_as_company_name : call.company_name;
  const attributionLogo = isCompanyPost ? call.posted_as_company_logo : call.company_logo;
  const attributionHref = isCompanyPost && call.posted_as_company_slug ? `/c/${call.posted_as_company_slug}` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-card border border-border/60 rounded-xl p-6 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5"
      data-testid={`casting-call-card-${call.id}`}
    >
      {/* Posted-by chip — links to company if company-posted */}
      {(attributionName || attributionLogo) && (
        <div className="flex items-center gap-2 mb-3" data-testid="casting-call-posted-by">
          {attributionLogo && (
            <img src={attributionLogo.startsWith("/api/static/") ? attributionLogo : attributionLogo} alt="" className="w-5 h-5 rounded object-cover border border-border flex-shrink-0" />
          )}
          {attributionHref ? (
            <Link to={attributionHref} className="text-[11px] uppercase tracking-[0.06em] font-mono text-muted-foreground hover:text-primary transition-colors">
              Posted by {attributionName}
            </Link>
          ) : attributionName ? (
            <span className="text-[11px] uppercase tracking-[0.06em] font-mono text-muted-foreground">
              Posted by {attributionName}
            </span>
          ) : null}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[call.project_type] || "text-muted-foreground border-border"}`}>
              {call.project_type || "Project"}
            </Badge>
            {call.compensation && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                {call.compensation}
              </Badge>
            )}
          </div>

          <h3 className="font-display text-lg font-semibold text-foreground leading-tight mb-1">
            {call.project_title}
          </h3>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {call.description}
          </p>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {call.roles_needed?.map((role) => (
              <span key={role} className="px-2 py-1 rounded-md bg-secondary/60 text-xs text-foreground">
                {role}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {call.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {call.location}
              </div>
            )}
            {call.shoot_dates && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {call.shoot_dates}
              </div>
            )}
            {call.budget_range && (
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> {call.budget_range}
              </div>
            )}
            {call.experience_level && call.experience_level !== "Any" && (
              <div className="flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> {call.experience_level}
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col gap-2 items-stretch sm:items-end w-full sm:w-auto">
          {call.application_count > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono sm:text-right">{call.application_count} application{call.application_count !== 1 ? "s" : ""}</span>
          )}
          {/* Share button — visible to everyone (creators + talent) so calls
              spread organically through Instagram, Twitter, DMs etc. */}
          <CastingCallShareCard
            call={call}
            trigger={
              <Button
                size="sm"
                variant="ghost"
                className="border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/30 gap-1.5 text-xs"
                data-testid={`casting-share-btn-${call.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </Button>
            }
          />
          {isCreator && alreadyApplied ? (
            <Link to={`/casting/applications?call=${call.id}`}>
              <Button size="sm" variant="outline" className="border-border gap-1.5 text-xs">
                <Settings2 className="w-3.5 h-3.5" /> Manage · Self-applied
              </Button>
            </Link>
          ) : isCreator ? (
            <div className="flex flex-col gap-2 items-end">
              <Link to={`/casting/applications?call=${call.id}`}>
                <Button size="sm" variant="outline" className="border-border gap-1.5 text-xs">
                  <Settings2 className="w-3.5 h-3.5" /> Manage Applications
                </Button>
              </Link>
              {myProfile && (
                <Button
                  onClick={() => setApplyOpen(true)}
                  size="sm"
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10 text-xs"
                  data-testid="self-apply-btn"
                >
                  Apply as crew/cast
                </Button>
              )}
            </div>
          ) : alreadyApplied ? (
            <span className="text-xs px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
              ✓ Applied
            </span>
          ) : myProfile ? (
            <Button
              onClick={() => setApplyOpen(true)}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              Apply
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => base44.auth.redirectToLogin()}
            >
              Sign in to Apply
            </Button>
          )}
        </div>
      </div>

      <ApplyModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        castingCall={call}
        myProfile={myProfile}
      />
    </motion.div>
  );
}

export default function CastingCalls() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [filter, setFilter] = useState("all");
  const [appliedCallIds, setAppliedCallIds] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const isAuth = await base44.auth.isAuthenticated();
    let me = null;
    if (isAuth) {
      me = await base44.auth.me();
      setUser(me);
      const [profiles, myApps] = await Promise.all([
        base44.entities.Profile.filter({ user_id: me.id }),
        base44.entities.CastingApplication.filter({ applicant_user_id: me.id }),
      ]);
      if (profiles.length > 0) setMyProfile(profiles[0]);
      setAppliedCallIds(new Set(myApps.map((a) => a.casting_call_id)));
    }
    const data = await base44.entities.CastingCall.filter({ is_active: true }, "-created_date", 50);
    setCalls(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { pullY, refreshing } = usePullToRefresh(load);

  const filtered = filter === "all" ? calls : calls.filter((c) => c.project_type === filter);
  const types = [...new Set(calls.map((c) => c.project_type).filter(Boolean))];

  return (
    <div className="min-h-screen pt-20">
      {(pullY > 0 || refreshing) && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center w-9 h-9 bg-card border border-border rounded-full shadow-md"
          style={{ transform: `translateX(-50%) translateY(${Math.min(pullY, 56)}px)` }}
        >
          <div className={`w-4 h-4 border-2 border-primary border-t-transparent rounded-full ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: refreshing ? undefined : `rotate(${(pullY / 56) * 360}deg)` }}
          />
        </div>
      )}
      {/* Hero */}
      <div className="relative py-12 sm:py-16 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full" />

        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
            Casting &amp; Crew Calls
          </h1>
          <p className="text-muted-foreground mt-3 text-sm sm:text-base max-w-xl mx-auto">
            Open calls from filmmakers across Australia. One click to apply.
          </p>

          <div className="flex items-center justify-center gap-3 mt-8">
            {user && (
              <Link to="/casting/new">
                <Button className="glass-gold text-primary-foreground font-semibold">
                  <Plus className="w-4 h-4 mr-2" /> Post a Call
                </Button>
              </Link>
            )}
            {!user && (
              <Button onClick={() => base44.auth.redirectToLogin()} className="glass-gold text-primary-foreground font-semibold">
                <Plus className="w-4 h-4 mr-2" /> Post a Call
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${filter === "all" ? "glass-gold text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
          >
            All ({calls.length})
          </button>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${filter === t ? "glass-gold text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground">No open calls right now</h3>
            <p className="text-sm text-muted-foreground mt-2">Be the first to post a casting call.</p>
            {user && (
              <Link to="/casting/new" className="mt-6 inline-block">
                <Button className="bg-primary text-primary-foreground mt-4">
                  <Plus className="w-4 h-4 mr-2" /> Post a Call
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-20">
            {filtered.map((call, i) => (
              <CastingCallCard key={call.id} call={call} myProfile={myProfile} index={i} user={user} appliedCallIds={appliedCallIds} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}