import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  Shield, Users, Film, CheckCircle2, Crown, Search, RefreshCw, Award, Zap,
  Building2, Mail, Server, BarChart3, FileText, EyeOff, Eye, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const TABS = [
  { id: "users",    label: "Users",    icon: Users },
  { id: "profiles", label: "Profiles", icon: Film },
  { id: "casting",  label: "Casting",  icon: Award },
  { id: "imports",  label: "Imports",  icon: Building2 },
  { id: "emails",   label: "Emails",   icon: Mail },
  { id: "platform", label: "Platform", icon: Server },
  { id: "stats",    label: "Stats",    icon: BarChart3 },
  { id: "logs",     label: "Logs",     icon: FileText },
];

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("users");
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
      if (!me || me.role !== "admin") { window.location.href = "/"; return; }
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

  const lc = (s) => (s || "").toLowerCase();
  const filteredUsers = users.filter((u) => lc(u.full_name).includes(lc(search)) || lc(u.email).includes(lc(search)));
  const filteredProfiles = profiles.filter((p) => lc(p.full_name).includes(lc(search)) || lc(p.primary_role).includes(lc(search)));
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
            <p className="text-muted-foreground text-sm">7-tab admin · users · profiles · casting · imports · emails · platform · stats · logs</p>
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
        {["users", "profiles", "casting", "imports"].includes(tab) && (
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

        {/* USERS */}
        {tab === "users" && (
          <div className="space-y-2" data-testid="admin-users-tab">
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
                {u.id !== user.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className={`text-xs h-7 ${u.role === "admin" ? "border-destructive/40 text-destructive" : "border-primary/30 text-primary"}`}
                    onClick={() => setAdminRole(u.id, u.role !== "admin")}
                  >
                    <Crown className="w-3 h-3 mr-1" />
                    {u.role === "admin" ? "Remove Admin" : "Make Admin"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* PROFILES */}
        {tab === "profiles" && (
          <div className="space-y-2" data-testid="admin-profiles-tab">
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
                        {p.is_minor_profile && <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-0">Minor</Badge>}
                        {p.is_hidden && <Badge className="text-[10px] bg-destructive/20 text-destructive border-0">Hidden</Badge>}
                        {p.is_boosted && <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400 border-0">Boosted</Badge>}
                        <span className="text-[10px] text-muted-foreground">SpotScore {p.spot_score || 0}</span>
                      </div>
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

        {/* IMPORTS */}
        {tab === "imports" && (
          <div data-testid="admin-imports-tab">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-card border border-border rounded-xl p-4"><p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Total</p><p className="font-display text-2xl font-bold">{imports.total}</p></div>
              <div className="bg-card border border-border rounded-xl p-4"><p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Claimed</p><p className="font-display text-2xl font-bold text-green-400">{imports.claimed}</p></div>
              <div className="bg-card border border-border rounded-xl p-4"><p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Unclaimed</p><p className="font-display text-2xl font-bold text-amber-400">{imports.unclaimed}</p></div>
            </div>
            <div className="space-y-2">
              {filteredImports.map((p) => (
                <div key={p.id} className="bg-card border border-border/60 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                    {p.profile_photo && <img src={p.profile_photo} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{p.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{p.email}</p>
                  </div>
                  <Badge className={`text-[10px] ${(p.welcome_email_sent || p.auto_claim_dismissed) ? "bg-green-500/15 text-green-400 border-0" : "bg-amber-500/15 text-amber-400 border-0"}`}>
                    {(p.welcome_email_sent || p.auto_claim_dismissed) ? "Claimed" : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EMAILS */}
        {tab === "emails" && (
          <div className="space-y-2" data-testid="admin-emails-tab">
            <div className="flex justify-end">
              <Button size="sm" variant="outline" className="border-primary/30 text-primary" onClick={sendNudges} disabled={sendingNudges} data-testid="admin-send-nudges-btn">
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
                <p className="text-xs text-muted-foreground mt-1 truncate">→ {e.to}</p>
              </div>
            ))}
          </div>
        )}

        {/* PLATFORM */}
        {tab === "platform" && platform && (
          <div className="space-y-6" data-testid="admin-platform-tab">
            {/* Editable settings */}
            <div className="bg-card border border-border/60 rounded-xl p-5">
              <p className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground mb-3">Settings</p>
              <FounderCapEditor
                current={platform.settings?.founder_cap ?? 100}
                onSaved={() => loadPlatform()}
              />
            </div>

            {/* Launch checklist */}
            {platform.checklist && (
              <div className="bg-card border border-border/60 rounded-xl p-5" data-testid="admin-launch-checklist">
                <p className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground mb-3">Launch checklist</p>
                <ul className="space-y-2">
                  {platform.checklist.map((item) => (
                    <li key={item.key} className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0" data-testid={`launch-checklist-${item.key}`}>
                      <span className="flex items-center gap-2 text-sm">
                        {item.ok ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-destructive">✗</span>
                        )}
                        <span className="text-foreground">{item.label}</span>
                      </span>
                      <span className={`text-xs font-mono ${item.ok ? "text-green-400" : "text-amber-400"}`}>{item.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Platform stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "ENV", value: platform.env },
                { label: "Email mock", value: platform.email_mock ? "ON" : "OFF" },
                { label: "SMS mock", value: platform.sms_mock ? "ON" : "OFF" },
                { label: "Founders", value: platform.founder_count },
                { label: "Users", value: platform.user_count },
                { label: "Profiles", value: platform.profile_count },
                { label: "Casting calls", value: platform.casting_calls },
                { label: "Applications", value: platform.applications },
                { label: "Endorsements", value: platform.endorsements },
                { label: "Notifications", value: platform.notifications },
              ].map((s) => (
                <div key={s.label} className="bg-card border border-border/60 rounded-xl p-5">
                  <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">{s.label}</p>
                  <p className="font-display text-2xl font-bold text-foreground mt-1">{String(s.value)}</p>
                </div>
              ))}
            </div>
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

        {/* LOGS */}
        {tab === "logs" && (
          <div className="space-y-2" data-testid="admin-logs-tab">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No admin actions logged yet.</p>
            ) : logs.map((l) => (
              <div key={l.id} className="bg-card border border-border/60 rounded-xl p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-foreground"><strong className="font-mono text-primary text-xs uppercase tracking-wider">{l.action}</strong> · target {l.target || "—"}</p>
                  <span className="text-[10px] uppercase tracking-[0.06em] font-mono text-muted-foreground">{new Date(l.created_date).toLocaleString()}</span>
                </div>
                {l.meta && Object.keys(l.meta).length > 0 && (
                  <pre className="mt-1 text-[10px] font-mono text-muted-foreground overflow-x-auto">{JSON.stringify(l.meta, null, 2)}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FounderCapEditor({ current, onSaved }) {
  const [val, setVal] = useState(current);
  const [saving, setSaving] = useState(false);

  // Keep local state in sync if parent reloads
  useEffect(() => { setVal(current); }, [current]);

  const save = async () => {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Cap must be a positive integer");
      return;
    }
    setSaving(true);
    try {
      await base44.http.put("/api/admin/platform-settings", { founder_cap: n });
      toast.success(`Founder cap set to ${n}`);
      onSaved?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <label className="text-sm text-foreground">Founding member cap:</label>
      <Input
        type="number"
        min="1"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-24 bg-secondary border-border h-9"
        data-testid="founder-cap-input"
      />
      <Button size="sm" onClick={save} disabled={saving} className="bg-primary text-primary-foreground" data-testid="founder-cap-save">
        {saving ? "Saving…" : "Save"}
      </Button>
      <span className="text-xs text-muted-foreground">All founder counters update within 5 minutes (cache-aware).</span>
    </div>
  );
}
