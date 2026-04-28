import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, MapPin, Calendar, DollarSign, Briefcase, Users, Mail,
  Building2, User as UserIcon, Share2, Send, Loader2,
} from "lucide-react";
import ApplyModal from "../components/casting/ApplyModal";
import CastingCallShareCard from "../components/CastingCallShareCard";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { usePageMeta } from "@/lib/usePageMeta";

const TYPE_COLORS = {
  "Feature Film": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Short Film":   "text-green-400 bg-green-500/10 border-green-500/20",
  "TV Series":    "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Commercial":   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "Music Video":  "text-pink-400 bg-pink-500/10 border-pink-500/20",
  "Documentary":  "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

export default function CastingCallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const c = await base44.entities.CastingCall.get(id);
        setCall(c);
        // Fire-and-forget view-count increment
        try {
          await base44.entities.CastingCall.update(id, { view_count: (c.view_count || 0) + 1 });
        } catch { /* non-critical */ }

        const me = await base44.auth.me().catch(() => null);
        setUser(me);
        if (me) {
          const profiles = await base44.entities.Profile.filter({ user_id: me.id });
          if (profiles.length > 0) setMyProfile(profiles[0]);
          const apps = await base44.entities.CastingApplication.filter({
            applicant_user_id: me.id,
            casting_call_id: id,
          });
          setHasApplied(apps.length > 0);
        }
      } catch {
        setCall(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Page-meta + OG tags for share previews
  usePageMeta({
    title: call ? `${call.project_title} — Now casting on Spot'd` : undefined,
    description: call ? `${call.project_type || "Project"}${call.location ? " · " + call.location : ""}. ${(call.roles_needed || []).slice(0,3).join(", ")}.` : undefined,
    image: call ? `${base44.baseURL}/api/og/casting/${call.id}.png` : undefined,
    type: "article",
  });

  const isCreator = user?.id === call?.creator_user_id;
  const isCompanyPost = call?.posted_as === "company" && call?.posted_as_company_id;
  const attributionName = isCompanyPost ? call?.posted_as_company_name : call?.company_name;
  const attributionLogo = isCompanyPost ? call?.posted_as_company_logo : call?.company_logo;
  const attributionHref = isCompanyPost && call?.posted_as_company_slug ? `/c/${call.posted_as_company_slug}` : null;

  if (loading) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center px-4 text-center" data-testid="casting-detail-404">
        <h1 className="font-display text-3xl font-500 text-foreground">Casting call not found</h1>
        <p className="text-muted-foreground mt-3">It may have been removed or the link is wrong.</p>
        <Link to="/casting"><Button className="mt-6 bg-primary text-primary-foreground rounded-full">Browse casting calls</Button></Link>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16 px-4 min-h-screen" data-testid="casting-detail-page">
      <div className="max-w-4xl mx-auto">
        <Link to="/casting" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> All casting calls
        </Link>

        {/* Poster (if uploaded) */}
        {call.poster_image && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="mb-8 rounded-2xl overflow-hidden border border-border bg-card"
            data-testid="casting-poster"
          >
            <img src={call.poster_image} alt={call.project_title} className="w-full h-auto max-h-[600px] object-cover" />
          </motion.div>
        )}

        {/* Header */}
        <div className="mb-8">
          {(attributionName || attributionLogo) && (
            <div className="flex items-center gap-2 mb-4" data-testid="casting-detail-posted-by">
              {attributionLogo && (
                <img src={attributionLogo} alt="" className="w-6 h-6 rounded object-cover border border-border" />
              )}
              {attributionHref ? (
                <Link to={attributionHref} className="text-xs uppercase tracking-[0.06em] font-mono text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                  {isCompanyPost ? <Building2 className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                  Posted by {attributionName}
                </Link>
              ) : (
                <span className="text-xs uppercase tracking-[0.06em] font-mono text-muted-foreground inline-flex items-center gap-1">
                  {isCompanyPost ? <Building2 className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                  Posted by {attributionName}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className={`px-3 py-1 text-[11px] uppercase tracking-[0.06em] rounded-full border ${TYPE_COLORS[call.project_type] || "text-muted-foreground border-border bg-secondary/40"}`}>
              {call.project_type || "Project"}
            </span>
            {!call.is_active && <Badge variant="outline" className="border-destructive/40 text-destructive">Closed</Badge>}
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-500 text-foreground leading-tight" style={{ letterSpacing: "-1px" }} data-testid="casting-detail-title">
            {call.project_title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {call.location && (
              <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {call.location}</span>
            )}
            {call.budget_range && (
              <span className="inline-flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> {call.budget_range}</span>
            )}
            {call.shoot_dates && (
              <span className="inline-flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {call.shoot_dates}</span>
            )}
            {call.union_status && (
              <span className="inline-flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> {call.union_status}</span>
            )}
          </div>
        </div>

        {/* Apply / Share */}
        <div className="flex flex-col sm:flex-row gap-3 mb-10">
          {isCreator ? (
            <Link to="/casting/applications" className="flex-1 sm:flex-initial">
              <Button size="lg" className="bg-primary text-primary-foreground rounded-full font-semibold w-full sm:w-auto px-8" data-testid="casting-detail-view-apps">
                <Users className="w-4 h-4 mr-2" /> View applications ({call.application_count || 0})
              </Button>
            </Link>
          ) : hasApplied ? (
            <Button size="lg" disabled className="bg-secondary text-muted-foreground rounded-full px-8 w-full sm:w-auto" data-testid="casting-detail-applied">
              ✓ You've applied
            </Button>
          ) : !user ? (
            <Link to="/login" className="flex-1 sm:flex-initial">
              <Button size="lg" className="bg-primary text-primary-foreground rounded-full font-semibold w-full sm:w-auto px-8" data-testid="casting-detail-login-to-apply">
                <Send className="w-4 h-4 mr-2" /> Sign in to apply
              </Button>
            </Link>
          ) : !myProfile ? (
            <Link to="/create-profile" className="flex-1 sm:flex-initial">
              <Button size="lg" className="bg-primary text-primary-foreground rounded-full font-semibold w-full sm:w-auto px-8">
                <UserIcon className="w-4 h-4 mr-2" /> Create profile to apply
              </Button>
            </Link>
          ) : (
            <Button size="lg" onClick={() => setApplyOpen(true)} className="bg-primary text-primary-foreground rounded-full font-semibold w-full sm:w-auto px-8" data-testid="casting-detail-apply">
              <Send className="w-4 h-4 mr-2" /> Apply now
            </Button>
          )}
          <CastingCallShareCard
            call={call}
            trigger={
              <Button size="lg" variant="outline" className="border-border rounded-full px-8 w-full sm:w-auto" data-testid="casting-detail-share">
                <Share2 className="w-4 h-4 mr-2" /> Share
              </Button>
            }
          />
        </div>

        {/* Description */}
        {call.description && (
          <section className="mb-10" data-testid="casting-detail-description">
            <h2 className="font-display text-lg font-medium text-foreground mb-3">About the project</h2>
            <p className="text-muted-foreground leading-[1.8] whitespace-pre-wrap">{call.description}</p>
          </section>
        )}

        {/* Roles needed */}
        {call.roles_needed?.length > 0 && (
          <section className="mb-10" data-testid="casting-detail-roles">
            <h2 className="font-display text-lg font-medium text-foreground mb-3">Roles needed</h2>
            <div className="flex flex-wrap gap-2">
              {call.roles_needed.map((r) => (
                <span key={r} className="px-3 py-1.5 rounded-full bg-secondary/60 text-sm text-foreground border border-border">{r}</span>
              ))}
            </div>
          </section>
        )}

        {/* Detailed roles with descriptions */}
        {call.roles?.length > 0 && (
          <section className="mb-10" data-testid="casting-detail-role-cards">
            <h2 className="font-display text-lg font-medium text-foreground mb-4">Role details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {call.roles.map((r, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5">
                  <p className="text-[10px] uppercase tracking-[0.06em] font-mono text-muted-foreground">{r.category}</p>
                  <h3 className="font-display text-base font-semibold text-foreground mt-1">{r.title || r.name || r.category}</h3>
                  {r.description && <p className="text-sm text-muted-foreground leading-relaxed mt-2">{r.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.06em] font-mono text-muted-foreground/80">
                    {r.gender && <span>{r.gender}</span>}
                    {r.age_range && <span>{r.age_range}</span>}
                    {r.union_status && <span>{r.union_status}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* How to apply */}
        {call.application_method && call.application_method !== "spot_button" && (
          <section className="mb-10 bg-card border border-border rounded-xl p-6">
            <h2 className="font-display text-base font-medium text-foreground mb-3">How to apply</h2>
            {call.application_method === "self_tape" && call.self_tape_instructions && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-[1.7]">{call.self_tape_instructions}</p>
            )}
            {call.submission_email && (
              <a href={`mailto:${call.submission_email}`} className="inline-flex items-center gap-1.5 text-sm text-primary mt-3"><Mail className="w-4 h-4" /> {call.submission_email}</a>
            )}
            {call.submission_link && (
              <a href={call.submission_link} target="_blank" rel="noreferrer" className="block text-sm text-primary mt-3 break-all">{call.submission_link}</a>
            )}
            {call.submission_link_password && (
              <p className="text-xs text-muted-foreground mt-2">Password: <span className="font-mono text-foreground">{call.submission_link_password}</span></p>
            )}
          </section>
        )}

        {/* Footer meta */}
        <div className="text-[11px] uppercase tracking-[0.06em] font-mono text-muted-foreground/60 mt-12 pt-6 border-t border-border">
          {call.deadline && <>Apply by {new Date(call.deadline).toLocaleDateString()} · </>}
          {call.view_count || 0} views · {call.application_count || 0} application{(call.application_count || 0) !== 1 ? "s" : ""}
        </div>
      </div>

      {applyOpen && myProfile && (
        <ApplyModal
          call={call}
          myProfile={myProfile}
          onClose={() => setApplyOpen(false)}
          onApplied={() => {
            setHasApplied(true);
            setApplyOpen(false);
            toast.success("Application sent!");
          }}
        />
      )}
    </div>
  );
}
