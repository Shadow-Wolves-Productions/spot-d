import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check, Upload, X, Plus, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import InlineVerificationButton from "../components/profile/InlineVerificationButton";
import SpotScoreChecklist from "../components/profile/SpotScoreChecklist";
import AgeGate from "../components/AgeGate";
import ImageUploader from "../components/ImageUploader";
import { ensureAbsoluteUrl } from "@/lib/url";

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

// NOTE: SpotScore is computed authoritatively on the backend via
// recalculateSpotScore. The legacy client-side `calculateCineScore` was
// removed (Jan 2026) to avoid drift between client and server scores.

// IMPORTANT: TagInput is defined OUTSIDE the parent component to keep its
// component identity stable across re-renders. Defining it inside caused
// React to remount the <input> every keystroke (focus loss after one char).
function TagInput({ field, label, value, listValue, onTextChange, onAdd, onRemove }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">{label}</Label>
      <div className="flex gap-2">
        <Input
          data-testid={`tag-input-${field}`}
          value={value}
          onChange={(e) => onTextChange(field, e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd(field))}
          placeholder={`Add ${label.toLowerCase()}`}
          className="bg-secondary border-border h-11"
        />
        <Button type="button" variant="outline" size="icon" onClick={() => onAdd(field)} className="h-11 w-11">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {listValue.map((v) => (
          <Badge key={v} variant="outline" className="border-border text-foreground/80 gap-1">
            {v}
            <button type="button" onClick={() => onRemove(field, v)}><X className="w-3 h-3" /></button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default function CreateProfile() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [ageGateData, setAgeGateData] = useState(null);

  const [slugAvailable, setSlugAvailable] = useState(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const [form, setForm] = useState({
    full_name: "", preferred_name: "", pronouns: "", profile_photo: "", profile_slug: "",
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
    is_minor_profile: false,
    responsible_adult_name: "",
    responsible_adult_relationship: "",
    responsible_adult_email: "",
    responsible_adult_phone: "",
  });

  const [tagInputs, setTagInputs] = useState({
    secondary_roles: "", equipment_owned: "", special_skills: "", languages_spoken: "",
  });

  useEffect(() => {
    const load = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        navigate("/login?next=" + encodeURIComponent("/create-profile"));
        return;
      }
      const me = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ user_id: me.id });
      if (profiles.length > 0) {
        setExistingProfile(profiles[0]);
        const p = profiles[0];
        setForm((f) => ({
          ...f,
          ...Object.fromEntries(Object.entries(p).filter(([k, v]) => v !== null && v !== undefined && k in f)),
        }));
        // If they're editing an existing profile, skip the age gate
        setAgeGateData({ from_existing: true });
      } else {
        setForm((f) => ({ ...f, full_name: me.full_name || "", email: me.email || "" }));
      }
      setLoading(false);
    };
    load();
  }, []);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const generateSlugFromName = (name) => name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');

  const checkSlugAvailability = async (slug) => {
    if (!slug) return;
    setCheckingSlug(true);
    const existing = await base44.entities.Profile.filter({ profile_slug: slug });
    const taken = existing.filter((p) => p.id !== existingProfile?.id);
    setSlugAvailable(taken.length === 0);
    setCheckingSlug(false);
  };

  const handleSlugChange = (val) => {
    const clean = val.replace(/[^a-zA-Z0-9_-]/g, '');
    update('profile_slug', clean);
    setSlugAvailable(null);
  };

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

  const handlePhotoUpload = (url) => update("profile_photo", url);

  const handleSave = async () => {
    if (!form.full_name || !form.primary_role) {
      toast.error("Name and primary role are required");
      return;
    }
    setSaving(true);
    const me = await base44.auth.me();

    // Auto-generate slug if not set
    let slug = form.profile_slug || generateSlugFromName(form.full_name);
    if (!existingProfile || !existingProfile.profile_slug) {
      // Ensure uniqueness
      const base = slug;
      let attempt = slug;
      let suffix = 1;
      while (true) {
        const existing = await base44.entities.Profile.filter({ profile_slug: attempt });
        const conflict = existing.filter((p) => p.id !== existingProfile?.id);
        if (conflict.length === 0) { slug = attempt; break; }
        attempt = base + suffix;
        suffix++;
      }
    }

    const data = {
      ...form,
      profile_slug: slug,
      user_id: me.id,
      // Normalise URL fields so we never store bare "imdb.me/x"
      imdb_link: ensureAbsoluteUrl(form.imdb_link),
      showreel_link: ensureAbsoluteUrl(form.showreel_link),
      website: ensureAbsoluteUrl(form.website),
      linkedin: ensureAbsoluteUrl(form.linkedin),
      resume_url: ensureAbsoluteUrl(form.resume_url),
      is_minor_profile: form.is_minor_profile || ageGateData?.is_minor || false,
      responsible_adult_consent: ageGateData?.responsible_adult_consent || false,
      terms_accepted_at: ageGateData?.terms_accepted ? new Date().toISOString() : (existingProfile?.terms_accepted_at || null),
    };

    if (existingProfile) {
      await base44.entities.Profile.update(existingProfile.id, data);
      // Recalculate score via backend (authoritative formula)
      await base44.functions.invoke("recalculateSpotScore", { profile_id: existingProfile.id });
      toast.success("Profile updated!");
      navigate(`/profile/${existingProfile.id}`);
    } else {
      const created = await base44.entities.Profile.create(data);
      // Auto-create free subscription for new users
      const existingSub = await base44.entities.Subscription.filter({ user_id: me.id });
      if (existingSub.length === 0) {
        await base44.entities.Subscription.create({
          user_id: me.id,
          tier: "free",
          status: "active",
          started_at: new Date().toISOString(),
          contact_reveal_limit: 5,
          casting_call_limit: 1,
          can_boost: false,
        });
      }
      // Recalculate score via backend after creation
      await base44.functions.invoke("recalculateSpotScore", { profile_id: created.id });
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

  // Show age gate if not yet completed (only for fresh profiles)
  if (!ageGateData) {
    return <AgeGate onComplete={(data) => {
      setAgeGateData(data);
      if (data.is_minor) {
        setForm((f) => ({ ...f, is_minor_profile: true }));
      }
    }} />;
  }

  // Stable handlers passed into the (now external) TagInput.
  const onTagText = (field, value) => setTagInputs((t) => ({ ...t, [field]: value }));

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          {existingProfile ? "Edit Your Profile" : "Create Your Profile"}
        </h1>
        <p className="text-muted-foreground text-sm mb-8">
          Complete your profile to be discovered by filmmakers worldwide.
        </p>

        {/* Steps — full text on desktop, dot-only indicator on mobile */}
        <div className="mb-8">
          {/* Mobile: numbered dots */}
          <div className="flex sm:hidden items-center justify-center gap-2 pb-2" data-testid="create-profile-steps-mobile">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1} of ${STEPS.length}: ${s}`}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-xs font-bold transition-all ${
                  i === step
                    ? "border-2 border-primary text-primary bg-primary/10"
                    : i < step
                    ? "bg-primary text-primary-foreground"
                    : "border-2 border-border text-muted-foreground/60 bg-secondary"
                }`}
              >
                {i < step ? <Check className="w-4 h-4" /> : <span>{i + 1}</span>}
              </button>
            ))}
          </div>
          <p className="sm:hidden text-center text-[11px] uppercase tracking-[0.08em] font-mono text-muted-foreground mt-2">
            Step {step + 1} of {STEPS.length} · <span className="text-primary">{STEPS[step]}</span>
          </p>

          {/* Desktop: full text labels */}
          <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-2">
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
        </div>

        {/* Step 0: Personal */}
        {step === 0 && (
          <div className="space-y-6">
            {/* Minor performer banner & toggle */}
            <div className={`rounded-xl border p-4 ${form.is_minor_profile ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30"}`} data-testid="minor-toggle-section">
              <div className="flex items-start gap-3">
                <ShieldAlert className={`w-5 h-5 mt-0.5 flex-shrink-0 ${form.is_minor_profile ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="minor-toggle" className="text-sm font-medium text-foreground cursor-pointer">
                      Minor performer profile (under 18)
                    </Label>
                    <Switch
                      id="minor-toggle"
                      checked={!!form.is_minor_profile}
                      onCheckedChange={(v) => update("is_minor_profile", v)}
                      data-testid="minor-toggle-switch"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-[1.6]">
                    Required if the profile represents a performer under 18. Only the responsible adult's contact details will be visible.
                  </p>
                </div>
              </div>
            </div>

            {form.is_minor_profile && (
              <div className="rounded-xl border border-border p-5 space-y-4 bg-secondary/20" data-testid="responsible-adult-section">
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground mb-1">Responsible adult</p>
                  <p className="text-xs text-muted-foreground leading-[1.6]">Required for all minor profiles. The minor's personal contact details will not be stored.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Adult name *</Label>
                    <Input
                      data-testid="responsible-adult-name"
                      value={form.responsible_adult_name}
                      onChange={(e) => update("responsible_adult_name", e.target.value)}
                      placeholder="Parent / guardian / agent"
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Relationship</Label>
                    <Select value={form.responsible_adult_relationship} onValueChange={(v) => update("responsible_adult_relationship", v)}>
                      <SelectTrigger className="bg-secondary border-border" data-testid="responsible-adult-relationship"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {["Parent", "Legal Guardian", "Licensed Agent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Adult email *</Label>
                    <Input
                      data-testid="responsible-adult-email"
                      type="email"
                      value={form.responsible_adult_email}
                      onChange={(e) => update("responsible_adult_email", e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Adult phone</Label>
                    <Input
                      data-testid="responsible-adult-phone"
                      value={form.responsible_adult_phone}
                      onChange={(e) => update("responsible_adult_phone", e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Photo */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Profile Photo</Label>
              <ImageUploader
                value={form.profile_photo}
                onChange={handlePhotoUpload}
                kind="profile-photo"
                shape="square"
                testId="profile-photo"
                label="Square crop works best. JPG, PNG or WEBP. Max 5MB."
              />
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
            <TagInput field="secondary_roles" label="Secondary Roles"
              value={tagInputs.secondary_roles} listValue={form.secondary_roles}
              onTextChange={onTagText} onAdd={addTag} onRemove={removeTag} />
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
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${form.willing_to_work_for.includes(w) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
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
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${form.union_status.includes(u) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                  >{u}</button>
                ))}
              </div>
            </div>
            {form.union_status.some((u) => u !== "Non-Union") && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Union Membership Number</Label>
                <Input
                  value={form.union_number || ""}
                  onChange={(e) => update("union_number", e.target.value)}
                  placeholder="e.g. 0123456"
                  className="bg-secondary border-border"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Adding your number enables auto-verification once email or phone is confirmed.</p>
              </div>
            )}
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
            <TagInput field="equipment_owned" label="Equipment Owned"
              value={tagInputs.equipment_owned} listValue={form.equipment_owned}
              onTextChange={onTagText} onAdd={addTag} onRemove={removeTag} />
            <TagInput field="special_skills" label="Special Skills"
              value={tagInputs.special_skills} listValue={form.special_skills}
              onTextChange={onTagText} onAdd={addTag} onRemove={removeTag} />
            <TagInput field="languages_spoken" label="Languages Spoken"
              value={tagInputs.languages_spoken} listValue={form.languages_spoken}
              onTextChange={onTagText} onAdd={addTag} onRemove={removeTag} />
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

            {/* Headshots — up to 4 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Headshots <span className="text-muted-foreground/60 normal-case">(up to 4)</span></Label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => {
                  const existing = form.headshots[i];
                  return (
                    <div key={i} className="relative">
                      <ImageUploader
                        value={existing || ""}
                        onChange={(url) => {
                          const next = [...form.headshots];
                          next[i] = url;
                          update("headshots", next.filter(Boolean));
                        }}
                        onRemove={() => {
                          const next = [...form.headshots];
                          next.splice(i, 1);
                          update("headshots", next);
                        }}
                        kind="headshot"
                        shape="square"
                        testId={`headshot-${i}`}
                        label="JPG/PNG/WEBP · 5MB"
                        className="!flex-col !items-stretch"
                      />
                    </div>
                  );
                })}
              </div>
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

            {/* Profile URL slug — moved to top */}
            <div className="border border-border rounded-xl p-5">
              <h3 className="font-display text-base font-semibold text-foreground mb-1">Your Profile URL</h3>
              <p className="text-xs text-muted-foreground mb-3">Customise your profile link to match your brand or social handles.</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">spotd.app/u/</span>
                <input
                  value={form.profile_slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={() => checkSlugAvailability(form.profile_slug)}
                  placeholder={generateSlugFromName(form.full_name) || 'YourName'}
                  className="flex h-9 flex-1 rounded-md border border-input bg-secondary px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                />
              </div>
              {checkingSlug && <p className="text-xs text-muted-foreground mt-1">Checking availability…</p>}
              {!checkingSlug && slugAvailable === true && <p className="text-xs text-green-400 mt-1">✓ Available</p>}
              {!checkingSlug && slugAvailable === false && <p className="text-xs text-destructive mt-1">✗ Already taken — try another</p>}
              <p className="text-[11px] text-muted-foreground mt-1">3–30 characters. Letters, numbers, hyphens, underscores only.</p>
            </div>

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

            {/* Contact Information with inline verification */}
            <div className="border-t border-border pt-6">
              <h3 className="font-display text-lg font-semibold text-foreground mb-4">Contact Information</h3>
              <div className="space-y-4">
                {/* Email */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Email</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={form.email}
                      onChange={(e) => { update("email", e.target.value); if (form.email_verified) update("email_verified", false); }}
                      className="bg-secondary border-border flex-1"
                    />
                    {form.email_verified ? (
                      <span className="flex items-center gap-1 text-xs text-green-500 whitespace-nowrap font-medium">
                        <Check className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <InlineVerificationButton type="email" form={form} onVerified={() => update("email_verified", true)} />
                    )}
                  </div>
                </div>
                {/* Phone */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Phone</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={form.phone}
                      onChange={(e) => { update("phone", e.target.value); if (form.phone_verified) update("phone_verified", false); }}
                      className="bg-secondary border-border flex-1"
                    />
                    {form.phone_verified ? (
                      <span className="flex items-center gap-1 text-xs text-green-500 whitespace-nowrap font-medium">
                        <Check className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <InlineVerificationButton type="phone" form={form} onVerified={() => update("phone_verified", true)} />
                    )}
                  </div>
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
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your Spot Score</p>
                <span className="font-display text-4xl font-bold text-primary">{existingProfile?.spot_score ?? "—"}</span>
                <p className="text-xs text-muted-foreground mt-2">Score is recalculated when you save your profile.</p>
              </div>
            </div>

            {/* Spot Score Checklist */}
            <div className="border-t border-border pt-6">
              <div className="mb-3">
                <h3 className="font-display text-base font-semibold text-foreground">Improve Your Spot Score</h3>
                <p className="text-xs text-muted-foreground mt-1">Complete these items to rank higher and get discovered faster.</p>
              </div>
              <SpotScoreChecklist form={form} />
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