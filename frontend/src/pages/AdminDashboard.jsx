import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  Shield, Users, Film, CheckCircle2, Crown, Search, RefreshCw, Award, Zap,
  Building2, Mail, Server, BarChart3, FileText, EyeOff, Eye, Send, Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import EmailComposer from "../components/admin/EmailComposer";

const TABS = [
  { id: "profiles",  label: "Profiles",  icon: Film },
  { id: "casting",   label: "Casting",   icon: Award },
  { id: "spotlight", label: "Spotlight", icon: Sparkles },
  { id: "emails",    label: "Emails",    icon: Mail },
  { id: "stats",     label: "Stats",     icon: BarChart3 },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("profiles");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Data caches per tab — loaded lazily on first activation
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [castingCalls, setCastingCalls] = useState([]);
  const [imports, setImports] = useState({ total: 0, claimed: 0, unclaimed: 0, items: [] });
  const [emails, setEmails] = useState([]);
  const [platform, setPlatform] = useState(null);
  const [stats, setStats] = useState({});
  const [logs, setLogs] = useState([]);
  const [sendingNudges, setSendingNudges] = useState(false);

  // Auth gate
  useEffect(() => {
    const init = async () => {
      const me = await base44.auth.me().catch(() => null);
      if (!me || me.role !== "admin") { navigate("/"); return; }
      setUser(me);
      await loadCore();
      setLoading(false);
    };
    init();
  }, []);

  const loadCore = async () => {
    const [allUsers, allProfiles, subs] = await Promise.all([
      base44.entities.User.list("-created_date", 500),
      base44.entities.Profile.list("-created_date", 500),
      base44.entities.Subscription.list("-created_date", 500),
    ]);
    const profilesWithSubs = allProfiles.map((p) => ({
      ...p,
      _sub: subs.find((s) => s.user_id === p.user_id && s.status === "active"),
      _user: allUsers.find((u) => u.id === p.user_id),
    }));
    setUsers(allUsers);
    setProfiles(profilesWithSubs);
    setStats((s) => ({
      ...s,
      users: allUsers.length,
      profiles: allProfiles.length,
      verified_email: allProfiles.filter((p) => p.email_verified).length,
      pro: subs.filter((s) => s.status === "active" && s.tier === "pro").length,
      elite: subs.filter((s) => s.status === "active" && s.tier === "elite").length,
      founder: subs.filter((s) => s.status === "active" && s.tier === "founder").length,
      boosted: allProfiles.filter((p) => p.is_boosted).length,
      hidden: allProfiles.filter((p) => p.is_hidden).length,
      minors: allProfiles.filter((p) => p.is_minor_profile).length,
    }));
  };

  // Lazy loaders — invoked on tab activation
  const loadCasting = useCallback(async () => {
    const { data } = await base44.http.get("/api/admin/casting-calls");
    setCastingCalls(data);
  }, []);
  const loadImports = useCallback(async () => {
    const { data } = await base44.http.get("/api/admin/imports");
    setImports(data);
  }, []);
  const loadEmails = useCallback(async () => {
    const { data } = await base44.http.get("/api/admin/emails");
    setEmails(data);
  }, []);
  const loadPlatform = useCallback(async () => {
    const [{ data: plat }, { data: settings }, { data: checklist }] = await Promise.all([
      base44.http.get("/api/admin/platform"),
      base44.http.get("/api/admin/platform-settings"),
      base44.http.get("/api/admin/launch-checklist"),
    ]);
    setPlatform({ ...plat, settings, checklist: checklist.items });
  }, []);
  const loadLogs = useCallback(async () => {
    const { data } = await base44.http.get("/api/admin/logs");
    setLogs(data);
  }, []);

  useEffect(() => {
    if (tab === "casting" && castingCalls.length === 0) loadCasting();
    if (tab === "imports" && imports.items.length === 0) loadImports();
    if (tab === "emails" && emails.length === 0) loadEmails();
    if (tab === "platform" && !platform) loadPlatform();
    if (tab === "logs" && logs.length === 0) loadLogs();
  }, [tab, castingCalls.length, imports.items.length, emails.length, platform, logs.length, loadCasting, loadImports, loadEmails, loadPlatform, loadLogs]);

  // Actions
  const setAdminRole = async (userId, makeAdmin) => {
    await base44.entities.User.update(userId, { role: makeAdmin ? "admin" : "user" });
    toast.success(`User ${makeAdmin ? "promoted" : "demoted"}`);
    loadCore();
  };
  const manualVerify = async (profileId, field) => {
    await base44.entities.Profile.update(profileId, { [field]: true });
    toast.success("Verification updated");
    loadCore();
  };
  const togglePro = async (p) => {
    const subs = await base44.entities.Subscription.filter({ user_id: p.user_id, status: "active" });
    if (subs.length > 0 && (subs[0].tier === "founder" || subs[0].tier === "elite")) {
      toast.error("Protected tier — cannot override founder/elite via toggle.");
      return;
    }
    if (subs.length > 0) {
      const newTier = subs[0].tier === "pro" ? "free" : "pro";
      await base44.entities.Subscription.update(subs[0].id, {
        tier: newTier,
        contact_reveal_limit: newTier === "pro" ? -1 : 5,
        casting_call_limit: newTier === "pro" ? 5 : 1,
        can_boost: newTier !== "free",
      });
      toast.success(`Tier → ${newTier}`);
    } else {
      await base44.entities.Subscription.create({
        user_id: p.user_id, tier: "pro", status: "active",
        started_at: new Date().toISOString(), contact_reveal_limit: -1,
        casting_call_limit: 5, can_boost: true,
      });
      toast.success("PRO subscription created");
    }
    loadCore();
  };
  const toggleHidden = async (p) => {
    await base44.http.post(`/api/admin/profile/${p.id}/flag`, { is_hidden: !p.is_hidden });
    toast.success(`Profile ${p.is_hidden ? "shown" : "hidden"}`);
    loadCore();
  };
  const toggleBoost = async (p) => {
    await base44.entities.Profile.update(p.id, {
      is_boosted: !p.is_boosted,
      boost_expires: !p.is_boosted ? new Date(Date.now() + 30 * 86400000).toISOString() : null,
    });
    toast.success(`Boost ${!p.is_boosted ? "on" : "off"}`);
    loadCore();
  };
  const sendNudges = async () => {
    setSendingNudges(true);
    try {
      const { data } = await base44.http.post("/api/functions/sendProfileCompletionNudges", {});
      toast.success(`Sent ${data.sent} nudge${data.sent === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error("Failed to trigger nudges");
    } finally {
      setSendingNudges(false);
    }
  };
  const [resendingWelcomes, setResendingWelcomes] = useState(false);
  const sendPendingWelcomes = async () => {
    if (!window.confirm(`Send the founding-member welcome email to all ${imports.unclaimed} unclaimed imported member${imports.unclaimed === 1 ? "" : "s"}?`)) return;
    setResendingWelcomes(true);
    try {
      const { data } = await base44.http.post("/api/admin/send-pending-welcomes", {});
      toast.success(`Queued ${data.count} welcome email${data.count === 1 ? "" : "s"}`);
      loadImports();
    } catch (e) {
      toast.error("Failed to queue welcome emails");
    } finally {
      setResendingWelcomes(false);
    }
  };

  // Manual founding-member flag — for users who claimed outside the
  // verify-code flow (e.g. external sign-ups, post-cap exceptions).
  const [flagInput, setFlagInput] = useState("");
  const [flagBusy, setFlagBusy] = useState(false);
  const flagFoundingMember = async (claimed) => {
    const v = flagInput.trim();
    if (!v) {
      toast.error("Enter an email or profile slug");
      return;
    }
    setFlagBusy(true);
    try {
      const body = v.includes("@") ? { email: v, claimed } : { profile_slug: v, claimed };
      const { data } = await base44.http.post("/api/admin/flag-founding-member", body);
      const u = data.user || {};
      toast.success(`${claimed ? "Flagged" : "Unflagged"} ${u.full_name || u.email} as founding member`);
      setFlagInput("");
      loadCore();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Flag failed");
    } finally {
      setFlagBusy(false);
    }
  };

  const lc = (s) => (s || "").toLowerCase();
  const filteredUsers = users.filter((u) => lc(u.full_name).includes(lc(search)) || lc(u.email).includes(lc(search)));
  const filteredProfiles = profiles.filter((p) =>
    lc(p.full_name).includes(lc(search)) ||
    lc(p.primary_role).includes(lc(search)) ||
    lc(p._user?.email).includes(lc(search))
  );
  const filteredCasting = castingCalls.filter((c) => lc(c.project_title).includes(lc(search)) || lc(c.creator_email).includes(lc(search)));
  const filteredImports = imports.items.filter((p) => lc(p.full_name).includes(lc(search)) || lc(p.email).includes(lc(search)));

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-20 pb-16 px-4 min-h-screen" data-testid="admin-dashboard">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-primary" />
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Admin Dashboard</h1>
            </div>
            <p className="text-muted-foreground text-sm">5-tab admin · profiles · casting · spotlight · emails · stats</p>
          </div>
          <Button variant="outline" size="sm" className="border-border" onClick={loadCore} data-testid="admin-refresh-btn">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border pb-3 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-testid={`admin-tab-${id}`}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${tab === id ? "glass-gold text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        {["profiles", "casting", "imports"].includes(tab) && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab}…`}
              className="pl-9 bg-secondary border-border"
              data-testid="admin-search-input"
            />
          </div>
        )}

        {/* PROFILES (merged with Users — Make Admin lives here too) */}
        {tab === "profiles" && (
          <div className="space-y-2" data-testid="admin-profiles-tab">
            {/* Manual founding-member flag — relocated here from the now-removed Imports tab */}
            <div className="bg-card border border-border/60 rounded-xl p-4 mb-4" data-testid="manual-founding-flag-card">
              <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">Manual founding-member flag</p>
              <p className="text-xs text-muted-foreground mb-3">
                Use this for users who claimed their spot outside the email-verification flow (e.g. external sign-ups, post-cap exceptions). Enter an email or profile slug.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Input
                  value={flagInput}
                  onChange={(e) => setFlagInput(e.target.value)}
                  placeholder="email@example.com or profile-slug"
                  className="bg-secondary border-border flex-1 min-w-[200px] text-sm"
                  data-testid="manual-founding-flag-input"
                />
                <Button
                  size="sm"
                  onClick={() => flagFoundingMember(true)}
                  disabled={flagBusy || !flagInput.trim()}
                  className="bg-primary text-primary-foreground"
                  data-testid="manual-founding-flag-claim-btn"
                >
                  Flag as founder
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => flagFoundingMember(false)}
                  disabled={flagBusy || !flagInput.trim()}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  data-testid="manual-founding-flag-unclaim-btn"
                >
                  Unflag
                </Button>
              </div>
            </div>

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
                        {p._user?.role === "admin" && <Badge className="text-[10px] bg-primary/15 text-primary border-0">Admin</Badge>}
                        {p.is_minor_profile && <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-0">Minor</Badge>}
                        {p.is_hidden && <Badge className="text-[10px] bg-destructive/20 text-destructive border-0">Hidden</Badge>}
                        {p.is_boosted && <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400 border-0">Boosted</Badge>}
                        <span className="text-[10px] text-muted-foreground">SpotScore {p.spot_score || 0}</span>
                      </div>
                      {/* User email — kept here so the merged Users+Profiles tab is still searchable by email */}
                      {p._user?.email && (
                        <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate font-mono">{p._user.email}</p>
                      )}
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {[
                          { label: "Email", val: p.email_verified, field: "email_verified" },
                          { label: "Union", val: p.union_verified, field: "union_verified" },
                          { label: "IMDb",  val: p.imdb_verified,  field: "imdb_verified"  },
                        ].map((v) => (
                          <span key={v.label} className={`text-[10px] ${v.val ? "text-green-400" : "text-muted-foreground/40"}`}>{v.val ? "✓" : "○"} {v.label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {p._user && p._user.id !== user.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className={`text-xs h-7 ${p._user.role === "admin" ? "border-destructive/40 text-destructive" : "border-primary/30 text-primary"}`}
                        onClick={() => setAdminRole(p._user.id, p._user.role !== "admin")}
                        data-testid={`admin-toggle-role-${p._user.id}`}
                      >
                        <Crown className="w-3 h-3 mr-1" />
                        {p._user.role === "admin" ? "Remove Admin" : "Make Admin"}
                      </Button>
                    )}
                    {!p.email_verified && (
                      <Button size="sm" variant="outline" className="text-xs h-7 border-green-500/30 text-green-400" onClick={() => manualVerify(p.id, "email_verified")}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Verify Email
                      </Button>
                    )}
                    {p._sub?.tier === "founder" || p._sub?.tier === "elite" ? (
                      <div className="text-xs text-destructive flex items-center">Protected tier</div>
                    ) : (
                      <Button size="sm" variant="outline" className={`text-xs h-7 ${p._sub?.tier === "pro" ? "border-primary/60 bg-primary/10 text-primary" : "border-primary/30 text-primary/60"}`} onClick={() => togglePro(p)}>
                        <Crown className="w-3 h-3 mr-1" /> {p._sub?.tier === "pro" ? "PRO ✓" : "Free"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className={`text-xs h-7 ${p.is_boosted ? "border-destructive/40 text-destructive" : "border-yellow-500/30 text-yellow-400"}`} onClick={() => toggleBoost(p)}>
                      <Zap className="w-3 h-3 mr-1" /> {p.is_boosted ? "Remove Boost" : "Boost"}
                    </Button>
                    <Button size="sm" variant="outline" data-testid={`admin-toggle-hidden-${p.id}`} className={`text-xs h-7 ${p.is_hidden ? "border-green-500/30 text-green-400" : "border-destructive/40 text-destructive"}`} onClick={() => toggleHidden(p)}>
                      {p.is_hidden ? <><Eye className="w-3 h-3 mr-1" /> Unhide</> : <><EyeOff className="w-3 h-3 mr-1" /> Hide</>}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CASTING */}
        {tab === "casting" && (
          <div className="space-y-2" data-testid="admin-casting-tab">
            {filteredCasting.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No casting calls.</p>
            ) : filteredCasting.map((c) => (
              <div key={c.id} className="bg-card border border-border/60 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm">{c.project_title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.project_type || "Project"} · {c.creator_name || c.creator_email || "Unknown"}{c.posted_as === "company" ? ` · as ${c.posted_as_company_name}` : ""}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.06em] font-mono text-muted-foreground mt-1">
                      {c.application_count || 0} app · {c.is_active ? "active" : "inactive"} · deadline {c.deadline ? new Date(c.deadline).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs h-7 border-border" onClick={async () => {
                    await base44.entities.CastingCall.update(c.id, { is_active: !c.is_active });
                    toast.success(`Casting ${!c.is_active ? "activated" : "deactivated"}`);
                    loadCasting();
                  }}>
                    {c.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SPOTLIGHT — manual pin manager */}
        {tab === "spotlight" && <SpotlightTab profiles={profiles} />}

        {/* EMAILS */}
        {tab === "emails" && (
          <div className="space-y-4" data-testid="admin-emails-tab">
            <EmailComposer onSent={loadEmails} />

            <div className="flex items-center justify-between mt-6 mb-2">
              <h3 className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground">Recent email log</h3>
              <Button size="sm" variant="outline" className="border-primary/30 text-primary h-8" onClick={sendNudges} disabled={sendingNudges} data-testid="admin-send-nudges-btn">
                <Send className="w-3.5 h-3.5 mr-1" /> {sendingNudges ? "Sending…" : "Run completion nudges now"}
              </Button>
            </div>
            {emails.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No email log entries yet.</p>
            ) : emails.map((e) => (
              <div key={e.id || e.created_date} className="bg-card border border-border/60 rounded-xl p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">{e.subject || e.to || "Email"}</p>
                  <span className="text-[10px] uppercase tracking-[0.06em] font-mono text-muted-foreground">{e.created_date ? new Date(e.created_date).toLocaleString() : ""}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">→ {e.to} {e.status ? `· ${e.status}` : ""}</p>
              </div>
            ))}
          </div>
        )}

        {/* STATS */}
        {tab === "stats" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="admin-stats-tab">
            {[
              { label: "Total users",    value: stats.users,          icon: Users },
              { label: "Profiles",       value: stats.profiles,       icon: Film },
              { label: "Email verified", value: stats.verified_email, icon: CheckCircle2 },
              { label: "PRO",            value: stats.pro,            icon: Crown },
              { label: "Elite",          value: stats.elite,          icon: Crown },
              { label: "Founder",        value: stats.founder,        icon: Crown },
              { label: "Boosted",        value: stats.boosted,        icon: Zap },
              { label: "Hidden",         value: stats.hidden,         icon: EyeOff },
              { label: "Minor",          value: stats.minors,         icon: Users },
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

function SpotlightTab({ profiles }) {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await base44.http.get("/api/admin/spotlight-pins");
      setPins(data || []);
    } catch (e) {
      toast.error("Couldn't load pins");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pin = async (profile) => {
    setBusy(true);
    try {
      await base44.http.post("/api/admin/spotlight-pin", {
        profile_id: profile.id,
        // 30-day default — admin can clear early via the trash icon below.
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        position: 0,
      });
      toast.success(`Pinned ${profile.full_name} to homepage spotlight`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't pin profile");
    } finally {
      setBusy(false);
    }
  };

  const unpin = async (pinId) => {
    setBusy(true);
    try {
      await base44.http.delete(`/api/admin/spotlight-pin/${pinId}`);
      toast.success("Pin removed");
      await load();
    } catch (e) {
      toast.error("Couldn't remove pin");
    } finally {
      setBusy(false);
    }
  };

  const term = search.toLowerCase().trim();
  // Build a set of already-pinned profile IDs so they don't appear in the
  // "Pin a new profile" picker — fixes the duplicate-row issue where pinned
  // profiles would still show with another "Pin" button.
  const pinnedIds = new Set(pins.map((p) => p.profile_id || p.profile?.id || p.target_id).filter(Boolean));
  const candidates = (profiles || [])
    .filter((p) => !p.is_minor_profile)
    .filter((p) => !pinnedIds.has(p.id))
    .filter((p) => !term || `${p.full_name || ""} ${p._user?.email || ""}`.toLowerCase().includes(term))
    .slice(0, 12);

  return (
    <div data-testid="admin-spotlight-tab" className="space-y-6">
      {/* Active pins */}
      <div>
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Active spotlight pins</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : pins.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pins yet. The homepage will fall back to founding members or the top-SpotScore profile until you pin someone.
          </p>
        ) : (
          <div className="space-y-2">
            {pins.map((p) => (
              <div key={p.id} className="bg-card border border-border/60 rounded-xl p-3 flex items-center gap-3" data-testid={`pin-row-${p.id}`}>
                <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                  {p.profile?.profile_photo && (
                    <img src={p.profile.profile_photo} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{p.profile?.full_name || "(missing)"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.kind} · expires {p.expires_at ? new Date(p.expires_at).toLocaleDateString() : "never"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border h-8"
                  disabled={busy}
                  onClick={() => unpin(p.id)}
                  data-testid={`unpin-${p.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pick a profile to pin */}
      <div>
        <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Pin a new profile</h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search profiles by name or email…"
            className="pl-9 bg-secondary border-border"
            data-testid="spotlight-search"
          />
        </div>
        <div className="space-y-2">
          {candidates.map((p) => (
            <div key={p.id} className="bg-card border border-border/60 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                {p.profile_photo && <img src={p.profile_photo} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{p.full_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">SpotScore {p.spot_score || 0} · {p.primary_role || "—"}</p>
              </div>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => pin(p)}
                className="bg-primary text-primary-foreground h-8"
                data-testid={`pin-${p.id}`}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Pin (30 days)
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

