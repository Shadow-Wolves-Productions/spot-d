import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Plus, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import RoleEditor from "../components/casting/RoleEditor";

const PROJECT_TYPES = ["Feature Film","Short Film","TV Series","Commercial","Music Video","Documentary","Web Series","Theatre","Animation","Podcast","Other"];
const UNION_OPTIONS = ["Union and Non-Union","Union Only","Non-Union Only","N/A"];
const SCOPE_OPTIONS = ["Local","Nationwide","Worldwide","Doesn't Matter"];
const ROLE_CATEGORIES = ["Actor","Voiceover","Crew","Model"];

const STEPS = [
  { number: 1, label: "Company" },
  { number: 2, label: "Project" },
  { number: 3, label: "Roles" },
  { number: 4, label: "Apply" },
];

function StepIndicator({ step }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((s, i) => (
        <div key={s.number} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
              step > s.number
                ? "bg-primary border-primary text-primary-foreground"
                : step === s.number
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground bg-secondary"
            }`}>
              {step > s.number ? <Check className="w-3.5 h-3.5" /> : s.number}
            </div>
            <span className={`text-[10px] uppercase tracking-wider mt-1 font-medium ${step === s.number ? "text-primary" : "text-muted-foreground"}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-12 sm:w-20 h-0.5 mb-4 mx-1 transition-all ${step > s.number ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function defaultDeadline() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function newRole(category) {
  return {
    id: Math.random().toString(36).slice(2),
    category,
    compensation_type: "Paid",
    pay_mode: "fixed",
    currency: "AUD",
  };
}

export default function CreateCastingCall() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [form, setForm] = useState({
    // Phase 1
    company_name: "",
    company_logo: "",
    contact_email: "",
    // Phase 2
    project_title: "",
    project_type: "",
    description: "",
    budget_range: "",
    union_status: "Union and Non-Union",
    shoot_dates: "",
    location: "",
    talent_search_scope: "Doesn't Matter",
    deadline: defaultDeadline(),
    // Phase 3
    roles: [],
    // Phase 4
    application_method: "spot_button",
    self_tape_instructions: "",
    submission_email: "",
    submission_link: "",
    submission_link_password: "",
  });

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update("company_logo", file_url);
    setUploadingLogo(false);
  };

  const addRole = (category) => {
    update("roles", [...form.roles, newRole(category)]);
  };

  const updateRole = (index, updated) => {
    const next = [...form.roles];
    next[index] = updated;
    update("roles", next);
  };

  const removeRole = (index) => {
    update("roles", form.roles.filter((_, i) => i !== index));
  };

  const canNext = () => {
    if (step === 1) return !!form.contact_email;
    if (step === 2) return !!form.project_title && !!form.description;
    if (step === 3) return form.roles.length > 0;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    const me = await base44.auth.me();
    const profiles = await base44.entities.Profile.filter({ user_id: me.id });
    const creatorProfileId = profiles.length > 0 ? profiles[0].id : undefined;
    const deadline = form.deadline
      ? new Date(form.deadline).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const roles_needed = [...new Set(form.roles.map((r) => r.category))];

    await base44.entities.CastingCall.create({
      ...form,
      roles_needed,
      creator_user_id: me.id,
      creator_profile_id: creatorProfileId,
      deadline,
      view_count: 0,
      application_count: 0,
      is_active: true,
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

        <h1 className="font-display text-3xl font-bold text-foreground mb-1">Post a Casting Call</h1>
        <p className="text-muted-foreground text-sm mb-10">Find the perfect cast & crew for your project.</p>

        <StepIndicator step={step} />

        {/* Phase 1 — Company */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="font-display text-xl font-semibold text-foreground">Who's behind the project?</h2>
              <p className="text-sm text-muted-foreground mt-1">Tell talent who they'd be working with.</p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Company / Production Name</Label>
              <Input value={form.company_name} onChange={(e) => update("company_name", e.target.value)} placeholder="e.g. Blackbird Pictures, John Smith (Producer)" className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Contact Email *</Label>
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) => update("contact_email", e.target.value)}
                placeholder="casting@yourproduction.com"
                className="bg-secondary border-border"
              />
              <p className="text-xs text-muted-foreground mt-1">This is used for applicant inquiries.</p>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Company Logo <span className="normal-case text-muted-foreground/60">(optional)</span></Label>
              {form.company_logo ? (
                <div className="flex items-center gap-4">
                  <img src={form.company_logo} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-border bg-secondary" />
                  <Button size="sm" variant="outline" onClick={() => update("company_logo", "")}>Remove</Button>
                </div>
              ) : (
                <label className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-border bg-secondary/40 cursor-pointer hover:border-primary/40 transition-colors w-fit">
                  {uploadingLogo ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">{uploadingLogo ? "Uploading..." : "Upload logo"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              )}
            </div>
          </div>
        )}

        {/* Phase 2 — Project */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="font-display text-xl font-semibold text-foreground">Tell us about the project</h2>
              <p className="text-sm text-muted-foreground mt-1">The more detail, the better your applicants.</p>
            </div>
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
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Budget Range</Label>
                <Input value={form.budget_range} onChange={(e) => update("budget_range", e.target.value)} placeholder="e.g. $5,000 – $20,000 or Micro" className="bg-secondary border-border" />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Project Description / Logline *</Label>
              <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={4} placeholder="Describe your project, its tone, genre, and what you're looking for in collaborators..." className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Union Status</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {UNION_OPTIONS.map((opt) => (
                  <button key={opt} type="button" onClick={() => update("union_status", opt)}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium text-center transition-all ${form.union_status === opt ? "bg-primary/15 border-primary/50 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Shoot Dates</Label>
                <Input value={form.shoot_dates} onChange={(e) => update("shoot_dates", e.target.value)} placeholder="e.g. March 2025 or 10–14 Feb" className="bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Location</Label>
                <Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Sydney, NSW" className="bg-secondary border-border" />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Where do you want to hire talent from?</Label>
              <div className="flex flex-wrap gap-2">
                {SCOPE_OPTIONS.map((opt) => (
                  <button key={opt} type="button" onClick={() => update("talent_search_scope", opt)}
                    className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${form.talent_search_scope === opt ? "bg-primary/15 border-primary/50 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Application Deadline</Label>
              <Input type="date" value={form.deadline} onChange={(e) => update("deadline", e.target.value)} className="bg-secondary border-border w-48" />
            </div>
          </div>
        )}

        {/* Phase 3 — Roles */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="font-display text-xl font-semibold text-foreground">Who are you looking for?</h2>
              <p className="text-sm text-muted-foreground mt-1">Add one or more roles. Be specific — it gets you better applicants.</p>
            </div>

            {/* Add role buttons */}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Add a role</p>
              <div className="flex flex-wrap gap-2">
                {ROLE_CATEGORIES.map((cat) => (
                  <button key={cat} type="button" onClick={() => addRole(cat)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition-all">
                    <Plus className="w-3.5 h-3.5" /> {cat}
                  </button>
                ))}
              </div>
            </div>

            {form.roles.length === 0 && (
              <div className="text-center py-10 rounded-xl border border-dashed border-border bg-secondary/20">
                <p className="text-muted-foreground text-sm">No roles added yet. Use the buttons above to add your first role.</p>
              </div>
            )}

            <div className="space-y-4">
              {form.roles.map((role, i) => (
                <RoleEditor key={role.id} role={role} index={i} onChange={updateRole} onRemove={removeRole} />
              ))}
            </div>
          </div>
        )}

        {/* Phase 4 — How to Apply */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="font-display text-xl font-semibold text-foreground">How should talent apply?</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose how applicants get in touch.</p>
            </div>

            <div className="space-y-3">
              {[
                {
                  value: "spot_button",
                  label: "Spot This Role",
                  desc: "Talent hits 'Spot This Role' and you get a notification. You decide who to contact.",
                },
                {
                  value: "self_tape",
                  label: "Self-Tape / Audition Instructions",
                  desc: "Add instructions for how to submit a self-tape or audition clip.",
                },
                {
                  value: "external",
                  label: "External Submission Link",
                  desc: "Direct applicants to a Dropbox, YouTube, Vimeo, or your own form.",
                },
              ].map((opt) => (
                <button key={opt.value} type="button" onClick={() => update("application_method", opt.value)}
                  className={`w-full text-left px-4 py-4 rounded-xl border transition-all ${form.application_method === opt.value ? "bg-primary/10 border-primary/50" : "bg-secondary border-border hover:border-border/80"}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0 ${form.application_method === opt.value ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                    <div>
                      <p className={`text-sm font-semibold ${form.application_method === opt.value ? "text-primary" : "text-foreground"}`}>{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {form.application_method === "self_tape" && (
              <div className="space-y-4 p-4 rounded-xl bg-secondary/40 border border-border">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Self-Tape Instructions</Label>
                  <Textarea value={form.self_tape_instructions} onChange={(e) => update("self_tape_instructions", e.target.value)} rows={4} placeholder="e.g. Please record a 1-minute monologue in natural light. Horizontal frame, no filters. Send to..." className="bg-secondary border-border text-sm" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Submission Email</Label>
                  <Input value={form.submission_email} onChange={(e) => update("submission_email", e.target.value)} placeholder="submissions@yourproduction.com" className="bg-secondary border-border" />
                </div>
              </div>
            )}

            {form.application_method === "external" && (
              <div className="space-y-4 p-4 rounded-xl bg-secondary/40 border border-border">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Submission Link</Label>
                  <Input value={form.submission_link} onChange={(e) => update("submission_link", e.target.value)} placeholder="https://dropbox.com/... or YouTube link" className="bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Password <span className="text-muted-foreground/60 normal-case">(if required)</span></Label>
                  <Input value={form.submission_link_password} onChange={(e) => update("submission_link_password", e.target.value)} placeholder="Optional password" className="bg-secondary border-border" />
                </div>
              </div>
            )}

            {form.application_method === "spot_button" && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
                Talent will see a <strong className="text-primary">Spot This Role</strong> button on your casting call. When they click it, you'll receive a notification and can review their profile before deciding to reveal contact details.
              </div>
            )}
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => step > 1 ? setStep((s) => s - 1) : navigate("/casting")}
            className="border-border"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>

          {step < 4 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="bg-primary text-primary-foreground font-semibold"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground font-semibold px-8"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                "Post Casting Call"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}