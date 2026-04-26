import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Users, Loader2, ExternalLink, Film } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { toast } from "sonner";

const COLUMNS = [
  { key: "pending",     label: "New",          color: "#888",    bg: "rgba(255,255,255,0.04)" },
  { key: "viewed",      label: "Viewed",        color: "#534AB7", bg: "rgba(83,74,183,0.08)" },
  { key: "shortlisted", label: "Shortlisted",   color: "#E8FC6C", bg: "rgba(232,252,108,0.06)" },
  { key: "booked",      label: "Booked",        color: "#22C55E", bg: "rgba(34,197,94,0.06)" },
  { key: "rejected",    label: "Rejected",      color: "#FF5C35", bg: "rgba(255,92,53,0.06)" },
];

function ApplicantCard({ app, profileMap, onMove, moving }) {
  const profile = profileMap[app.profile_id] || profileMap[`uid:${app.applicant_user_id}`];

  const tsField = { viewed: 'viewed_at', shortlisted: 'shortlisted_at', rejected: 'rejected_at', booked: 'booked_at' }[app.status];
  const tsValue = tsField && app[tsField];

  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-2" style={{ background: "#161616" }}>
      {/* Profile info */}
      <div className="flex items-center gap-2">
        {profile?.profile_photo ? (
          <img src={profile.profile_photo} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground">
            {profile?.full_name?.[0] || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{profile?.full_name || app.applicant_name || "Unknown"}</p>
            {app.is_self_apply && (
              <span data-testid="creator-badge" className="text-[9px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded font-bold" style={{ background: "#E8FC6C", color: "#0D0D0D" }}>
                Creator
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{profile?.primary_role || app.applicant_email}</p>
        </div>
        <Link to={`/profile/${profile?.profile_slug || app.profile_id}`} target="_blank">
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
        </Link>
      </div>

      {/* Role applied for */}
      {app.role_applied_for && (
        <div className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary inline-block">
          → {app.role_applied_for}
        </div>
      )}

      {/* Location */}
      {profile?.city && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="w-3 h-3" />
          {profile.city}{profile.state ? `, ${profile.state}` : ""}
        </div>
      )}

      {/* Showreel */}
      {app.submitted_showreel && (
        <a href={app.submitted_showreel} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-primary hover:underline">
          <Film className="w-3 h-3" /> View Showreel
        </a>
      )}

      {/* Note */}
      {(app.submitted_note || app.note) && (
        <p className="text-[11px] text-muted-foreground italic border-l-2 border-border pl-2 line-clamp-2">
          "{app.submitted_note || app.note}"
        </p>
      )}

      {/* SpotScore + timestamp */}
      <div className="flex items-center justify-between">
        {profile?.spot_score > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground font-mono">SpotScore</span>
            <span className="text-xs font-bold font-mono" style={{ color: "#E8FC6C" }}>{profile.spot_score}</span>
          </div>
        )}
        {tsValue && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(tsValue), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Move buttons */}
      <div className="flex flex-wrap gap-1 pt-1 border-t border-border/60">
        {COLUMNS.filter((c) => c.key !== app.status).map((col) => (
          <button
            key={col.key}
            onClick={() => onMove(app.id, col.key)}
            disabled={moving === app.id}
            className="text-[10px] px-2 py-0.5 rounded border border-border/60 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            → {col.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CastingApplicationsKanban() {
  const castingCallId = window.location.search.split("call=")[1]?.split("&")[0];

  const [castingCall, setCastingCall] = useState(null);
  const [applications, setApplications] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const load = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) { base44.auth.redirectToLogin(); return; }
      const me = await base44.auth.me();
      setUser(me);

      // Load casting call
      const calls = await base44.entities.CastingCall.filter({ id: castingCallId });
      if (!calls.length) { setLoading(false); return; }
      const call = calls[0];
      // Only the creator can view this
      if (call.creator_user_id !== me.id && me.role !== "admin") { setLoading(false); return; }
      setCastingCall(call);

      // Load applications
      const apps = await base44.entities.CastingApplication.filter({ casting_call_id: castingCallId }, "-created_date", 100);
      setApplications(apps);

      // Load profiles for all applicants — match by profile_id OR applicant_user_id
      const profileIds = [...new Set(apps.map((a) => a.profile_id).filter(Boolean))];
      const userIds = [...new Set(apps.map((a) => a.applicant_user_id).filter(Boolean))];
      const profileById = await Promise.all(
        profileIds.map(async (pid) => {
          const p = await base44.entities.Profile.filter({ id: pid });
          return [pid, p[0]];
        })
      );
      const profileByUid = await Promise.all(
        userIds.map(async (uid) => {
          const p = await base44.entities.Profile.filter({ user_id: uid });
          return [uid, p[0]];
        })
      );
      const map = Object.fromEntries(profileById.filter(([, p]) => p));
      profileByUid.forEach(([uid, p]) => {
        if (!p) return;
        // Index by user id too so card lookups can find it
        map[`uid:${uid}`] = p;
      });
      setProfileMap(map);
      setLoading(false);
    };
    load();
  }, [castingCallId]);

  const moveApp = async (appId, newStatus) => {
    setMoving(appId);
    const now = new Date().toISOString();
    const tsField = { viewed: 'viewed_at', shortlisted: 'shortlisted_at', rejected: 'rejected_at', booked: 'booked_at' }[newStatus];
    const update = { status: newStatus };
    if (tsField) update[tsField] = now;
    await base44.entities.CastingApplication.update(appId, update);
    setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, ...update } : a));
    setMoving(null);
    toast.success(`Moved to ${COLUMNS.find((c) => c.key === newStatus)?.label}`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!castingCall) {
    return (
      <div className="pt-32 text-center">
        <p className="text-muted-foreground">Casting call not found or you don't have access.</p>
        <Link to="/casting" className="text-primary text-sm mt-4 inline-block">← Back to casting calls</Link>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <Link to="/casting">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground mt-1">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground" style={{ letterSpacing: "-0.5px" }}>
              {castingCall.project_title}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-muted-foreground">{castingCall.project_type}</span>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                {applications.length} application{applications.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Kanban */}
        {applications.length === 0 ? (
          <div className="text-center py-24 border border-border/60 rounded-xl" style={{ background: "#111" }}>
            <Users className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-display text-lg font-semibold text-foreground">No applications yet</p>
            <p className="text-sm text-muted-foreground mt-1">Share your casting call to start receiving applicants.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {COLUMNS.map((col) => {
              const colApps = applications.filter((a) => a.status === col.key);
              return (
                <div key={col.key} className="rounded-xl p-4 border border-border/60 space-y-3" style={{ background: col.bg }}>
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] uppercase tracking-[0.08em] font-semibold" style={{ color: col.color }}>
                      {col.label}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">{colApps.length}</span>
                  </div>

                  {colApps.length === 0 && (
                    <p className="text-[11px] text-muted-foreground/50 text-center py-4">Empty</p>
                  )}

                  {colApps.map((app, i) => (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <ApplicantCard
                        app={app}
                        profileMap={profileMap}
                        onMove={moveApp}
                        moving={moving}
                      />
                    </motion.div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}