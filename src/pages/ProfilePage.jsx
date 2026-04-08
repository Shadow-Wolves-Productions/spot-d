import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Bookmark, Share2, Flag, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProfileHero from "../components/profile/ProfileHero";
import ContactPanel from "../components/profile/ContactPanel";
import { AboutSection, ProfessionalDetails, SkillsSection, CreditsSection, PortfolioSection } from "../components/profile/ProfileSections";
import WorkedWithSection from "../components/profile/WorkedWithSection";
import EndorsementsSection from "../components/profile/EndorsementsSection";
import CineScoreBadge from "../components/CineScoreBadge";
import ProfileCard from "../components/ProfileCard";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [similarProfiles, setSimilarProfiles] = useState([]);
  const [isSaved, setIsSaved] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const profileId = window.location.pathname.split("/profile/")[1];

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
          profile_id: profileId,
        });
        setIsSaved(saved.length > 0);
      }

      const profiles = await base44.entities.Profile.filter({ id: profileId });
      if (profiles.length > 0) {
        const p = profiles[0];
        setProfile(p);
        // Load similar profiles
        if (p.primary_role) {
          const similar = await base44.entities.Profile.filter(
            { primary_role: p.primary_role },
            "-cine_score",
            5
          );
          setSimilarProfiles(similar.filter((s) => s.id !== p.id).slice(0, 4));
        }
      }
      setLoading(false);
    };
    load();
  }, [profileId]);

  const handleSave = async () => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }
    if (isSaved) {
      const saved = await base44.entities.SavedProfile.filter({ user_id: user.id, profile_id: profileId });
      if (saved.length > 0) await base44.entities.SavedProfile.delete(saved[0].id);
      setIsSaved(false);
    } else {
      await base44.entities.SavedProfile.create({ user_id: user.id, profile_id: profileId });
      setIsSaved(true);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
  };

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
      <ProfileHero profile={profile} />

      {/* Actions strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="flex items-center gap-2">
          <Link to="/search">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleSave} className="border-border hover:border-primary/20">
            <Bookmark className={`w-4 h-4 mr-1 ${isSaved ? "fill-primary text-primary" : ""}`} />
            {isSaved ? "Saved" : "Save"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare} className="border-border hover:border-primary/20">
            <Share2 className="w-4 h-4 mr-1" /> Share
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
            <WorkedWithSection profileId={profile.id} />
            <EndorsementsSection profileId={profile.id} />
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