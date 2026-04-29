import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Bookmark, Share2, ArrowLeft, Zap, Check, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProfileHero from "../components/profile/ProfileHero";
import ContactPanel from "../components/profile/ContactPanel";
import { AboutSection, ProfessionalDetails, SkillsSection, CreditsSection, PortfolioSection } from "../components/profile/ProfileSections";
import SpotsSection from "../components/profile/SpotsSection";
import SpottedWithSection from "../components/profile/SpottedWithSection";
import SpotRequestModal from "../components/profile/SpotRequestModal";
import SpotScoreBadge from "../components/SpotScoreBadge";
import ProfileCard from "../components/ProfileCard";
import ProfilePosterCard from "../components/ProfilePosterCard";
import { usePageMeta } from "@/lib/usePageMeta";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [profileSubscription, setProfileSubscription] = useState(null);
  const [profileOwner, setProfileOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [similarProfiles, setSimilarProfiles] = useState([]);
  const [linkedCompanies, setLinkedCompanies] = useState([]);
  const [isSaved, setIsSaved] = useState(false);
  const [spotModalOpen, setSpotModalOpen] = useState(false);
  const [hasSpotted, setHasSpotted] = useState(false);
  const [spotting, setSpotting] = useState(false);

  const profileParam = window.location.pathname.split("/profile/")[1];
  const isMongoId = /^[a-f0-9]{24}$/.test(profileParam);

  // OG / share-preview tags — wired off the loaded profile
  const role = profile?.primary_role || "";
  const place = [profile?.city, profile?.state].filter(Boolean).join(", ");
  usePageMeta({
    title: profile ? `${profile.preferred_name || profile.full_name} · ${role || "Spot'd"}` : undefined,
    description: profile
      ? `${role}${place ? " · " + place : ""}${profile.spot_score ? ` · SpotScore ${profile.spot_score}` : ""}. Find cast & crew on Spot'd.`
      : undefined,
    image: profile?.profile_slug
      ? `${base44.baseURL}/api/og/profile/${profile.profile_slug}.png`
      : profile?.id
      ? `${base44.baseURL}/api/og/profile/${profile.id}.png`
      : undefined,
    url: profile?.profile_slug
      ? `${window.location.origin}/u/${profile.profile_slug}`
      : undefined,
    type: "profile",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const me = await base44.auth.me();
        setUser(me);
        const myProfiles = await base44.entities.Profile.filter({ user_id: me.id });
        if (myProfiles.length > 0) setMyProfile(myProfiles[0]);

        const saved = await base44.entities.SavedProfile.filter({
          user_id: me.id,
          profile_id: profileParam,
        });
        setIsSaved(saved.length > 0);

        const existingSpot = await base44.entities.Spot.filter({
          spotter_user_id: me.id,
          spotted_profile_id: profileParam,
        });
        setHasSpotted(existingSpot.length > 0);
      }

      const profiles = isMongoId
        ? await base44.entities.Profile.filter({ id: profileParam })
        : await base44.entities.Profile.filter({ profile_slug: profileParam });
      if (profiles.length > 0) {
        const p = profiles[0];
        setProfile(p);
        // Server-side, rate-limited view-count increment (1/hour per viewer).
        // Owner self-views are skipped server-side.
        try { await base44.http.post(`/api/profiles/${p.id}/view`, {}); } catch { /* non-critical */ }
        // Load similar profiles
        if (p.primary_role) {
          const similar = await base44.entities.Profile.filter(
            { primary_role: p.primary_role },
            "-spot_score",
            5
          );
          setSimilarProfiles(similar.filter((s) => s.id !== p.id).slice(0, 4));
        }
        // Cross-link: show "Also on Spot'd" company tiles for any
        // CompanyProfile owned by this user.
        if (p.user_id) {
          const linked = await base44.entities.CompanyProfile.filter({ user_id: p.user_id }).catch(() => []);
          setLinkedCompanies(linked || []);
          // Load this profile's owner User record so we can read the
          // is_founding_member flag for the hero badge.
          try {
            const owner = await base44.entities.User.get(p.user_id);
            setProfileOwner(owner || null);
          } catch { /* non-critical */ }
          // Load this profile's active subscription (for the tier badge).
          try {
            const subs = await base44.entities.Subscription.filter(
              { user_id: p.user_id, status: "active" }, "-created_date", 1
            );
            setProfileSubscription(subs?.[0] || null);
          } catch { /* non-critical */ }
        }
      }
      setLoading(false);
    };
    load();
  }, [profileParam]);

  const handleSave = async () => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    // Self-save prevention
    if (!profile || profile.user_id === user.id) return;
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    if (wasSaved) {
      const saved = await base44.entities.SavedProfile.filter({ user_id: user.id, profile_id: profileParam });
      if (saved.length > 0) await base44.entities.SavedProfile.delete(saved[0].id);
    } else {
      await base44.entities.SavedProfile.create({
        user_id: user.id,
        profile_id: profileParam,
        saved_at: new Date().toISOString(),
      });
    }
  };

  const handleSpot = async () => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    if (hasSpotted || spotting) return;
    setSpotting(true);
    // Check for duplicate
    const existing = await base44.entities.Spot.filter({ spotter_user_id: user.id, spotted_profile_id: profile.id });
    if (existing.length > 0) {
      setHasSpotted(true);
      setSpotting(false);
      return;
    }
    await base44.entities.Spot.create({
      spotter_user_id: user.id,
      spotter_profile_id: myProfile?.id || "",
      spotted_profile_id: profile.id,
      spotted_user_id: profile.user_id,
    });
    // Notify the spotted user
    const spotterName = myProfile?.preferred_name || myProfile?.full_name || user.full_name;
    const spotterSlug = myProfile?.profile_slug || myProfile?.id;
    await base44.entities.Notification.create({
      user_id: profile.user_id,
      type: "spotted",
      title: `${spotterName} spotted you!`,
      body: "Your SpotScore has been updated.",
      action_url: spotterSlug ? `/profile/${spotterSlug}` : "/search",
      is_read: false,
    });
    // Trigger SpotScore recalculation
    base44.functions.invoke("recalculateSpotScore", { profile_id: profile.id }).catch(() => {});
    setHasSpotted(true);
    setSpotting(false);
    toast.success("Spotted! ⚡");
  };

  const handleCopySpotMe = async () => {
    const slug = profile.profile_slug || profile.id;
    const url = `${window.location.origin}/profile/${slug}?spot=1`;
    try { await navigator.clipboard.writeText(url); } catch {
      const el = document.createElement('input'); el.value = url;
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    }
    toast.success('Spot Me link copied!');
  };

  const handleShare = async () => {
    const slug = profile.profile_slug;
    const url = slug
      ? `${window.location.origin}/profile/${slug}`
      : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('input');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    toast.success('Profile link copied!');
  };

  // Auto-open spot modal if ?spot=1
  useEffect(() => {
    if (profile && user && myProfile && myProfile.id !== profile.id) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("spot") === "1") setSpotModalOpen(true);
    }
  }, [profile, user, myProfile]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="pt-32 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Profile Not Found</h1>
        <Link to="/search" className="text-primary text-sm mt-4 inline-block">Back to Directory</Link>
      </div>
    );
  }

  return (
    <div className="pb-20">

      {myProfile && myProfile.id !== profile?.id && (
        <SpotRequestModal
          open={spotModalOpen}
          onClose={() => setSpotModalOpen(false)}
          targetProfile={profile}
          myProfile={myProfile}
        />
      )}
      <ProfileHero profile={profile} subscription={profileSubscription} isFoundingMember={!!profileOwner?.is_founding_member} />

      {/* Actions strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="flex items-center gap-2">
          <Link to="/search">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <div className="flex-1" />
          {user && myProfile?.id !== profile?.id && (
            <>
              <Button
                size="sm"
                className={hasSpotted ? "bg-secondary text-muted-foreground cursor-default" : "bg-primary text-primary-foreground font-semibold"}
                onClick={hasSpotted ? undefined : handleSpot}
                disabled={spotting}
              >
                {spotting
                  ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  : hasSpotted
                  ? <><Check className="w-4 h-4 mr-1" /> Spotted</>
                  : <><Zap className="w-4 h-4 mr-1" /> Spot them</>
                }
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-border text-xs"
                onClick={() => setSpotModalOpen(true)}
              >
                Request endorsement
              </Button>
            </>
          )}
          {user && myProfile?.id === profile?.id && (
            <>
              <Button variant="outline" size="sm" className="border-border" onClick={handleCopySpotMe}>
                <Share2 className="w-4 h-4 mr-1" /> Spot Me Link
              </Button>
              <ProfilePosterCard
                profile={profile}
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/40 text-primary hover:bg-primary/10"
                    data-testid="download-my-poster-btn"
                  >
                    <ImageIcon className="w-4 h-4 mr-1" /> Download my poster
                  </Button>
                }
              />
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleSave} className="border-border hover:border-primary/20">
            <Bookmark className={`w-4 h-4 mr-1 ${isSaved ? "fill-primary text-primary" : ""}`} />
            {isSaved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left column */}
          <div className="flex-1 min-w-0 space-y-8">
            <AboutSection bio={profile.bio} />
            <ProfessionalDetails profile={profile} />
            <SkillsSection profile={profile} />

            {/* Availability */}
            {profile.availability_status && (
              <section className="space-y-3">
                <h2 className="font-display text-lg font-semibold text-foreground">Availability</h2>
                <div className="bg-secondary/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      profile.availability_status === "Available Now" ? "bg-green-400" :
                      profile.availability_status === "Available Soon" ? "bg-yellow-400" : "bg-red-400"
                    }`} />
                    <span className="text-sm font-medium text-foreground">{profile.availability_status}</span>
                  </div>
                  {profile.availability_notes && (
                    <p className="text-sm text-muted-foreground mt-2">{profile.availability_notes}</p>
                  )}
                </div>
              </section>
            )}

            <CreditsSection profile={profile} />
            <PortfolioSection profile={profile} />
            <SpottedWithSection profileId={profile.id} />
            <SpotsSection profileId={profile.id} />

            {/* Also on Spot'd — cross-link to any CompanyProfile owned by this user */}
            {linkedCompanies.length > 0 && (
              <section className="space-y-3" data-testid="also-on-spotd-section">
                <h2 className="font-display text-lg font-semibold text-foreground">Also on Spot'd</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {linkedCompanies.map((c) => (
                    <Link
                      key={c.id}
                      to={`/c/${c.company_slug || c.id}`}
                      data-testid={`also-on-spotd-company-${c.company_slug || c.id}`}
                      className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {c.logo ? (
                          <img src={c.logo.startsWith("/api/static/") ? c.logo : c.logo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">{(c.company_name || "C").slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{c.company_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {c.company_type || "Company"} · getspotd.app/c/{c.company_slug || c.id}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right sticky panel */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="lg:sticky lg:top-24 space-y-4">
              <ContactPanel profile={profile} user={user} myProfile={myProfile} />

              {/* Quick stats */}
              <div className="bg-card border border-border/60 rounded-xl p-6">
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
                  Quick Stats
                </h3>
                <div className="space-y-3 text-sm">
                  {profile.experience_level && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Level</span>
                      <span className="text-foreground">{profile.experience_level}</span>
                    </div>
                  )}
                  {profile.years_of_experience && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Years Active</span>
                      <span className="text-foreground">{profile.years_of_experience}+</span>
                    </div>
                  )}
                  {profile.city && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location</span>
                      <span className="text-foreground">{profile.city}</span>
                    </div>
                  )}
                  {profile.union_status?.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Union</span>
                      <span className="text-foreground">{profile.union_status[0]}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Similar profiles */}
        {similarProfiles.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-xl font-semibold text-foreground mb-6">Similar Profiles</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {similarProfiles.map((p, i) => (
                <ProfileCard key={p.id} profile={p} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}