import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const PROJECT_TYPES = ["Feature Film", "Short Film", "TV Series", "Commercial", "Music Video", "Documentary", "Web Series", "Theatre", "Other"];
const EXPERIENCE_LEVELS = ["Any", "Entry", "Mid", "Senior", "Expert"];
const COMPENSATION = ["Paid", "Deferred", "Credits / Reel", "Union Scale", "TBD"];
const ROLES = ["Actor", "Director", "Producer", "Cinematographer", "Editor", "Writer", "Sound Designer", "Production Designer", "Costume Designer", "Makeup Artist", "Gaffer", "Grip", "1st AD", "2nd AD", "Line Producer", "Production Manager", "Script Supervisor", "Stunt Coordinator", "VFX Artist", "Colorist", "Composer", "Sound Mixer", "Boom Operator", "Art Director", "Set Designer", "Props Master", "Location Manager", "Casting Director", "Dialect Coach", "Choreographer", "Other"];

function defaultDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function CreateCastingCall() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [shootDateWarning, setShootDateWarning] = useState(false);
  const [form, setForm] = useState({
    project_title: "",
    project_type: "",
    description: "",
    roles_needed: [],
    experience_level: "Any",
    location: "",
    shoot_dates: "",
    budget_range: "",
    compensation: "",
    union_required: false,
    contact_email: "",
    deadline: defaultDeadline(),
    gender_preference: "",
    age_range_min: "",
    age_range_max: "",
    is_active: true,
  });

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleShootDateChange = (val) => {
    update("shoot_dates", val);
    if (val) {
      const entered = new Date(val);
      setShootDateWarning(entered < new Date());
    } else {
      setShootDateWarning(false);
    }
  };

  const toggleRole = (role) => {
    if (form.roles_needed.includes(role)) {
      update("roles_needed", form.roles_needed.filter((r) => r !== role));
    } else {
      update("roles_needed", [...form.roles_needed, role]);
    }
  };

  const handleSave = async () => {
    if (!form.project_title || !form.description || form.roles_needed.length === 0) {
      toast.error("Project title, description, and at least one role are required.");
      return;
    }
    setSaving(true);
    const me = await base44.auth.me();
    const profiles = await base44.entities.Profile.filter({ user_id: me.id });
    const creatorProfileId = profiles.length > 0 ? profiles[0].id : undefined;

    const deadline = form.deadline
      ? new Date(form.deadline).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await base44.entities.CastingCall.create({
      ...form,
      contact_email: form.contact_email.trim(),
      creator_user_id: me.id,
      creator_profile_id: creatorProfileId,
      deadline,
      view_count: 0,
      application_count: 0,
    });
    toast.success("Casting call posted!");
    navigate("/casting");
    setSaving(false);
  };

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/casting" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Casting Calls
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Post a Casting Call</h1>
        <p className="text-muted-foreground text-sm mb-10">Let talent find you. Fill in your project details below.</p>

        <div className="space-y-6">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Project Title *</Label>
            <Input value={form.project_title} onChange={(e) => update("project_title", e.target.value)} placeholder="e.g. 'Red Desert' Feature Film" className="bg-secondary border-border" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Project Type</Label>
              <Select value={form.project_type} onValueChange={(v) => update("project_type", v)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Compensation</Label>
              <Select value={form.compensation} onValueChange={(v) => update("compensation", v)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {COMPENSATION.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Description *</Label>
            <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={4} placeholder="Describe your project, tone, and what you're looking for..." className="bg-secondary border-border" />
          </div>

          {/* Roles multi-select */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Roles Needed *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
              {ROLES.map((r) => {
                const selected = form.roles_needed.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={`text-xs px-2.5 py-1.5 rounded-md border text-left transition-all ${
                      selected
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                    }`}
                  >
                    {selected && <span className="mr-1">✓</span>}{r}
                  </button>
                );
              })}
            </div>
            {form.roles_needed.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.roles_needed.map((r) => (
                  <span key={r} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs">
                    {r}
                    <button onClick={() => toggleRole(r)}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Location</Label>
              <Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Sydney, NSW" className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Shoot Dates</Label>
              <Input
                type="date"
                value={form.shoot_dates}
                onChange={(e) => handleShootDateChange(e.target.value)}
                className="bg-secondary border-border"
              />
              {shootDateWarning && (
                <p className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" /> This date is in the past
                </p>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Budget Range</Label>
              <Input value={form.budget_range} onChange={(e) => update("budget_range", e.target.value)} placeholder="e.g. $5,000 – $20,000" className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Experience Level</Label>
              <Select value={form.experience_level} onValueChange={(v) => update("experience_level", v)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {EXPERIENCE_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Application Deadline</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => update("deadline", e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Contact Email</Label>
              <Input
                value={form.contact_email}
                onChange={(e) => update("contact_email", e.target.value)}
                onBlur={(e) => update("contact_email", e.target.value.trim())}
                placeholder="casting@yourproduction.com"
                className="bg-secondary border-border"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Gender Preference</Label>
              <Input value={form.gender_preference} onChange={(e) => update("gender_preference", e.target.value)} placeholder="Any / Male / Female..." className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Age Min</Label>
              <Input type="number" value={form.age_range_min} onChange={(e) => update("age_range_min", e.target.value)} placeholder="18" className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Age Max</Label>
              <Input type="number" value={form.age_range_max} onChange={(e) => update("age_range_max", e.target.value)} placeholder="40" className="bg-secondary border-border" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.union_required} onCheckedChange={(v) => update("union_required", v)} />
            <Label>Union Membership Required</Label>
          </div>

          <div className="pt-4 border-t border-border">
            <Button onClick={handleSave} disabled={saving} className="w-full glass-gold text-primary-foreground font-semibold">
              {saving ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : "Post Casting Call"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}