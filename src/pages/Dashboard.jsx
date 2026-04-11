import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Crown, Eye, Bookmark, Clock, ChevronRight, Edit, UserCheck, Zap, Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/useTheme";
import VerificationPanel from "../components/VerificationPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import CineScoreBadge from "../components/CineScoreBadge";
import ProfileCard from "../components/ProfileCard";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [savedProfiles, setSavedProfiles] = useState([]);
  const [savedProfileDetails, setSavedProfileDetails] = useState([]);
  const [revealCount, setRevealCount] = useState(0);
  const [workedWithCount, setWorkedWithCount] = useState(0);
  const [endorsementCount, setEndorsementCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activatingBoost, setActivatingBoost] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me();
      setUser(me);

      const profiles = await base44.entities.Profile.filter({ user_id: me.id });
      if (profiles.length > 0) {
        const p = profiles[0];
        setProfile(p);

        const ww = await base44.entities.WorkedWith.filter({ profile_id: p.id });
        setWorkedWithCount(ww.length);

        const end = await base44.entities.Endorsement.filter({ profile_id: p.id });
        setEndorsementCount(end.length);
      }

      const monthKey = new Date().toISOString().slice(0, 7);
      const reveals = await base44.entities.ContactReveal.filter({ viewer_id: me.id, month_key: monthKey });
      setRevealCount(reveals.length);

      const saved = await base44.entities.SavedProfile.filter({ user_id: me.id });
      setSavedProfiles(saved);

      if (saved.length > 0) {
        const detailPromises = saved.slice(0, 6).map(async (s) => {
          const p = await base44.entities.Profile.filter({ id: s.profile_id });
          return p[0];
        });
        const details = (await Promise.all(detailPromises)).filter(Boolean);
        setSavedProfileDetails(details);
      }

      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const profileCompleteness = profile ? Math.min(profile.cine_score || 0, 100) : 0;

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Welcome back, {user?.full_name}</p>
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

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {/* CineScore */}
          <div className="bg-card border border-border/60 rounded-xl p-5 flex items-center gap-4">
            <CineScoreBadge score={profile?.cine_score || 0} size="md" showLabel={false} />
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">CineScore</p>
              <p className="font-display text-xl font-bold text-foreground">{profile?.cine_score || 0}</p>
            </div>
          </div>

          {/* Reveals */}
          <div className="bg-card border border-border/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-primary" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Contact Reveals</p>
            </div>
            <p className="font-display text-xl font-bold text-foreground">{revealCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {profile?.is_pro ? "Unlimited" : `${5 - revealCount} remaining this month`}
            </p>
          </div>

          {/* Saved */}
          <div className="bg-card border border-border/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Bookmark className="w-4 h-4 text-primary" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Saved Profiles</p>
            </div>
            <p className="font-display text-xl font-bold text-foreground">{savedProfiles.length}</p>
          </div>

          {/* Connections */}
          <div className="bg-card border border-border/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-4 h-4 text-primary" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Worked With</p>
            </div>
            <p className="font-display text-xl font-bold text-foreground">{workedWithCount}</p>
            <p className="text-xs text-muted-foreground mt-1">{endorsementCount} endorsements</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Completion */}
            {profile && (
              <div className="bg-card border border-border/60 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                    Profile Completion
                  </h3>
                  <span className="text-sm text-primary font-medium">{profileCompleteness}%</span>
                </div>
                <Progress value={profileCompleteness} className="h-2 bg-secondary" />
                <p className="text-xs text-muted-foreground mt-3">
                  Complete more fields to improve your CineScore and visibility.
                </p>
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

            {/* Saved Profiles */}
            {savedProfileDetails.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                    Saved Profiles
                  </h3>
                  <Link to="/search" className="text-xs text-primary hover:underline flex items-center gap-1">
                    View All <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {savedProfileDetails.map((p, i) => (
                    <ProfileCard key={p.id} profile={p} index={i} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Availability */}
            {profile && (
              <div className="bg-card border border-border/60 rounded-xl p-6">
                <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                  Availability
                </h3>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    profile.availability_status === "Available Now" ? "bg-green-400" :
                    profile.availability_status === "Available Soon" ? "bg-yellow-400" : "bg-red-400"
                  }`} />
                  <span className="text-sm text-foreground">{profile.availability_status}</span>
                </div>
                <Link to="/create-profile">
                  <Button variant="outline" size="sm" className="w-full mt-4 border-border text-xs">
                    <Clock className="w-3.5 h-3.5 mr-1" /> Update Availability
                  </Button>
                </Link>
              </div>
            )}

            {/* PRO upgrade */}
            {profile && !profile.is_pro && (
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

            {/* PRO badge */}
            {profile?.is_pro && (
              <div className="glass-gold rounded-xl p-6 text-center">
                <Crown className="w-8 h-8 text-primary-foreground mx-auto mb-2" />
                <p className="font-display text-lg font-bold text-primary-foreground">PRO Member</p>
                {profile.is_founding_member && (
                  <Badge className="bg-white/20 text-white mt-2">Founding Member</Badge>
                )}
              </div>
            )}

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
          </div>
        </div>
      </div>
    </div>
  );
}