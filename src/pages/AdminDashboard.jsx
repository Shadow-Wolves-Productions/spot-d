import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, Users, Film, CheckCircle2, Crown, Search, RefreshCw, Award, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("users");

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me();
      if (me.role !== "admin") {
        window.location.href = "/";
        return;
      }
      setUser(me);
      await fetchData();
      setLoading(false);
    };
    load();
  }, []);

  const fetchData = async () => {
    const [allUsers, allProfiles, subs, endorsements, castingCalls, castingApps] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.Profile.list(),
      base44.entities.Subscription.list(),
      base44.entities.Endorsement.list(),
      base44.entities.CastingCall.list(),
      base44.entities.CastingApplication.list(),
    ]);
    // Attach subscription to each profile for easy lookup
    const profilesWithSubs = allProfiles.map((p) => ({
      ...p,
      _sub: subs.find((s) => s.user_id === p.user_id && s.status === "active"),
    }));
    setUsers(allUsers);
    setProfiles(profilesWithSubs);
    setStats({
      users: allUsers.length,
      profiles: allProfiles.length,
      verified_email: allProfiles.filter((p) => p.email_verified).length,
      verified_phone: allProfiles.filter((p) => p.phone_verified).length,
      pro: subs.filter((s) => s.status === "active" && s.tier === "pro").length,
      boosted: allProfiles.filter((p) => p.is_boosted).length,
      endorsements: endorsements.length,
      casting_calls: castingCalls.length,
      casting_apps: castingApps.length,
    });
  };

  const setAdminRole = async (userId, makeAdmin) => {
    await base44.entities.User.update(userId, { role: makeAdmin ? "admin" : "user" });
    toast.success(`User ${makeAdmin ? "promoted to admin" : "demoted to user"}`);
    await fetchData();
  };

  const manualVerify = async (profileId, field) => {
    await base44.entities.Profile.update(profileId, { [field]: true });
    toast.success("Verification updated");
    await fetchData();
  };

  const togglePro = async (profile) => {
   // PRO is now managed via Subscription entity
   const subs = await base44.entities.Subscription.filter({ user_id: profile.user_id, status: "active" });
   if (subs.length > 0) {
     const newTier = subs[0].tier === "pro" ? "free" : "pro";
     await base44.entities.Subscription.update(subs[0].id, {
       tier: newTier,
       contact_reveal_limit: newTier === "pro" ? 20 : 5,
       casting_call_limit: newTier === "pro" ? 5 : 1,
       can_boost: newTier !== "free",
     });
     toast.success(`Tier changed to ${newTier}`);
   } else {
     await base44.entities.Subscription.create({
       user_id: profile.user_id,
       tier: "pro",
       status: "active",
       started_at: new Date().toISOString(),
       contact_reveal_limit: 20,
       casting_call_limit: 5,
       can_boost: true,
     });
     toast.success("PRO subscription created");
   }
   await fetchData();
  };

  const toggleBoost = async (profile) => {
    await base44.entities.Profile.update(profile.id, {
      is_boosted: !profile.is_boosted,
      boost_expires: !profile.is_boosted ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
    });
    toast.success(`Homepage boost ${!profile.is_boosted ? "activated" : "removed"}`);
    await fetchData();
  };

  const filteredUsers = users.filter(
    (u) => u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredProfiles = profiles.filter(
    (p) => p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.primary_role?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const TABS = ["users", "profiles", "stats"];

  return (
    <div className="pt-20 pb-16 px-4 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-primary" />
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Admin Dashboard</h1>
            </div>
            <p className="text-muted-foreground text-sm">Manage users, profiles, and platform settings</p>
          </div>
          <Button variant="outline" size="sm" className="border-border" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border pb-3 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-all ${tab === t ? "glass-gold text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t === "users" ? `Users (${stats.users})` : t === "profiles" ? `Profiles (${stats.profiles})` : "Stats"}
            </button>
          ))}
        </div>

        {/* Search */}
        {tab !== "stats" && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "users" ? "Search users..." : "Search profiles..."}
              className="pl-9 bg-secondary border-border"
            />
          </div>
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <div className="space-y-2">
            {filteredUsers.map((u) => (
              <div key={u.id} className="bg-card border border-border/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground text-sm">{u.full_name || "—"}</span>
                    <Badge variant="outline" className={`text-[10px] ${u.role === "admin" ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}`}>
                      {u.role || "user"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {u.id !== user.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={`text-xs h-7 ${u.role === "admin" ? "border-destructive/40 text-destructive hover:bg-destructive/10" : "border-primary/30 text-primary hover:bg-primary/10"}`}
                      onClick={() => setAdminRole(u.id, u.role !== "admin")}
                    >
                      <Crown className="w-3 h-3 mr-1" />
                      {u.role === "admin" ? "Remove Admin" : "Make Admin"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PROFILES TAB */}
        {tab === "profiles" && (
          <div className="space-y-2">
            {filteredProfiles.map((p) => (
              <div key={p.id} className="bg-card border border-border/60 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {p.profile_photo && (
                      <img src={p.profile_photo} alt="" className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-sm">{p.full_name}</span>
                        <span className="text-xs text-muted-foreground">{p.primary_role}</span>
                        <span
                          title={`Spot Score: ${p.spot_score || 0}`}
                          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{
                              background: (p.spot_score || 0) >= 70
                                ? "#4ade80"
                                : (p.spot_score || 0) >= 40
                                ? "#facc15"
                                : "#f87171",
                              boxShadow: (p.spot_score || 0) >= 70
                                ? "0 0 6px #4ade8088"
                                : (p.spot_score || 0) >= 40
                                ? "0 0 6px #facc1588"
                                : "0 0 6px #f8717188",
                            }}
                          />
                          {p.spot_score || 0}
                        </span>
                        {/* PRO badge now comes from Subscription — shown via tier */}
                        {p.is_boosted && <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400 border-0">Boosted</Badge>}
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {[
                          { label: "Email", val: p.email_verified },
                          { label: "Phone", val: p.phone_verified },
                          { label: "Union", val: p.union_verified },
                          { label: "IMDb", val: p.imdb_verified },
                        ].map((v) => (
                          <span key={v.label} className={`text-[10px] ${v.val ? "text-green-400" : "text-muted-foreground/40"}`}>
                            {v.val ? "✓" : "○"} {v.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {!p.email_verified && (
                      <Button size="sm" variant="outline" className="text-xs h-7 border-green-500/30 text-green-400 hover:bg-green-500/10"
                        onClick={() => manualVerify(p.id, "email_verified")}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Verify Email
                      </Button>
                    )}
                    {!p.phone_verified && (
                      <Button size="sm" variant="outline" className="text-xs h-7 border-green-500/30 text-green-400 hover:bg-green-500/10"
                        onClick={() => manualVerify(p.id, "phone_verified")}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Verify Phone
                      </Button>
                    )}
                    {!p.imdb_verified && (
                      <Button size="sm" variant="outline" className="text-xs h-7 border-green-500/30 text-green-400 hover:bg-green-500/10"
                        onClick={() => manualVerify(p.id, "imdb_verified")}>
                        <Film className="w-3 h-3 mr-1" /> Verify IMDb
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className={`text-xs h-7 ${p._sub?.tier === "pro" ? "border-primary/60 bg-primary/10 text-primary" : "border-primary/30 text-primary/60"}`}
                      onClick={() => togglePro(p)}
                    >
                      <Crown className="w-3 h-3 mr-1" /> 
                      {p._sub?.tier === "pro" ? "PRO ✓" : "Free"}
                    </Button>
                    <Button size="sm" variant="outline" className={`text-xs h-7 ${p.is_boosted ? "border-destructive/40 text-destructive" : "border-yellow-500/30 text-yellow-400"}`}
                      onClick={() => toggleBoost(p)}>
                      <Zap className="w-3 h-3 mr-1" /> {p.is_boosted ? "Remove Boost" : "Boost"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STATS TAB */}
        {tab === "stats" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Total Users", value: stats.users, icon: Users },
              { label: "Profiles Created", value: stats.profiles, icon: Film },
              { label: "Email Verified", value: stats.verified_email, icon: CheckCircle2 },
              { label: "Phone Verified", value: stats.verified_phone, icon: CheckCircle2 },
              { label: "PRO Members", value: stats.pro, icon: Crown },
              { label: "Homepage Boosted", value: stats.boosted, icon: Zap },
              { label: "Endorsements", value: stats.endorsements, icon: Award },
              { label: "Casting Calls", value: stats.casting_calls, icon: Film },
              { label: "Applications", value: stats.casting_apps, icon: Users },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border/60 rounded-xl p-5">
                <s.icon className="w-4 h-4 text-primary mb-2" />
                <p className="font-display text-2xl font-bold text-foreground">{s.value ?? "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}