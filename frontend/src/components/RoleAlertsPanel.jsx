import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Plus, X, Loader2, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const ROLES = [
  "Actor", "Director", "Producer", "Cinematographer", "Editor", "Writer",
  "Sound Designer", "Production Designer", "Costume Designer", "Makeup Artist",
  "Gaffer", "Grip", "1st AD", "2nd AD", "Line Producer", "Production Manager",
  "Script Supervisor", "Stunt Coordinator", "VFX Artist", "Colorist", "Composer",
  "Sound Mixer", "Boom Operator", "Art Director", "Set Designer", "Props Master",
  "Location Manager", "Casting Director", "Dialect Coach", "Choreographer", "Other",
];

const FREQUENCIES = [
  { value: "instant", label: "Instant" },
  { value: "daily", label: "Daily digest" },
  { value: "weekly", label: "Weekly digest" },
];

function AlertCard({ alert, onSave, onDelete, saving, profile }) {
  const [localRoles, setLocalRoles] = useState(alert.roles || []);
  const [localKeywords, setLocalKeywords] = useState(alert.keywords || []);
  const [localLocations, setLocalLocations] = useState(alert.locations || []);
  const [frequency, setFrequency] = useState(alert.frequency || "daily");
  const [emailOn, setEmailOn] = useState(alert.email_notifications ?? true);
  const [kwInput, setKwInput] = useState("");
  const [locInput, setLocInput] = useState("");
  const [dirty, setDirty] = useState(false);

  const mark = () => setDirty(true);

  const toggleRole = (r) => {
    setLocalRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
    mark();
  };

  const addKeyword = () => {
    const kw = kwInput.trim().toLowerCase();
    if (!kw || localKeywords.includes(kw)) return;
    setLocalKeywords((prev) => [...prev, kw]);
    setKwInput("");
    mark();
  };

  const addLocation = () => {
    const loc = locInput.trim();
    if (!loc || localLocations.includes(loc)) return;
    setLocalLocations((prev) => [...prev, loc]);
    setLocInput("");
    mark();
  };

  const handleSave = () => onSave(alert.id, {
    roles: localRoles,
    keywords: localKeywords,
    locations: localLocations,
    frequency,
    email_notifications: emailOn,
  }, () => setDirty(false));

  return (
    <div className="bg-secondary/30 rounded-xl p-4 space-y-4 border border-border/60">
      {/* Roles */}
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Roles</p>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((role) => {
            const on = localRoles.includes(role);
            return (
              <button key={role} onClick={() => toggleRole(role)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
                  on ? "border-primary text-black" : "border-border text-muted-foreground hover:border-primary/40"
                }`}
                style={on ? { background: "#E8FC6C" } : {}}>
                {role}
              </button>
            );
          })}
        </div>
        {profile?.primary_role && !localRoles.includes(profile.primary_role) && (
          <button onClick={() => toggleRole(profile.primary_role)} className="mt-1.5 text-[11px] text-primary hover:underline">
            + Add my primary role ({profile.primary_role})
          </button>
        )}
      </div>

      {/* Keywords */}
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Keywords</p>
        <div className="flex gap-2 mb-2">
          <Input value={kwInput} onChange={(e) => setKwInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
            placeholder="e.g. horror, comedy..." className="h-7 text-xs bg-secondary border-border" />
          <Button size="sm" variant="outline" onClick={addKeyword} disabled={!kwInput.trim()} className="h-7 px-2"><Plus className="w-3 h-3" /></Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {localKeywords.map((kw) => (
            <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs text-foreground">
              {kw}
              <button onClick={() => { setLocalKeywords((p) => p.filter((k) => k !== kw)); mark(); }}><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
        </div>
      </div>

      {/* Locations */}
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Locations <span className="normal-case">(empty = all)</span></p>
        <div className="flex gap-2 mb-2">
          <Input value={locInput} onChange={(e) => setLocInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLocation())}
            placeholder="e.g. Sydney, NSW..." className="h-7 text-xs bg-secondary border-border" />
          <Button size="sm" variant="outline" onClick={addLocation} disabled={!locInput.trim()} className="h-7 px-2"><Plus className="w-3 h-3" /></Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {localLocations.map((loc) => (
            <span key={loc} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 text-xs text-foreground">
              📍 {loc}
              <button onClick={() => { setLocalLocations((p) => p.filter((l) => l !== loc)); mark(); }}><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
        </div>
      </div>

      {/* Frequency + Email */}
      <div className="flex items-center gap-3 pt-2 border-t border-border/60">
        <div className="flex-1">
          <Select value={frequency} onValueChange={(v) => { setFrequency(v); mark(); }}>
            <SelectTrigger className="h-7 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <button onClick={() => { setEmailOn((v) => !v); mark(); }}
          className={`relative w-9 h-5 rounded-full transition-colors ${emailOn ? "bg-primary" : "bg-border"}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${emailOn ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
        <span className="text-[11px] text-muted-foreground">Email</span>
      </div>

      {alert.last_sent_at && (
        <p className="text-[11px] text-muted-foreground">
          Last fired {formatDistanceToNow(new Date(alert.last_sent_at), { addSuffix: true })}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 bg-primary text-primary-foreground text-xs h-7">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save changes"}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onDelete(alert.id)}
          className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white h-7 px-2">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export default function RoleAlertsPanel({ user, profile }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    base44.entities.RoleAlert.filter({ user_id: user.id }).then((data) => {
      setAlerts(data);
      setLoading(false);
    });
  }, [user]);

  const createAlert = async () => {
    setSaving(true);
    const created = await base44.entities.RoleAlert.create({
      user_id: user.id,
      profile_id: profile?.id || "",
      roles: profile?.primary_role ? [profile.primary_role] : [],
      keywords: [],
      locations: [],
      frequency: "daily",
      email_notifications: true,
      is_active: true,
    });
    setAlerts((prev) => [...prev, created]);
    setSaving(false);
    toast.success("Alert created");
  };

  const saveAlert = async (id, patch, onDone) => {
    setSaving(true);
    await base44.entities.RoleAlert.update(id, patch);
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a));
    setSaving(false);
    toast.success("Alert saved");
    onDone && onDone();
  };

  const deleteAlert = async (id) => {
    await base44.entities.RoleAlert.delete(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast.success("Alert deleted");
  };

  if (loading) {
    return (
      <div className="bg-card border border-border/60 rounded-xl p-6 flex items-center justify-center h-24">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/60 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-[0.08em]">Role Alerts</h3>
        </div>
        <Button size="sm" variant="outline" onClick={createAlert} disabled={saving} className="h-7 text-xs border-border gap-1">
          <Plus className="w-3 h-3" /> New alert
        </Button>
      </div>

      {alerts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No alerts yet. Create one to get notified when matching casting calls are posted.</p>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onSave={saveAlert} onDelete={deleteAlert} saving={saving} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}