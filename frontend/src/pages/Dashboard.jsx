import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Crown, Eye, Bookmark, ChevronRight, Edit, Zap, Moon, Sun, Trash2, AlertTriangle, BarChart2, Building2, Sparkles, ArrowRight, Film, FolderOpen } from "lucide-react";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import RoleAlertsPanel from "../components/RoleAlertsPanel";
import { useTheme } from "../lib/useTheme";
import VerificationPanel from "../components/VerificationPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import SpotScoreBadge from "../components/SpotScoreBadge";
import ShareSpotScoreCard from "../components/ShareSpotScoreCard";
import AutoClaimBanner from "../components/AutoClaimBanner";
import ProfileCard from "../components/ProfileCard";
import SpotScoreBreakdown, { PercentileBadge } from "../components/SpotScoreBreakdown";
import SpotRequestsPanel from "../components/dashboard/SpotRequestsPanel";
import SavedProfilesPanel from "../components/dashboard/SavedProfilesPanel";
import WelcomeBanner from "../components/dashboard/WelcomeBanner";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [savedProfiles, setSavedProfiles] = useState([]);
  const [savedProfileDetails, setSavedProfileDetails] = useState([]);
  const [revealCount, setRevealCount] = useState(0);
  const [spotsCount, setSpotsCount] = useState(0);
  const [savedByCount, setSavedByCount] = useState(0);
  const [revealedByCount, setRevealedByCount] = useState(0);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myProjects, setMyProjects] = useState([]);
  const [savedProjectRecords, setSavedProjectRecords] = useState([]);
  const [savedProjectDetails, setSavedProjectDetails] = useState([]);
  const [activatingBoost, setActivatingBoost] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Wrap dashboard load so it can be re-invoked by pull-to-refresh.
  const loadDashboard = useCallback(async () => {
    const me = await base44.auth.me();
    setUser(me);

    const profiles = await base44.entities.Profile.filter({ user_id: me.id });
    if (profiles.length > 0) {
      const p = profiles[0];
      setProfile(p);

      const spots = await base44.entities.Spot.filter({ spotted_profile_id: p.id });
      setSpotsCount(spots.length);

      const savedBy = await base44.entities.SavedProfile.filter({ profile_id: p.id });
      setSavedByCount(savedBy.length);

      const revealedBy = await base44.entities.ContactReveal.filter({ profile_id: p.id });
      setRevealedByCount(revealedBy.length);
    }

    const subs = await base44.entities.Subscription.filter({ user_id: me.id, status: "active" });
    if (subs.length > 0) setSubscription(subs[0]);

    const monthKey = new Date().toISOString().slice(0, 7);
    const reveals = await base44.entities.ContactReveal.filter({ viewer_id: me.id, month_key: monthKey });
    setRevealCount(reveals.length);

    const saved = await base44.entities.SavedProfile.filter({ user_id: me.id });
    setSavedProfiles(saved);

    // Load any company profiles owned by this user
    const myCompanies = await base44.entities.CompanyProfile.filter({ user_id: me.id });
    setCompanies(myCompanies);

    // Load projects created by this user
    const projects = await base44.entities.Project.filter({ creator_user_id: me.id });
    setMyProjects((projects || []).sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)));

    // Load saved projects
    const savedProjRecords = await base44.entities.SavedProject.filter({ user_id: me.id });
    setSavedProjectRecords(savedProjRecords || []);
    if (savedProjRecords && savedProjRecords.length > 0) {
      const projDetails = (await Promise.all(
        savedProjRecords.map(async (s) => {
          const p = await base44.entities.Project.filter({ id: s.project_id });
          return p[0];
        })
      )).filter(Boolean);
      setSavedProjectDetails(projDetails);
    } else {
      setSavedProjectDetails([]);
    }

    if (saved.length > 0) {
      const detailPromises = saved.map(async (s) => {
        const p = await base44.entities.Profile.filter({ id: s.profile_id });
        return p[0];
      });
      const details = (await Promise.all(detailPromises)).filter(Boolean);
      setSavedProfileDetails(details);
    } else {
      setSavedProfileDetails([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  const { pullY, refreshing } = usePullToRefresh(loadDashboard);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const profileCompleteness = profile ? Math.min(profile.spot_score || 0, 100) : 0;

  return (
    <div className="pt-24 pb-20 px-4">
      {/* Pull-to-refresh indicator */}
      {(pullY > 0 || refreshing) && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center w-9 h-9 bg-card border border-border rounded-full shadow-md"
          style={{ transform: `translateX(-50%) translateY(${Math.min(pullY, 56)}px)` }}
          data-testid="dashboard-pull-indicator"
        >
          <div className={`w-4 h-4 border-2 border-primary border-t-transparent rounded-full ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: refreshing ? undefined : `rotate(${(pullY / 56) * 360}deg)` }}
          />
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-xs mt-1">Welcome back, {user?.full_name} 👋</p>
          </div>
          <div className="flex gap-3">
            {profile ? (
              <>
                <Link to={`/profile/${profile.id}`}>
                  <Button variant="outline" size="sm" className="border-border">
                    <Eye className="w-4 h-4 mr-1" /> View Profile
                  </Button>
                </Link>
                <Link to="/create-profile">
                  <Button size="sm" className="bg-primary text-primary-foreground">
                    <Edit className="w-4 h-4 mr-1" /> Edit Profile
                  </Button>
                </Link>
                <Link to="/create-company">
                  <Button variant="outline" size="sm" className="border-border" data-testid="dashboard-create-company-btn">
                    <Building2 className="w-4 h-4 mr-1" /> Company profile
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/create-profile">
                <Button size="sm" className="glass-gold text-primary-foreground font-semibold">
                  Create Your Profile
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Auto-claim screen for imported members on first login */}
        <AutoClaimBanner />

        {/* Welcome Banner (first-time / recent import users) */}
        <WelcomeBanner user={user} profile={profile} />

        {/* Your Profiles — personal + company side-by-side */}
        {(profile || companies.length > 0) && (
          <section className="mb-8" data-testid="your-profiles-section">
            <p className="text-[11px] uppercase tracking-[0.08em] font-mono text-muted-foreground mb-3">Your profiles</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profile && (
                <Link to={`/u/${profile.profile_slug || profile.id}`} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 transition-colors" data-testid="dashboard-personal-card">
                  <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden flex items-center justify-center flex-shrink-0">
                    {profile.profile_photo ? (
                      <img src={profile.profile_photo.startsWith("/api/static/") ? profile.profile_photo : profile.profile_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">{(profile.full_name || "P").slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{profile.preferred_name || profile.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{profile.primary_role || "Personal profile"} · SpotScore {profile.spot_score || 0}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              )}
              {companies.map((c) => (
                <Link key={c.id} to={`/c/${c.company_slug || c.id}`} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 transition-colors" data-testid={`dashboard-company-card-${c.company_slug || c.id}`}>
                  <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden flex items-center justify-center flex-shrink-0">
                    {c.logo ? <img src={c.logo} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-5 h-5 text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.company_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.company_type} · SpotScore {c.spot_score || 0}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
              {companies.length === 0 && profile && (
                <Link to="/create-company" className="rounded-xl border border-dashed border-border p-4 flex items-center gap-3 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors" data-testid="dashboard-add-company-card">
                  <div className="w-12 h-12 rounded-lg bg-secondary/40 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Create company profile</p>
                    <p className="text-[11px]">Get found as a studio/production house</p>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </section>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
          {/* SpotScore */}
          <div className="bg-card border border-border/60 rounded-xl p-3 flex items-center gap-3">
            <SpotScoreBadge score={profile?.spot_score || 0} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.08em] font-mono text-muted-foreground">SpotScore</p>
              <p className="font-display text-lg font-bold text-foreground">{profile?.spot_score || 0}<span className="text-[10px] font-normal text-muted-foreground ml-1">/100</span></p>
              {(profile?.spot_percentile || 0) >= 75 && (
                <div className="mt-0.5"><PercentileBadge percentile={profile.spot_percentile} /></div>
              )}
              {profile && (
                <div className="mt-1.5">
                  <ShareSpotScoreCard
                    profile={profile}
                    trigger={
                      <button data-testid="dashboard-share-spotscore" className="text-[10px] uppercase tracking-[0.08em] font-mono text-primary hover:text-primary/80 underline-offset-2 hover:underline">
                        Share →
                      </button>
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* Reveals */}
          <div className="bg-card border border-border/60 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Eye className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reveals</p>
            </div>
            <p className="font-display text-lg font-bold text-foreground">{revealCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {subscription?.contact_reveal_limit === -1 ? "Unlimited" : `${(subscription?.contact_reveal_limit || 5) - revealCount} left`}
            </p>
          </div>

          {/* Saved */}
          <div className="bg-card border border-border/60 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Bookmark className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saved</p>
            </div>
            <p className="font-display text-lg font-bold text-foreground">{savedProfiles.length}</p>
          </div>

          {/* Spots */}
          <div className="bg-card border border-border/60 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your Spots</p>
            </div>
            <p className="font-display text-lg font-bold text-foreground">{spotsCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">times spotted</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-3">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-3">
            {/* Spot Requests */}
            <SpotRequestsPanel user={user} profile={profile} />

            {/* SpotScore Breakdown */}
            {profile && (
              <div className="bg-card border border-border/60 rounded-xl p-4">
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                  Your SpotScore
                </h3>
                <SpotScoreBreakdown
                  profile={profile}
                  spotCount={spotsCount}
                  savedByCount={savedByCount}
                  revealedByCount={revealedByCount}
                />
              </div>
            )}

            {/* Verification Status */}
            {profile && (
              <VerificationPanel
                profile={profile}
                onVerified={async () => {
                  const profiles = await base44.entities.Profile.filter({ user_id: user.id });
                  if (profiles.length > 0) setProfile(profiles[0]);
                }}
              />
            )}

            {/* My Projects */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Film className="w-4 h-4 text-primary" /> My Projects
                </h3>
                <Link to="/projects/new" className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                  + New
                </Link>
              </div>
              {myProjects.length === 0 ? (
                <div className="bg-card border border-white/[0.06] rounded-xl p-6 text-center">
                  <FolderOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No projects yet.</p>
                  <Link to="/projects/new">
                    <Button size="sm" className="mt-3 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-xs">
                      List Your First Project
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {myProjects.slice(0, 5).map((proj) => (
                    <Link
                      key={proj.id}
                      to={`/projects/${proj.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-white/[0.06] hover:border-primary/20 transition-all"
                    >
                      {proj.poster_image ? (
                        <img src={proj.poster_image} alt="" className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-14 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                          <Film className="w-4 h-4 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{proj.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{proj.stage || proj.project_type || "—"}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${proj.is_published ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/10" : "border-amber-500/20 text-amber-400 bg-amber-500/10"}`}>
                            {proj.is_published ? "Published" : "Draft"}
                          </span>
                          {(proj.inquiry_count || 0) > 0 && (
                            <span className="text-[10px] text-muted-foreground">{proj.inquiry_count} {proj.inquiry_count === 1 ? "inquiry" : "inquiries"}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                    </Link>
                  ))}
                  {myProjects.length > 5 && (
                    <Link to="/projects" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary py-2 transition-colors">
                      View all {myProjects.length} projects <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Saved Projects */}
            {savedProjectRecords.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-primary" /> Saved Projects
                  </h3>
                  <Link to="/projects" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Browse
                  </Link>
                </div>
                <div className="space-y-2">
                  {savedProjectDetails.slice(0, 4).map((proj) => (
                    <Link
                      key={proj.id}
                      to={`/projects/${proj.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-card border border-white/[0.06] hover:border-primary/20 transition-all"
                    >
                      {proj.poster_image ? (
                        <img src={proj.poster_image} alt="" className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-14 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                          <Film className="w-4 h-4 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{proj.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{proj.project_type || "—"} · {proj.stage || "—"}</p>
                        {proj.production_company && (
                          <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{proj.production_company}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Saved Profiles */}
            {savedProfiles.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                    Saved Profiles ({savedProfiles.length})
                  </h3>
                  <Link to="/analytics" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                    <BarChart2 className="w-3 h-3" /> Analytics
                  </Link>
                </div>
                <SavedProfilesPanel
                  savedRecords={savedProfiles}
                  profileDetails={savedProfileDetails}
                  myProfileId={profile?.id}
                  onRefresh={async () => {
                    const saved = await base44.entities.SavedProfile.filter({ user_id: user.id });
                    setSavedProfiles(saved);
                    const details = (await Promise.all(saved.map(async (s) => {
                      const p = await base44.entities.Profile.filter({ id: s.profile_id });
                      return p[0];
                    }))).filter(Boolean);
                    setSavedProfileDetails(details);
                  }}
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* PRO upgrade */}
            {profile && subscription?.tier === "free" && (
              <div className="glass-effect rounded-xl p-6 gold-glow">
                <Crown className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-display text-base font-semibold text-foreground">Upgrade to PRO</h3>
                <p className="text-xs text-muted-foreground mt-2">
                  Unlimited reveals, PRO badge, priority placement, and more.
                </p>
                <Link to="/pricing">
                  <Button size="sm" className="w-full mt-4 bg-primary text-primary-foreground">
                    <Crown className="w-4 h-4 mr-1" /> From $9.99/mo
                  </Button>
                </Link>
              </div>
            )}

            {/* Featured on Homepage add-on */}
            {profile && (
              <div className={`rounded-xl p-6 border ${profile.is_boosted ? "glass-gold border-primary/30" : "bg-card border-border/60"}`}>
                <Zap className={`w-5 h-5 mb-3 ${profile.is_boosted ? "text-primary" : "text-muted-foreground"}`} />
                <h3 className="font-display text-base font-semibold text-foreground">
                  {profile.is_boosted ? "Featured on Homepage" : "Feature My Profile"}
                </h3>
                {profile.is_boosted ? (
                  <>
                    <p className="text-xs text-muted-foreground mt-2">
                      Your profile is in the homepage spotlight. Visible to every visitor.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-xs text-green-400 font-medium">Active</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-4 border-border text-xs text-muted-foreground"
                      disabled={activatingBoost}
                      onClick={async () => {
                        setActivatingBoost(true);
                        await base44.entities.Profile.update(profile.id, { is_boosted: false, boost_expires: null });
                        setProfile((p) => ({ ...p, is_boosted: false }));
                        setActivatingBoost(false);
                      }}
                    >
                      Cancel Boost
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mt-2">
                      Get your profile pinned on the homepage spotlight — seen by every visitor.
                    </p>
                    <p className="font-display text-xl font-bold text-primary mt-3">$14.99<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                    <Button
                      size="sm"
                      className="w-full mt-4 bg-primary text-primary-foreground font-semibold"
                      disabled={activatingBoost || !profile}
                      onClick={async () => {
                        setActivatingBoost(true);
                        const expires = new Date();
                        expires.setMonth(expires.getMonth() + 1);
                        await base44.entities.Profile.update(profile.id, { is_boosted: true, boost_expires: expires.toISOString() });
                        setProfile((p) => ({ ...p, is_boosted: true }));
                        setActivatingBoost(false);
                      }}
                    >
                      {activatingBoost ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <><Zap className="w-4 h-4 mr-1" /> Activate — $14.99/mo</>}
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Tier badge */}
            {subscription && subscription.tier !== "free" && (
              <div className="glass-gold rounded-xl p-6 text-center">
                <Crown className="w-8 h-8 text-primary-foreground mx-auto mb-2" />
                <p className="font-display text-lg font-bold text-primary-foreground capitalize">{subscription.tier} Member</p>
                {subscription.notes && (
                  <Badge className="bg-white/20 text-white mt-2 text-xs">{subscription.notes}</Badge>
                )}
              </div>
            )}

            {/* Spot'd this month — homepage spotlight CTA */}
            <div className="bg-card border border-border/60 rounded-xl p-6" data-testid="dashboard-spotlight-card">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">Spot'd this month</h3>
              </div>
              {subscription?.tier === "elite" ? (
                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="spotlight-elite-msg">
                  Your profile is in the homepage rotation —
                  <span className="text-primary font-semibold"> you'll appear in the public Spotlight this month.</span>
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Get featured on the homepage Spotlight to put your work in front of every visitor.
                  </p>
                  <Link
                    to="/pricing"
                    className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-primary hover:underline"
                    data-testid="spotlight-upgrade-cta"
                  >
                    Upgrade to Elite <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              )}
            </div>

            {/* Appearance */}
            <div className="bg-card border border-border/60 rounded-xl p-6">
              <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Appearance</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {theme === "dark" ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
                  <span className="text-sm text-foreground">{theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    theme === "dark" ? "bg-primary" : "bg-border"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    theme === "dark" ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">{theme === "dark" ? "Switch to light editorial mode" : "Switch to dark mode"}</p>
            </div>

            {/* Role Alerts */}
            <RoleAlertsPanel user={user} profile={profile} />

            {/* Danger Zone */}
            <div className="bg-card border border-destructive/30 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <h3 className="font-display text-sm font-semibold text-destructive uppercase tracking-wider">Danger Zone</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              {!showDeleteConfirm ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white w-full"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Account
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-foreground font-medium">Type <span className="font-bold text-destructive">DELETE</span> to confirm:</p>
                  <input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="w-full h-9 px-3 text-sm border border-destructive/40 bg-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-destructive"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-border"
                      onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={deleteConfirmText !== "DELETE" || deleting}
                      className="flex-1 bg-destructive text-white hover:bg-destructive/90"
                      onClick={async () => {
                        if (deleteConfirmText !== "DELETE") return;
                        setDeleting(true);
                        if (profile) await base44.entities.Profile.delete(profile.id);
                        await base44.auth.logout();
                      }}
                    >
                      {deleting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <><Trash2 className="w-3.5 h-3.5 mr-1" /> Confirm Delete</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}