import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check, Upload, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import AIAssistant from "../components/profile/AIAssistant";

const ROLES = ["Actor", "Director", "Producer", "Cinematographer", "Editor", "Writer", "Sound Designer", "Production Designer", "Costume Designer", "Makeup Artist", "Gaffer", "Grip", "1st AD", "2nd AD", "Line Producer", "Production Manager", "Script Supervisor", "Stunt Coordinator", "VFX Artist", "Colorist", "Composer", "Sound Mixer", "Boom Operator", "Art Director", "Set Designer", "Props Master", "Location Manager", "Casting Director", "Dialect Coach", "Choreographer", "Other"];
const EXPERIENCE_LEVELS = ["Entry", "Mid", "Senior", "Expert"];
const UNIONS = ["SAG-AFTRA", "MEAA", "Equity", "DGA", "IATSE", "WGA", "Non-Union"];
const WORK_FOR = ["Paid Only", "Deferred Payment", "Credits / Experience", "Union Scale", "Negotiable"];
const PRONOUNS = ["He/Him", "She/Her", "They/Them", "Other"];
const GENDERS = ["Male", "Female", "Non-Binary", "Other"];
const HAIR_COLORS = ["Blonde", "Brown", "Black", "Red", "Grey", "White", "Bald", "Other"];
const EYE_COLORS = ["Blue", "Brown", "Green", "Hazel", "Grey", "Amber", "Other"];
const BUILDS = ["Slim", "Athletic", "Average", "Stocky", "Plus-size"];
const WORK_AUTH = ["Citizen", "Permanent Resident", "Work Visa"];
const AVAILABILITY = ["Available Now", "Available Soon", "Not Available"];

const STEPS = ["Personal", "Professional", "Portfolio & IMDb", "Availability & Contact"];

function calculateCineScore(data) {
  let score = 0;
  if (data.full_name) score += 5;
  if (data.profile_photo) score += 10;
  if (data.primary_role) score += 5;
  if (data.bio) score += 10;
  if (data.city) score += 5;
  if (data.experience_level) score += 5;
  if (data.years_of_experience > 0) score += 5;
  if (data.email) score += 5;
  if (data.phone) score += 3;
  if (data.imdb_link) score += 10;
  if (data.showreel_link) score += 8;
  if (data.website) score += 3;
  if (data.credits?.length > 0) score += Math.min(data.credits.length * 3, 12);
  if (data.union_status?.length > 0) score += 3;
  if (data.headshots?.length > 0) score += 5;
  if (data.special_skills?.length > 0) score += 3;
  if (data.languages_spoken?.length > 0) score += 3;
  return Math.min(score, 100);
}

export default function CreateProfile() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);

  const [form, setForm] = useState({
    full_name: "", preferred_name: "", pronouns: "", profile_photo: "",
    gender: "", hair_color: "", eye_color: "", build: "", age: "", height_cm: "", ethnicity: "",
    email: "", phone: "", city: "", state: "", country: "",
    willing_to_travel: false, travel_notes: "",
    primary_role: "", secondary_roles: [], years_of_experience: 0,
    experience_level: "", day_rate_min: 0, day_rate_max: 0,
    willing_to_work_for: [], union_status: [], union_number: "",
    work_authorization: "",
    imdb_link: "", website: "", instagram: "", linkedin: "",
    showreel_link: "", resume_url: "", headshots: [],
    equipment_owned: [], special_skills: [], languages_spoken: [],
    bio: "",
    availability_status: "Available Now", availability_notes: "",
    credits: [],
    agent_name: "", agent_email: "", agent_phone: "",
  });

  const [tagInputs, setTagInputs] = useState({
    secondary_roles: "", equipment_owned: "", special_skills: "", languages_spoken: "",
  });

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ user_id: me.id });
      if (profiles.length > 0) {
        setExistingProfile(profiles[0]);
        const p = profiles[0];
        setForm((f) => ({
          ...f,
          ...Object.fromEntries(Object.entries(p).filter(([k, v]) => v !== null && v !== undefined && k in f)),
        }));
      } else {
        setForm((f) => ({ ...f, full_name: me.full_name || "", email: me.email || "" }));
      }
      setLoading(false);
    };
    load();
  }, []);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const addTag = (field) => {
    const val = tagInputs[field].trim();
    if (!val || form[field].includes(val)) return;
    update(field, [...form[field], val]);
    setTagInputs((t) => ({ ...t, [field]: "" }));
  };

  const removeTag = (field, val) => {
    update(field, form[field].filter((v) => v !== val));
  };

  const addCredit = () => {
    update("credits", [...form.credits, { project_title: "", role_on_project: "", year: new Date().getFullYear() }]);
  };

  const updateCredit = (idx, key, value) => {
    const newCredits = [...form.credits];
    newCredits[idx] = { ...newCredits[idx], [key]: value };
    update("credits", newCredits);
  };

  const removeCredit = (idx) => {
    update("credits", form.credits.filter((_, i) => i !== idx));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update("profile_photo", file_url);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.primary_role) {
      toast.error("Name and primary role are required");
      return;
    }
    setSaving(true);
    const me = await base44.auth.me();
    const data = { ...form, user_id: me.id, cine_score: calculateCineScore(form) };

    if (existingProfile) {
      await base44.entities.Profile.update(existingProfile.id, data);
      toast.success("Profile updated!");
      navigate(`/profile/${existingProfile.id}`);
    } else {
      const created = await base44.entities.Profile.create(data);
      toast.success("Profile created!");
      navigate(`/profile/${created.id}`);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const TagInput = ({ field, label }) => (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={tagInputs[field]}
          onChange={(e) => setTagInputs((t) => ({ ...t, [field]: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(field))}
          placeholder={`Add ${label.toLowerCase()}`}
          className="bg-secondary border-border"
        />
        <Button type="button" variant="outline" size="icon" onClick={() => addTag(field)}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {form[field].map((v) => (
          <Badge key={v} variant="outline" className="border-border text-foreground/80 gap-1">
            {v}
            <button onClick={() => removeTag(field, v)}><X className="w-3 h-3" /></button>
          </Badge>
        ))}
      </div>
    </div>
  );

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          {existingProfile ? "Edit Your Profile" : "Create Your Profile"}
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
          Complete your profile to be discovered by filmmakers worldwide.
        </p>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                i === step ? "glass-gold text-primary" : i < step ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="w-3.5 h-3.5" /> : <span className="w-5 h-5 rounded-full bg-secondary/50 flex items-center justify-center text-[10px]">{i + 1}</span>}
              {s}
            </button>
          ))}
        </div>

        {/* Step 0: Personal */}
        {step === 0 && (
          <div className="space-y-6">
            {/* Photo */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Profile Photo</Label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center">
                  {form.profile_photo ? (
                    <img src={form.profile_photo} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-6 h-6 text-muted-foreground/30" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  <span className="text-sm text-primary hover:underline">Upload Photo</span>
                </label>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Full Name *</Label>
                <Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} className="bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Preferred Name</Label>
                <Input value={form.preferred_name} onChange={(e) => update("preferred_name", e.target.value)} className="bg-secondary border-border" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Pronouns</Label>
                <Select value={form.pronouns} onValueChange={(v) => update("pronouns", v)}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {PRONOUNS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">City</Label>
                <Input value={form.city} onChange={(e) => update("city", e.target.value)} className="bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">State / Region</Label>
                <Input value={form.state} onChange={(e) => update("state", e.target.value)} className="bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Country</Label>
                <Input value={form.country} onChange={(e) => update("country", e.target.value)} className="bg-secondary border-border" />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Bio / About Me</Label>
              <Textarea value={form.bio} onChange={(e) => update("bio", e.target.value)} rows={4} className="bg-secondary border-border" placeholder="Tell filmmakers about yourself..." />
            </div>

            {/* Appearance */}
            <div className="border-t border-border pt-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-4">Appearance (Optional)</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => update("gender", v)}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Build</Label>
                  <Select value={form.build} onValueChange={(v) => update("build", v)}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {BUILDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Hair Colour</Label>
                  <Select value={form.hair_color} onValueChange={(v) => update("hair_color", v)}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {HAIR_COLORS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Eye Colour</Label>
                  <Select value={form.eye_color} onValueChange={(v) => update("eye_color", v)}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {EYE_COLORS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Age</Label>
                  <Input type="number" value={form.age} onChange={(e) => update("age", Number(e.target.value))} placeholder="e.g. 28" className="bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Height (cm)</Label>
                  <Input type="number" value={form.height_cm} onChange={(e) => update("height_cm", Number(e.target.value))} placeholder="e.g. 175" className="bg-secondary border-border" />
                </div>
              </div>
              <div className="mt-4">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Ethnicity</Label>
                <Input value={form.ethnicity} onChange={(e) => update("ethnicity", e.target.value)} placeholder="Optional" className="bg-secondary border-border" />
              </div>
            </div>

            <AIAssistant form={form} onApply={(updates) => setForm((f) => ({ ...f, ...updates }))} />
          </div>
        )}

        {/* Step 1: Professional */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Primary Role *</Label>
              <Select value={form.primary_role} onValueChange={(v) => update("primary_role", v)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select your main role" /></SelectTrigger>
                <SelectContent className="bg-card border-border max-h-64">
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <TagInput field="secondary_roles" label="Secondary Roles" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Experience Level</Label>
                <Select value={form.experience_level} onValueChange={(v) => update("experience_level", v)}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {EXPERIENCE_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Years of Experience</Label>
                <Input type="number" value={form.years_of_experience} onChange={(e) => update("years_of_experience", Number(e.target.value))} className="bg-secondary border-border" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Day Rate Min ($)</Label>
                <Input type="number" value={form.day_rate_min || ""} onChange={(e) => update("day_rate_min", Number(e.target.value))} className="bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Day Rate Max ($)</Label>
                <Input type="number" value={form.day_rate_max || ""} onChange={(e) => update("day_rate_max", Number(e.target.value))} className="bg-secondary border-border" />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Willing to Work For</Label>
              <div className="flex flex-wrap gap-2">
                {WORK_FOR.map((w) => (
                  <button
                    key={w}
                    onClick={() => update("willing_to_work_for", form.willing_to_work_for.includes(w) ? form.willing_to_work_for.filter((v) => v !== w) : [...form.willing_to_work_for, w])}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${form.willing_to_work_for.includes(w) ? "glass-gold text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >{w}</button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Union Status</Label>
              <div className="flex flex-wrap gap-2">
                {UNIONS.map((u) => (
                  <button
                    key={u}
                    onClick={() => update("union_status", form.union_status.includes(u) ? form.union_status.filter((v) => v !== u) : [...form.union_status, u])}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${form.union_status.includes(u) ? "glass-gold text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >{u}</button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Work Authorization</Label>
              <Select value={form.work_authorization} onValueChange={(v) => update("work_authorization", v)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {WORK_AUTH.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.willing_to_travel} onCheckedChange={(v) => update("willing_to_travel", v)} />
              <Label>Willing to Travel</Label>
            </div>
            {form.willing_to_travel && (
              <Input value={form.travel_notes} onChange={(e) => update("travel_notes", e.target.value)} placeholder="Travel notes (e.g. Anywhere in USA)" className="bg-secondary border-border" />
            )}
            <TagInput field="equipment_owned" label="Equipment Owned" />
            <TagInput field="special_skills" label="Special Skills" />
            <TagInput field="languages_spoken" label="Languages Spoken" />
          </div>
        )}

        {/* Step 2: Portfolio & IMDb */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">IMDb Profile Link</Label>
              <Input value={form.imdb_link} onChange={(e) => update("imdb_link", e.target.value)} placeholder="https://www.imdb.com/name/..." className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Showreel / Portfolio Link</Label>
              <Input value={form.showreel_link} onChange={(e) => update("showreel_link", e.target.value)} placeholder="https://..." className="bg-secondary border-border" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Personal Website</Label>
                <Input value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://..." className="bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Instagram</Label>
                <Input value={form.instagram} onChange={(e) => update("instagram", e.target.value)} placeholder="@handle" className="bg-secondary border-border" />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">LinkedIn</Label>
              <Input value={form.linkedin} onChange={(e) => update("linkedin", e.target.value)} placeholder="https://linkedin.com/in/..." className="bg-secondary border-border" />
            </div>

            {/* Credits */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Credits</Label>
                <Button type="button" variant="outline" size="sm" onClick={addCredit}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Credit
                </Button>
              </div>
              <div className="space-y-3">
                {form.credits.map((credit, i) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid sm:grid-cols-3 gap-2">
                        <Input value={credit.project_title} onChange={(e) => updateCredit(i, "project_title", e.target.value)} placeholder="Project title" className="bg-secondary border-border text-sm" />
                        <Input value={credit.role_on_project} onChange={(e) => updateCredit(i, "role_on_project", e.target.value)} placeholder="Your role" className="bg-secondary border-border text-sm" />
                        <Input type="number" value={credit.year} onChange={(e) => updateCredit(i, "year", Number(e.target.value))} placeholder="Year" className="bg-secondary border-border text-sm" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeCredit(i)} className="flex-shrink-0">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Availability & Contact */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Availability Status</Label>
              <Select value={form.availability_status} onValueChange={(v) => update("availability_status", v)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {AVAILABILITY.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Availability Notes</Label>
              <Textarea value={form.availability_notes} onChange={(e) => update("availability_notes", e.target.value)} rows={2} className="bg-secondary border-border" placeholder="Any additional availability details..." />
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="font-display text-lg font-semibold text-foreground mb-4">Contact Information</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Email</Label>
                  <Input value={form.email} onChange={(e) => update("email", e.target.value)} className="bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Phone</Label>
                  <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="bg-secondary border-border" />
                </div>
              </div>
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="font-display text-lg font-semibold text-foreground mb-4">Agent / Manager (Optional)</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Agent Name</Label>
                  <Input value={form.agent_name} onChange={(e) => update("agent_name", e.target.value)} className="bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Agent Email</Label>
                  <Input value={form.agent_email} onChange={(e) => update("agent_email", e.target.value)} className="bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Agent Phone</Label>
                  <Input value={form.agent_phone} onChange={(e) => update("agent_phone", e.target.value)} className="bg-secondary border-border" />
                </div>
              </div>
            </div>

            {/* CineScore preview */}
            <div className="border-t border-border pt-6">
              <div className="glass-effect rounded-xl p-6 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your CineScore</p>
                <span className="font-display text-4xl font-bold text-primary">{calculateCineScore(form)}</span>
                <p className="text-xs text-muted-foreground mt-2">Complete more fields to improve your score.</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="border-border"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} className="bg-primary text-primary-foreground">
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving} className="glass-gold text-primary-foreground font-semibold gold-glow">
              {saving ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>{existingProfile ? "Update Profile" : "Create Profile"}</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}