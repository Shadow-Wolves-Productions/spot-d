import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Crown, Eye, EyeOff, Zap, CheckCircle2, X, Sparkles, Star,
  Mail, Film, Award, Shield, Flag, AlertTriangle, ExternalLink,
  Calendar, MapPin, Globe, Linkedin, Instagram, ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Profile Command Table — cinematic moderation list for the Spot'd admin.
 *
 * Layout per spec:
 *   LEFT  — avatar, name, role, score, email, small verified-indicator row
 *   CENTER — compact status pills (Verified / PRO / Hidden / IMDb / Reported / etc.)
 *   RIGHT — grouped action buttons (Moderation / Promotion / Admin)
 *
 * Clicking a row opens a right-side slideout inspector with the full profile.
 *
 * Filter pills at the top (All / Pending Verification / Reported / Hidden /
 * PRO / Cast / Crew / Companies) plus search + sort. Designed for fast
 * scanning + low cognitive load.
 */

const FILTERS = [
  { key: "all",       label: "All Users" },
  { key: "pending",   label: "Pending Verification" },
  { key: "reported",  label: "Reported" },
  { key: "hidden",    label: "Hidden" },
  { key: "pro",       label: "PRO" },
  { key: "cast",      label: "Cast" },
  { key: "crew",      label: "Crew" },
];

const SORTS = [
  { key: "joined_desc",  label: "Recently Joined" },
  { key: "score_desc",   label: "SpotScore ↓" },
  { key: "score_asc",    label: "SpotScore ↑" },
  { key: "reports_desc", label: "Most Reports" },
  { key: "name_asc",     label: "Name A→Z" },
];

const CAST_ROLES = new Set(["Actor", "Voice Actor", "Performer", "Stunt Performer", "Dancer", "Singer", "Model"]);
const CREW_ROLES_HINT = ["Director", "Producer", "Writer", "Cinematographer", "Editor", "Sound", "Production", "Composer", "Costume", "Makeup", "Casting"];

function isCrewRole(role) {
  if (!role) return false;
  if (CAST_ROLES.has(role)) return false;
  return CREW_ROLES_HINT.some((c) => role.toLowerCase().includes(c.toLowerCase()));
}

function Initials({ name, photo, size = 36 }) {
  const initials = (name || "?")
    .split(/\s+/).slice(0, 2).map((s) => s[0] || "").join("").toUpperCase();
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        className="rounded-full object-cover border border-white/5 flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-display font-semibold text-[11px] tracking-wider flex-shrink-0"
      style={{ width: size, height: size, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}
    >
      {initials || "?"}
    </div>
  );
}

function Pill({ tone = "neutral", icon: Icon, children, title }) {
  const tones = {
    neutral: { bg: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.65)", border: "rgba(255,255,255,0.08)" },
    yellow:  { bg: "rgba(230,255,0,0.08)", color: "#E6FF00", border: "rgba(230,255,0,0.18)" },
    green:   { bg: "rgba(34,197,94,0.10)", color: "#34D399", border: "rgba(34,197,94,0.20)" },
    orange:  { bg: "rgba(255,92,53,0.10)", color: "#FF8A66", border: "rgba(255,92,53,0.22)" },
    red:     { bg: "rgba(239,68,68,0.10)", color: "#F87171", border: "rgba(239,68,68,0.22)" },
    blue:    { bg: "rgba(56,189,248,0.10)", color: "#60D7F8", border: "rgba(56,189,248,0.22)" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide whitespace-nowrap"
      style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}
      title={title}
    >
      {Icon && <Icon className="w-2.5 h-2.5" />}
      {children}
    </span>
  );
}

function ActionButton({ tone = "neutral", icon: Icon, children, ...props }) {
  // Tertiary by default; primary actions opt in via tone.
  const tones = {
    primary:   "bg-primary/15 text-primary hover:bg-primary/25 border-primary/30",
    danger:    "text-[#F87171] hover:bg-destructive/10 border-destructive/25",
    success:   "text-[#34D399] hover:bg-green-500/10 border-green-500/25",
    warn:      "text-[#FF8A66] hover:bg-orange-500/10 border-orange-500/25",
    info:      "text-[#60D7F8] hover:bg-sky-500/10 border-sky-500/25",
    neutral:   "text-foreground/70 hover:bg-white/5 border-white/8",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap ${tones[tone] || tones.neutral} ${props.className || ""}`}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </button>
  );
}

export default function ProfileCommandTable({
  profiles,
  currentUserId,
  onUserAction,         // (action, profile) => void   — "verify" | "hide" | "boost" | "pro" | "admin"
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("joined_desc");
  const [openId, setOpenId] = useState(null);

  // Derive a single computed list per render
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let arr = profiles.slice();

    arr = arr.filter((p) => {
      if (filter === "pending") return !p.email_verified;
      if (filter === "reported") return (p.report_count || 0) > 0;
      if (filter === "hidden") return p.is_hidden;
      if (filter === "pro") return p._sub?.tier === "pro" || p._sub?.tier === "elite" || p._sub?.tier === "founder";
      if (filter === "cast") return CAST_ROLES.has(p.primary_role);
      if (filter === "crew") return isCrewRole(p.primary_role);
      return true;
    });

    if (term) {
      arr = arr.filter((p) => {
        return [p.full_name, p.primary_role, p._user?.email, p.profile_slug, p.city]
          .filter(Boolean).map(String).map((s) => s.toLowerCase()).some((s) => s.includes(term));
      });
    }

    const cmp = {
      joined_desc:  (a, b) => (b._user?.created_date || b.created_date || "").localeCompare(a._user?.created_date || a.created_date || ""),
      score_desc:   (a, b) => (b.spot_score || 0) - (a.spot_score || 0),
      score_asc:    (a, b) => (a.spot_score || 0) - (b.spot_score || 0),
      reports_desc: (a, b) => (b.report_count || 0) - (a.report_count || 0),
      name_asc:     (a, b) => (a.full_name || "").localeCompare(b.full_name || ""),
    };
    return arr.sort(cmp[sort] || cmp.joined_desc);
  }, [profiles, filter, search, sort]);

  const counts = useMemo(() => {
    return {
      all: profiles.length,
      pending: profiles.filter((p) => !p.email_verified).length,
      reported: profiles.filter((p) => (p.report_count || 0) > 0).length,
      hidden: profiles.filter((p) => p.is_hidden).length,
      pro: profiles.filter((p) => ["pro", "elite", "founder"].includes(p._sub?.tier)).length,
      cast: profiles.filter((p) => CAST_ROLES.has(p.primary_role)).length,
      crew: profiles.filter((p) => isCrewRole(p.primary_role)).length,
    };
  }, [profiles]);

  const openProfile = filtered.find((p) => p.id === openId);

  return (
    <div className="space-y-3" data-testid="admin-profile-command-table">
      {/* Filter pills + search + sort */}
      <div className="rounded-xl p-2.5 border border-white/[0.06]" style={{ background: "#131418" }}>
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              data-testid={`admin-profile-filter-${f.key}`}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${filter === f.key ? "bg-primary text-primary-foreground" : "text-foreground/60 hover:text-foreground hover:bg-white/5"}`}
            >
              {f.label}
              <span className="ml-1.5 text-[10px] opacity-60">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, role, slug, city…"
              className="pl-8 h-8 text-sm border-white/[0.08]"
              style={{ background: "rgba(255,255,255,0.02)" }}
              data-testid="admin-profile-search"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-8 rounded text-[11px] border border-white/[0.08] px-2 text-foreground/80 cursor-pointer"
              style={{ background: "rgba(255,255,255,0.02)" }}
              data-testid="admin-profile-sort"
            >
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-12 text-center">No profiles match.</p>
      )}

      {/* Command rows */}
      <div className="space-y-px rounded-xl overflow-hidden border border-white/[0.06]" style={{ background: "#0F1014" }}>
        {filtered.map((p) => {
          const isAdmin = p._user?.role === "admin";
          const tier = p._sub?.tier;
          const tierProtected = tier === "founder" || tier === "elite";
          const reports = p.report_count || 0;
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              data-testid={`admin-profile-row-${p.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto] gap-3 items-center px-3 py-2.5 hover:bg-white/[0.025] transition-colors cursor-pointer"
              style={{ background: "#131418" }}
              onClick={() => setOpenId(p.id)}
              onKeyDown={(e) => { if (e.key === "Enter") setOpenId(p.id); }}
            >
              {/* LEFT — identity */}
              <div className="flex items-center gap-2.5 min-w-0">
                <Initials name={p.full_name} photo={p.profile_photo} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-foreground truncate">{p.full_name || "Unnamed"}</span>
                    {(p.spot_score ?? 0) > 0 && (
                      <span className="text-[10px] font-mono text-foreground/50">{p.spot_score}</span>
                    )}
                    {isAdmin && <Pill tone="blue" icon={Shield}>Admin</Pill>}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 min-w-0">
                    <span className="truncate">{p.primary_role || "—"}</span>
                    {p._user?.email && (
                      <>
                        <span className="text-foreground/20">·</span>
                        <span className="truncate font-mono text-[10.5px]">{p._user.email}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* CENTER — status pills */}
              <div className="hidden md:flex flex-wrap items-center gap-1">
                {p.email_verified
                  ? <Pill tone="green" icon={CheckCircle2}>Verified</Pill>
                  : <Pill tone="orange" icon={AlertTriangle}>Unverified</Pill>}
                {tier === "founder" && <Pill tone="yellow" icon={Crown}>Founder</Pill>}
                {tier === "elite" && <Pill tone="yellow" icon={Crown}>Elite</Pill>}
                {tier === "pro" && <Pill tone="yellow" icon={Crown}>PRO</Pill>}
                {p.is_boosted && <Pill tone="yellow" icon={Zap}>Boosted</Pill>}
                {p.is_hidden && <Pill tone="red" icon={EyeOff}>Hidden</Pill>}
                {p.imdb_link && <Pill tone="neutral" icon={Film}>IMDb</Pill>}
                {p.is_minor_profile && <Pill tone="orange">Minor</Pill>}
                {reports > 0 && <Pill tone="red" icon={Flag}>{reports}</Pill>}
              </div>

              {/* RIGHT — grouped actions */}
              <div className="flex items-center gap-1 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
                {/* MODERATION group — primary */}
                {!p.email_verified && (
                  <ActionButton tone="success" icon={CheckCircle2} onClick={() => onUserAction("verify", p)} data-testid={`admin-action-verify-${p.id}`}>
                    Verify
                  </ActionButton>
                )}
                <ActionButton tone={p.is_hidden ? "success" : "warn"} icon={p.is_hidden ? Eye : EyeOff} onClick={() => onUserAction("hide", p)} data-testid={`admin-action-hide-${p.id}`}>
                  {p.is_hidden ? "Unhide" : "Hide"}
                </ActionButton>

                {/* PROMOTION group — secondary */}
                {!tierProtected && (
                  <ActionButton tone={tier === "pro" ? "primary" : "neutral"} icon={Crown} onClick={() => onUserAction("pro", p)} data-testid={`admin-action-pro-${p.id}`}>
                    {tier === "pro" ? "PRO ✓" : "PRO"}
                  </ActionButton>
                )}
                <ActionButton tone={p.is_boosted ? "primary" : "neutral"} icon={Zap} onClick={() => onUserAction("boost", p)} data-testid={`admin-action-boost-${p.id}`}>
                  {p.is_boosted ? "Boosted ✓" : "Boost"}
                </ActionButton>

                {/* ADMIN group — tertiary, only for non-self */}
                {p._user && p._user.id !== currentUserId && (
                  <ActionButton tone={isAdmin ? "danger" : "neutral"} icon={Shield} onClick={() => onUserAction("admin", p)} data-testid={`admin-action-role-${p.id}`}>
                    {isAdmin ? "Revoke" : "Admin"}
                  </ActionButton>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slideout inspector */}
      {openProfile && (
        <ProfileInspector
          profile={openProfile}
          currentUserId={currentUserId}
          onClose={() => setOpenId(null)}
          onAction={onUserAction}
        />
      )}
    </div>
  );
}


function ProfileInspector({ profile: p, currentUserId, onClose, onAction }) {
  const isAdmin = p._user?.role === "admin";
  const tier = p._sub?.tier;
  const tierProtected = tier === "founder" || tier === "elite";

  // Lock body scroll while inspector is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex" data-testid="admin-profile-inspector">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className="ml-auto h-full w-full max-w-[480px] overflow-y-auto relative shadow-2xl"
        style={{
          background: "linear-gradient(180deg, #131418 0%, #0F1014 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 border-b border-white/[0.06]" style={{ background: "rgba(15,16,20,0.95)", backdropFilter: "blur(8px)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <Initials name={p.full_name} photo={p.profile_photo} size={32} />
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-foreground truncate">{p.full_name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{p.primary_role || "—"} · SpotScore {p.spot_score || 0}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-foreground/60 hover:text-foreground p-1.5" data-testid="admin-profile-inspector-close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Status grid */}
          <Section title="Status">
            <div className="flex flex-wrap gap-1.5">
              {p.email_verified
                ? <Pill tone="green" icon={CheckCircle2}>Email verified</Pill>
                : <Pill tone="orange" icon={AlertTriangle}>Email unverified</Pill>}
              {tier === "founder" && <Pill tone="yellow" icon={Crown}>Founding member</Pill>}
              {tier === "elite" && <Pill tone="yellow" icon={Crown}>Elite</Pill>}
              {tier === "pro" && <Pill tone="yellow" icon={Crown}>PRO</Pill>}
              {p.is_boosted && <Pill tone="yellow" icon={Zap}>Boosted</Pill>}
              {p.is_hidden && <Pill tone="red" icon={EyeOff}>Hidden</Pill>}
              {p.is_minor_profile && <Pill tone="orange">Minor</Pill>}
              {p.imdb_link && <Pill tone="neutral" icon={Film}>IMDb linked</Pill>}
              {(p.report_count || 0) > 0 && <Pill tone="red" icon={Flag}>{p.report_count} report{p.report_count === 1 ? "" : "s"}</Pill>}
              {isAdmin && <Pill tone="blue" icon={Shield}>Admin</Pill>}
            </div>
          </Section>

          {/* Quick actions */}
          <Section title="Actions">
            <div className="grid grid-cols-2 gap-1.5">
              {!p.email_verified && (
                <ActionButton tone="success" icon={CheckCircle2} onClick={() => onAction("verify", p)}>Verify email</ActionButton>
              )}
              <ActionButton tone={p.is_hidden ? "success" : "warn"} icon={p.is_hidden ? Eye : EyeOff} onClick={() => onAction("hide", p)}>
                {p.is_hidden ? "Unhide profile" : "Hide profile"}
              </ActionButton>
              {!tierProtected && (
                <ActionButton tone={tier === "pro" ? "primary" : "neutral"} icon={Crown} onClick={() => onAction("pro", p)}>
                  {tier === "pro" ? "Remove PRO" : "Grant PRO"}
                </ActionButton>
              )}
              <ActionButton tone={p.is_boosted ? "primary" : "neutral"} icon={Zap} onClick={() => onAction("boost", p)}>
                {p.is_boosted ? "Remove boost" : "Boost"}
              </ActionButton>
              {p._user && p._user.id !== currentUserId && (
                <ActionButton tone={isAdmin ? "danger" : "neutral"} icon={Shield} onClick={() => onAction("admin", p)}>
                  {isAdmin ? "Revoke admin" : "Make admin"}
                </ActionButton>
              )}
              <ActionButton tone="neutral" icon={Star} onClick={() => onAction("founder", p)}>
                {p._user?.is_founding_member ? "Unflag founder" : "Flag founder"}
              </ActionButton>
              <ActionButton tone="neutral" icon={Mail} onClick={() => onAction("resend_welcome", p)}>
                Resend welcome
              </ActionButton>
              <ActionButton tone="neutral" icon={ExternalLink} onClick={() => window.open(`/profile/${p.profile_slug || p.id}`, "_blank") }>
                View public
              </ActionButton>
            </div>
          </Section>

          {/* Bio + meta */}
          {p.bio && (
            <Section title="Bio">
              <p className="text-[12px] leading-relaxed text-foreground/80 whitespace-pre-wrap">{p.bio}</p>
            </Section>
          )}

          <Section title="Profile">
            <dl className="text-[11.5px] grid grid-cols-1 gap-1">
              <Row icon={MapPin} label="Location" value={[p.city, p.state, p.country].filter(Boolean).join(", ") || "—"} />
              <Row icon={Calendar} label="Joined" value={fmtDate(p._user?.created_date || p.created_date)} />
              <Row icon={Calendar} label="Updated" value={fmtDate(p.updated_date)} />
              <Row icon={Award} label="Experience" value={p.experience_level || "—"} />
              <Row icon={Award} label="Years" value={p.years_of_experience ?? "—"} />
              <Row icon={Mail} label="Email" value={p._user?.email || p.email || "—"} mono />
            </dl>
          </Section>

          {/* Social / external */}
          {(p.imdb_link || p.website || p.linkedin || p.instagram) && (
            <Section title="Links">
              <div className="flex flex-col gap-1">
                {p.imdb_link && <ExtLink icon={Film} label="IMDb" href={p.imdb_link} />}
                {p.website && <ExtLink icon={Globe} label="Website" href={p.website} />}
                {p.linkedin && <ExtLink icon={Linkedin} label="LinkedIn" href={p.linkedin} />}
                {p.instagram && <ExtLink icon={Instagram} label="Instagram" href={p.instagram} />}
              </div>
            </Section>
          )}

          {/* Subscription */}
          {p._sub && (
            <Section title="Subscription">
              <dl className="text-[11.5px] grid grid-cols-1 gap-1">
                <Row icon={Crown} label="Tier" value={String(p._sub.tier || "free").toUpperCase()} />
                <Row icon={Calendar} label="Started" value={fmtDate(p._sub.started_at || p._sub.created_date)} />
                <Row icon={Calendar} label="Renews" value={fmtDate(p._sub.next_billing_at)} />
                <Row icon={Sparkles} label="Status" value={p._sub.status || "—"} />
              </dl>
            </Section>
          )}

          <p className="text-[10px] text-foreground/30 font-mono pt-2">id: {p.id}</p>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] font-mono text-foreground/40 mb-2">{title}</p>
      {children}
    </div>
  );
}

function Row({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {Icon && <Icon className="w-3 h-3 text-foreground/40 flex-shrink-0" />}
      <span className="text-foreground/50 w-20 flex-shrink-0">{label}</span>
      <span className={`text-foreground/80 truncate ${mono ? "font-mono text-[11px]" : ""}`}>{value || "—"}</span>
    </div>
  );
}

function ExtLink({ icon: Icon, label, href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-[12px] text-foreground/80 hover:text-primary transition-colors py-0.5"
    >
      <Icon className="w-3 h-3" />
      <span className="font-mono text-[11px] truncate">{label}</span>
      <ExternalLink className="w-2.5 h-2.5 opacity-50 ml-auto" />
    </a>
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}

// Re-exported for any caller wanting the same atom styling.
export { Pill, ActionButton, Initials };
// Silence unused-import warnings for icons referenced only inside Pill children.
const _unused = { toast };
void _unused;
