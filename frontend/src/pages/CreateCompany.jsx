import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageUploader from "@/components/ImageUploader";
import { ChevronLeft, ChevronRight, Plus, X, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { ensureAbsoluteUrl } from "@/lib/url";

const COMPANY_TYPES = [
  "Production Company", "VFX Studio", "Post Production", "Casting Agency",
  "Equipment Rental", "Location Services", "Music & Sound", "Animation Studio",
  "Distribution", "Talent Agency", "Film School", "Other",
];
const TEAM_SIZES = ["Solo", "2-5", "6-15", "16-50", "50+"];
const STEPS = ["Basics", "Location & Contact", "Portfolio", "Review"];

const slugifyClient = (s) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

export default function CreateCompany() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(null);
  const [serviceInput, setServiceInput] = useState("");
  const [form, setForm] = useState({
    company_name: "", company_slug: "", company_type: "Production Company", logo: "", cover_image: "",
    bio: "", founded_year: "", team_size: "Solo",
    city: "", state: "", country: "Australia",
    website: "", email: "", phone: "", instagram: "", imdb_link: "",
    services: [], past_productions: [], reel_link: "",
  });

  useEffect(() => {
    const init = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        navigate("/login?next=" + encodeURIComponent("/create-company"));
        return;
      }
      const me = await base44.auth.me();
      const mine = await base44.entities.CompanyProfile.filter({ user_id: me.id });
      if (mine.length > 0) {
        const c = mine[0];
        setExisting(c);
        setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(c).filter(([k, v]) => v !== null && v !== undefined && k in f)) }));
      }
      setLoading(false);
    };
    init();
  }, [navigate]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const addService = () => {
    const v = serviceInput.trim();
    if (!v || form.services.includes(v)) return;
    update("services", [...form.services, v]);
    setServiceInput("");
  };
  const removeService = (v) => update("services", form.services.filter((s) => s !== v));
  const addProduction = () => update("past_productions", [...form.past_productions, { title: "", year: "", role_on_project: "", link: "" }]);
  const updateProduction = (i, k, v) =>
    update("past_productions", form.past_productions.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)));
  const removeProduction = (i) => update("past_productions", form.past_productions.filter((_, idx) => idx !== i));

  const canNext = () => {
    if (step === 0) return form.company_name.trim().length >= 2;
    return true;
  };
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    setSaving(true);
    try {
      const me = await base44.auth.me();
      const slug = (form.company_slug || slugifyClient(form.company_name)).slice(0, 30);
      const payload = {
        ...form,
        company_slug: slug,
        user_id: me.id,
        founded_year: form.founded_year ? Number(form.founded_year) : null,
        website: ensureAbsoluteUrl(form.website),
        imdb_link: ensureAbsoluteUrl(form.imdb_link),
        reel_link: ensureAbsoluteUrl(form.reel_link),
        past_productions: (form.past_productions || []).map((p) => ({ ...p, link: ensureAbsoluteUrl(p.link) })),
      };
      let saved;
      if (existing) {
        saved = await base44.entities.CompanyProfile.update(existing.id, payload);
      } else {
        saved = await base44.entities.CompanyProfile.create(payload);
      }
      toast.success(existing ? "Company updated." : "Company profile created!");
      navigate(`/c/${saved.company_slug || saved.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <div className="flex items-center gap-3 mb-2">
        <Building2 className="w-5 h-5 text-primary" />
        <p className="text-[11px] uppercase tracking-[0.08em] font-mono text-muted-foreground">{existing ? "Edit company" : "New company"}</p>
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>
        {existing ? form.company_name : "Create your company profile"}
      </h1>

      {/* Step bar */}
      <div className="mt-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>
      <p className="text-xs uppercase tracking-[0.08em] font-mono text-muted-foreground mt-3">
        Step {step + 1} of {STEPS.length} — {STEPS[step]}
      </p>

      <div className="mt-10 bg-card border border-border rounded-2xl p-6 sm:p-8">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Logo</Label>
              <ImageUploader value={form.logo} onChange={(v) => update("logo", v)} kind="company-logo" shape="square" testId="company-logo" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Cover image (optional)</Label>
              <ImageUploader value={form.cover_image} onChange={(v) => update("cover_image", v)} kind="cover-image" shape="rect" testId="company-cover" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Company name *</Label>
              <Input data-testid="company-name-input" value={form.company_name} onChange={(e) => update("company_name", e.target.value)} placeholder="Shadow Wolves Productions" className="bg-secondary border-border h-11" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">URL slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">getspotd.app/c/</span>
                <Input
                  data-testid="company-slug-input"
                  value={form.company_slug}
                  onChange={(e) => update("company_slug", slugifyClient(e.target.value))}
                  placeholder={slugifyClient(form.company_name) || "your-slug"}
                  className="bg-secondary border-border h-11 font-mono"
                  maxLength={30}
                />
                {form.company_slug && (
                  <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(`https://getspotd.app/c/${form.company_slug}`)}>
                    Copy
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">3–30 chars · letters, numbers, hyphens.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Company type</Label>
                <Select value={form.company_type} onValueChange={(v) => update("company_type", v)}>
                  <SelectTrigger className="bg-secondary border-border h-11" data-testid="company-type-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{COMPANY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Team size</Label>
                <Select value={form.team_size} onValueChange={(v) => update("team_size", v)}>
                  <SelectTrigger className="bg-secondary border-border h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">{TEAM_SIZES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Founded year</Label>
                <Input type="number" value={form.founded_year} onChange={(e) => update("founded_year", e.target.value)} placeholder="2020" className="bg-secondary border-border h-11" />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Bio / Overview</Label>
              <Textarea value={form.bio} onChange={(e) => update("bio", e.target.value)} rows={5} className="bg-secondary border-border" placeholder="Tell people what your company does and what kind of work you take on." />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-3 gap-4">
              <div><Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">City</Label><Input value={form.city} onChange={(e) => update("city", e.target.value)} className="bg-secondary border-border h-11" /></div>
              <div><Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">State</Label><Input value={form.state} onChange={(e) => update("state", e.target.value)} className="bg-secondary border-border h-11" /></div>
              <div><Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Country</Label><Input value={form.country} onChange={(e) => update("country", e.target.value)} className="bg-secondary border-border h-11" /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Website</Label><Input value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="https://" className="bg-secondary border-border h-11" /></div>
              <div><Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Business email</Label><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="bg-secondary border-border h-11" /></div>
              <div><Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Phone</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="bg-secondary border-border h-11" /></div>
              <div><Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Instagram</Label><Input value={form.instagram} onChange={(e) => update("instagram", e.target.value)} placeholder="@handle" className="bg-secondary border-border h-11" /></div>
              <div className="sm:col-span-2"><Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">IMDb company page</Label><Input value={form.imdb_link} onChange={(e) => update("imdb_link", e.target.value)} placeholder="https://imdb.com/company/..." className="bg-secondary border-border h-11" /></div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Showreel / Reel link</Label>
              <Input value={form.reel_link} onChange={(e) => update("reel_link", e.target.value)} placeholder="https://vimeo.com/... or YouTube" className="bg-secondary border-border h-11" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Services offered</Label>
              <div className="flex gap-2">
                <Input value={serviceInput} onChange={(e) => setServiceInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addService())} placeholder="e.g. VFX, Compositing" className="bg-secondary border-border h-11" />
                <Button type="button" variant="outline" size="icon" onClick={addService} className="h-11 w-11"><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.services.map((s) => (
                  <Badge key={s} variant="outline" className="border-border text-foreground/80 gap-1">{s}<button type="button" onClick={() => removeService(s)}><X className="w-3 h-3" /></button></Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Past productions</Label>
                <Button type="button" variant="outline" size="sm" onClick={addProduction} disabled={form.past_productions.length >= 10}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {form.past_productions.map((p, i) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3 grid sm:grid-cols-4 gap-2">
                    <Input value={p.title} onChange={(e) => updateProduction(i, "title", e.target.value)} placeholder="Title" className="bg-secondary border-border" />
                    <Input value={p.year} onChange={(e) => updateProduction(i, "year", e.target.value)} placeholder="Year" type="number" className="bg-secondary border-border" />
                    <Input value={p.role_on_project} onChange={(e) => updateProduction(i, "role_on_project", e.target.value)} placeholder="Role on project" className="bg-secondary border-border" />
                    <div className="flex gap-1">
                      <Input value={p.link} onChange={(e) => updateProduction(i, "link", e.target.value)} placeholder="Link" className="bg-secondary border-border flex-1" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeProduction(i)}><X className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
                {form.past_productions.length === 0 && <p className="text-xs text-muted-foreground">Add up to 10 productions to build credibility.</p>}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-semibold">Review</h3>
            <div className="text-sm text-muted-foreground space-y-2 leading-[1.7]">
              <div><span className="text-muted-foreground/60">Name:</span> <span className="text-foreground font-medium">{form.company_name || "—"}</span></div>
              <div><span className="text-muted-foreground/60">Type:</span> <span className="text-foreground">{form.company_type}</span></div>
              <div><span className="text-muted-foreground/60">Location:</span> <span className="text-foreground">{[form.city, form.state, form.country].filter(Boolean).join(", ") || "—"}</span></div>
              <div><span className="text-muted-foreground/60">Team size:</span> <span className="text-foreground">{form.team_size}</span></div>
              {form.website && <div><span className="text-muted-foreground/60">Website:</span> <span className="text-primary">{form.website}</span></div>}
              <div><span className="text-muted-foreground/60">Services:</span> <span className="text-foreground">{form.services.length} listed</span></div>
              <div><span className="text-muted-foreground/60">Past productions:</span> <span className="text-foreground">{form.past_productions.length} listed</span></div>
              <div><span className="text-muted-foreground/60">URL:</span> <span className="text-primary font-mono">getspotd.app/c/{form.company_slug || slugifyClient(form.company_name)}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <Button variant="outline" onClick={back} disabled={step === 0} data-testid="company-back-btn">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={!canNext()} data-testid="company-next-btn" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={saving || !form.company_name} data-testid="company-submit-btn" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (existing ? "Save changes" : "Create company")}
          </Button>
        )}
      </div>
    </div>
  );
}
