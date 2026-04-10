import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Plus, X } from "lucide-react";
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
const ROLES = ["Actor", "Director", "Producer", "Cinematographer", "Editor", "Writer", "Sound Designer", "Production Designer", "Costume Designer", "Makeup Artist", "Gaffer", "Grip", "1st AD", "2nd AD", "Stunt Coordinator", "VFX Artist", "Composer", "Other"];

export default function CreateCastingCall() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [roleInput, setRoleInput] = useState("");
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
    gender_preference: "",
    age_range_min: "",
    age_range_max: "",
    is_active: true,
  });

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const addRole = (role) => {
    const val = role || roleInput.trim();
    if (!val || form.roles_needed.includes(val)) return;
    update("roles_needed", [...form.roles_needed, val]);
    setRoleInput("");
  };

  const removeRole = (role) => update("roles_needed", form.roles_needed.filter((r) => r !== role));

  const handleSave = async () => {
    if (!form.project_title || !form.description || form.roles_needed.length === 0) {
      toast.error("Project title, description, and at least one role are required.");
      return;
    }
    setSaving(true);
    const me = await base44.auth.me();
    await base44.entities.CastingCall.create({ ...form, creator_user_id: me.id });
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

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Roles Needed *</Label>
            <div className="flex gap-2 mb-2">
              <Select onValueChange={(v) => addRole(v)}>
                <SelectTrigger className="bg-secondary border-border flex-1"><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-64">
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={roleInput} onChange={(e) => setRoleInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addRole())} placeholder="Or type custom..." className="bg-secondary border-border flex-1" />
              <Button type="button" variant="outline" size="icon" onClick={() => addRole()}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.roles_needed.map((r) => (
                <span key={r} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs">
                  {r}
                  <button onClick={() => removeRole(r)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Location</Label>
              <Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Sydney, NSW" className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Shoot Dates</Label>
              <Input value={form.shoot_dates} onChange={(e) => update("shoot_dates", e.target.value)} placeholder="e.g. March 2025 / TBD" className="bg-secondary border-border" />
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

          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Contact Email</Label>
            <Input value={form.contact_email} onChange={(e) => update("contact_email", e.target.value)} placeholder="casting@yourproduction.com" className="bg-secondary border-border" />
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