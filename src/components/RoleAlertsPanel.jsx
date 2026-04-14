import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Plus, X, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const ROLES = [
  "Actor", "Director", "Producer", "Cinematographer", "Editor", "Writer",
  "Sound Designer", "Makeup Artist", "Gaffer", "1st AD", "VFX Artist", "Colorist", "Composer",
];

export default function RoleAlertsPanel({ user, profile }) {
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (!user) return;
    base44.entities.RoleAlert.filter({ user_id: user.id }).then((data) => {
      setAlert(data[0] || null);
      setLoading(false);
    });
  }, [user]);

  const save = async (patch) => {
    setSaving(true);
    const updated = { ...alert, ...patch };
    if (alert?.id) {
      await base44.entities.RoleAlert.update(alert.id, patch);
    } else {
      const created = await base44.entities.RoleAlert.create({
        user_id: user.id,
        profile_id: profile?.id || null,
        is_active: true,
        email_notifications: true,
        roles: [],
        keywords: [],
        ...patch,
      });
      updated.id = created.id;
    }
    setAlert(updated);
    setSaving(false);
  };

  const toggleRole = async (role) => {
    const current = alert?.roles || [];
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    await save({ roles: next });
  };

  const addKeyword = async () => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return;
    const current = alert?.keywords || [];
    if (current.includes(kw)) { setKeyword(""); return; }
    await save({ keywords: [...current, kw] });
    setKeyword("");
    toast.success(`Keyword "${kw}" added`);
  };

  const removeKeyword = async (kw) => {
    const current = alert?.keywords || [];
    await save({ keywords: current.filter((k) => k !== kw) });
  };

  const toggleActive = () => save({ is_active: !alert?.is_active });
  const toggleEmail = () => save({ email_notifications: !alert?.email_notifications });

  if (loading) {
    return (
      <div className="bg-card border border-border/60 rounded-xl p-6 flex items-center justify-center h-32">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isActive = alert?.is_active ?? true;
  const emailOn = alert?.email_notifications ?? true;
  const selectedRoles = alert?.roles || [];
  const keywords = alert?.keywords || [];

  return (
    <div className="bg-card border border-border/60 rounded-xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-[0.08em]">
            Role Alerts
          </h3>
        </div>
        <button onClick={toggleActive} disabled={saving} className="text-muted-foreground hover:text-foreground transition-colors">
          {isActive
            ? <ToggleRight className="w-6 h-6 text-primary" />
            : <ToggleLeft className="w-6 h-6" />}
        </button>
      </div>

      {!isActive && (
        <p className="text-xs text-muted-foreground">Alerts are paused. Toggle to re-enable.</p>
      )}

      {isActive && (
        <>
          {/* Role chips */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Alert me for these roles:</p>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((role) => {
                const on = selectedRoles.includes(role);
                return (
                  <button
                    key={role}
                    onClick={() => toggleRole(role)}
                    disabled={saving}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                      on
                        ? "border-primary text-black"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                    style={on ? { background: "#E8FC6C" } : {}}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
            {profile?.primary_role && !selectedRoles.includes(profile.primary_role) && (
              <button
                onClick={() => toggleRole(profile.primary_role)}
                className="mt-2 text-[11px] text-primary hover:underline"
              >
                + Add my primary role ({profile.primary_role})
              </button>
            )}
          </div>

          {/* Keywords */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Also alert on keywords:</p>
            <div className="flex gap-2">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                placeholder="e.g. horror, comedy, drama..."
                className="h-8 text-xs bg-secondary border-border"
              />
              <Button size="sm" variant="outline" onClick={addKeyword} disabled={saving || !keyword.trim()} className="h-8 px-3">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keywords.map((kw) => (
                  <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs text-foreground">
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="text-muted-foreground hover:text-destructive">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Email toggle */}
          <div className="flex items-center justify-between pt-1 border-t border-border/60">
            <span className="text-xs text-muted-foreground">Email notifications</span>
            <button
              onClick={toggleEmail}
              disabled={saving}
              className={`relative w-9 h-5 rounded-full transition-colors ${emailOn ? "bg-primary" : "bg-border"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${emailOn ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>

          {saving && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </p>
          )}
        </>
      )}
    </div>
  );
}