import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Upload, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PROJECT_TYPES = [
  "Feature Film", "Short Film", "TV Series", "Web Series",
  "Documentary", "Commercial", "Music Video", "Proof of Concept", "Student Film",
];

const PROJECT_STAGES = [
  "Development", "Packaging", "Financing", "Pre-Production", "Production",
  "Post-Production", "Festival Run", "Seeking Distribution", "Released",
];

const GENRE_OPTIONS = [
  "Drama", "Thriller", "Comedy", "Horror", "Action", "Sci-Fi", "Fantasy",
  "Romance", "Documentary", "Biography", "Crime", "Mystery", "Animation",
  "Family", "Musical", "Western", "Other",
];

const SEEKING_OPTIONS = [
  "Seeking Cast", "Seeking Crew", "Seeking Producers", "Seeking Investors",
  "Seeking Distribution", "Seeking Sales Agent", "Seeking Composer",
  "Seeking Post House", "Seeking Finishing Funds", "Seeking Sponsors",
  "Seeking Locations", "Seeking Brand Partnerships",
];

const CONTACT_ROLES = [
  "Director", "Producer", "Executive Producer", "Writer", "Casting Director",
  "Production Manager", "Line Producer", "Co-Producer", "Studio Rep",
];

const BUDGET_RANGES = [
  "Micro (under $10K)", "Low ($10K–$100K)", "Mid ($100K–$500K)",
  "Upper Mid ($500K–$2M)", "High ($2M+)", "Undisclosed",
];

const STEPS = [
  { number: 1, label: "Production" },
  { number: 2, label: "Project" },
  { number: 3, label: "Seeking" },
  { number: 4, label: "Publish" },
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
            <div className={`w-10 sm:w-16 h-0.5 mb-4 mx-1 transition-all ${step > s.number ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function computeCompleteness(form) {
  const checks = [
    !!form.title,
    !!form.project_type,
    !!form.stage,
    !!form.genre,
    !!form.logline,
    form.seeking.length > 0,
    !!form.poster_image,
    !!form.contact_role,
  ];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const labels = [
    "Title", "Format", "Stage", "Genre", "Logline",
    "Seeking category", "Poster / key art", "Contact role",
  ];
  return {
    score,
    missing: labels.filter((_, i) => !checks[i]),
    canPublish: [
      !!form.title,
      !!form.project_type,
      !!form.stage,
      !!form.genre,
      !!form.logline,
      form.seeking.length > 0,
      !!form.contact_role,
    ].every(Boolean),
  };
}

export default function CreateProject() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEditMode = !!editId;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEditMode);
  const [companies, setCompanies] = useState([]);
  const [postAs, setPostAs] = useState("personal");
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [posterDrag, setPosterDrag] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [form, setForm] = useState({
    // Step 1 — Production
    production_company: "",
    company_logo: "",
    director_name: "",
    contact_role: "",
    contact_email: "",
    // Step 2 — Project
    title: "",
    project_type: "",
    stage: "",
    genre: "",
    logline: "",
    synopsis: "",
    director_statement: "",
    production_notes: "",
    poster_image: "",
    budget_range: "",
    filming_location: "",
    country: "",
    runtime: "",
    language: "",
    festival_status: "",
    release_goals: "",
    banner_image: "",
    imdb_link: "",
    trailer_url: "",
    pitch_deck_url: "",
    lookbook_url: "",
    screener_url: "",
    business_plan_url: "",
    moodboard_url: "",
    // Step 3 — Seeking
    seeking: [],
  });

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const toggleSeeking = (tag) =>
    setForm((f) => ({
      ...f,
      seeking: f.seeking.includes(tag)
        ? f.seeking.filter((t) => t !== tag)
        : [...f.seeking, tag],
    }));

  useEffect(() => {
    const init = async () => {
      try {
        const me = await base44.auth.me();
        const myCompanies = await base44.entities.CompanyProfile.filter({ user_id: me.id });
        setCompanies(myCompanies || []);

        if (isEditMode) {
          try {
            const existing = await base44.entities.Project.get(editId);
            if (!existing) { toast.error("Project not found"); navigate("/projects"); return; }
            if (existing.creator_user_id !== me.id && me.role !== "admin") {
              toast.error("You can only edit your own projects");
              navigate("/projects");
              return;
            }
            setForm((f) => ({
              ...f,
              ...Object.fromEntries(Object.entries(existing).filter(([k]) => k in f)),
              seeking: existing.seeking || [],
            }));
            if (existing.posted_as === "company" && existing.posted_as_company_id) {
              setPostAs(existing.posted_as_company_id);
            }
          } catch {
            toast.error("Failed to load project");
            navigate("/projects");
          } finally {
            setLoadingExisting(false);
          }
        }
      } catch {
        base44.auth.redirectToLogin(window.location.pathname);
      }
    };
    init();
  }, [editId, isEditMode, navigate]);

  const onPostAsChange = (val) => {
    setPostAs(val);
    if (val === "personal") return;
    const c = companies.find((x) => x.id === val);
    if (c) {
      setForm((f) => ({
        ...f,
        production_company: c.company_name || f.production_company,
        company_logo: c.logo || f.company_logo,
        contact_email: c.email || f.contact_email,
      }));
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file, type: "cover-image" });
      update("company_logo", file_url);
    } catch { toast.error("Logo upload failed"); }
    finally { setUploadingLogo(false); }
  };

  const handlePosterFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) { toast.error("Please drop an image file"); return; }
    setUploadingPoster(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file, type: "cover-image" });
      update("poster_image", file_url);
      toast.success("Poster uploaded");
    } catch { toast.error("Upload failed"); }
    finally { setUploadingPoster(false); }
  };

  const handleBannerFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) { toast.error("Please drop an image file"); return; }
    setUploadingBanner(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file, type: "cover-image" });
      update("banner_image", file_url);
      toast.success("Banner uploaded");
    } catch { toast.error("Upload failed"); }
    finally { setUploadingBanner(false); }
  };

  const canNext = () => {
    if (step === 1) return !!form.contact_email || !!form.contact_role;
    if (step === 2) return !!form.title && !!form.project_type && !!form.stage && !!form.genre && !!form.logline;
    if (step === 3) return form.seeking.length > 0;
    return true;
  };

  const { score: completeness, missing: missingFields, canPublish } = computeCompleteness(form);

  const handleSave = async (publish = false) => {
    setSaving(true);
    try {
      const me = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ user_id: me.id });

      let attribution = { posted_as: "personal" };
      if (postAs !== "personal") {
        const c = companies.find((x) => x.id === postAs);
        if (c) {
          attribution = {
            posted_as: "company",
            posted_as_company_id: c.id,
            posted_as_company_slug: c.company_slug,
            posted_as_company_name: c.company_name,
            posted_as_company_logo: c.logo || null,
          };
        }
      }

      const payload = {
        ...form,
        ...attribution,
        is_published: publish,
      };

      if (isEditMode) {
        await base44.entities.Project.update(editId, payload);
        toast.success(publish ? "Project published!" : "Project saved");
        navigate(`/projects/${editId}`);
      } else {
        const created = await base44.entities.Project.create({
          ...payload,
          creator_user_id: me.id,
          creator_profile_id: profiles.length > 0 ? profiles[0].id : undefined,
          view_count: 0,
          save_count: 0,
          inquiry_count: 0,
          is_verified: false,
          is_featured: false,
          is_archived: false,
        });
        toast.success(publish ? "Project published!" : "Project saved as draft");
        navigate(`/projects/${created.id}`);
      }
    } catch (e) {
      if (e?.response?.status === 401) {
        base44.auth.redirectToLogin(window.location.pathname);
      } else {
        toast.error("Save failed — please try again");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          to={isEditMode ? `/projects/${editId}` : "/projects"}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {isEditMode ? "Back to project" : "Back to Projects"}
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-1">
          {isEditMode ? "Edit Project" : "List a Project"}
        </h1>
        <p className="text-muted-foreground text-sm mb-10">
          {isEditMode
            ? "Update your project details, stage, or seeking categories."
            : "Get your production in front of the indie film industry."}
        </p>

        {loadingExisting ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <StepIndicator step={step} />

            {/* ── STEP 1: PRODUCTION ─────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="font-display text-xl font-semibold text-foreground">Who's behind this project?</h2>
                  <p className="text-sm text-muted-foreground mt-1">Tell the industry who they'd be working with.</p>
                </div>

                {companies.length > 0 && (
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Post as</Label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onPostAsChange("personal")}
                        className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${postAs === "personal" ? "bg-primary/15 border-primary/50 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}
                      >
                        Personal
                      </button>
                      {companies.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onPostAsChange(c.id)}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium transition-all ${postAs === c.id ? "bg-primary/15 border-primary/50 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}
                        >
                          {c.logo && <img src={c.logo} alt="" className="w-5 h-5 rounded object-cover" />}
                          {c.company_name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Production Company / Studio
                  </Label>
                  <Input
                    value={form.production_company}
                    onChange={(e) => update("production_company", e.target.value)}
                    placeholder="e.g. Blackbird Pictures"
                    className="bg-secondary border-border"
                  />
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Company Logo <span className="normal-case text-muted-foreground/60">(optional)</span>
                  </Label>
                  {form.company_logo ? (
                    <div className="flex items-center gap-4">
                      <img src={form.company_logo} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-border bg-secondary" />
                      <Button size="sm" variant="outline" onClick={() => update("company_logo", "")}>Remove</Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-border bg-secondary/40 cursor-pointer hover:border-primary/40 transition-colors w-fit">
                      {uploadingLogo
                        ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        : <Upload className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm text-muted-foreground">{uploadingLogo ? "Uploading..." : "Upload logo"}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Director Name</Label>
                    <Input
                      value={form.director_name}
                      onChange={(e) => update("director_name", e.target.value)}
                      placeholder="e.g. Jane Smith"
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Your Role on This Project</Label>
                    <Select value={form.contact_role} onValueChange={(v) => update("contact_role", v)}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {CONTACT_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Contact Email <span className="normal-case text-muted-foreground/60">(private — for inquiries)</span>
                  </Label>
                  <Input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => update("contact_email", e.target.value)}
                    placeholder="hello@yourproduction.com"
                    className="bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Your email is never shown publicly.</p>
                </div>
              </div>
            )}

            {/* ── STEP 2: PROJECT DETAILS ─────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="font-display text-xl font-semibold text-foreground">Tell us about the project</h2>
                  <p className="text-sm text-muted-foreground mt-1">Accurate detail makes a stronger listing.</p>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Project Title *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    placeholder="e.g. 'Red Desert' Feature Film"
                    className="bg-secondary border-border"
                  />
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Format *</Label>
                    <Select value={form.project_type} onValueChange={(v) => update("project_type", v)}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Genre *</Label>
                    <Select value={form.genre} onValueChange={(v) => update("genre", v)}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {GENRE_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Budget Range</Label>
                    <Select value={form.budget_range} onValueChange={(v) => update("budget_range", v)}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {BUDGET_RANGES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Production Stage */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">Production Stage *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PROJECT_STAGES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => update("stage", s)}
                        className={`px-3 py-2.5 rounded-lg border text-xs font-medium text-center transition-all ${form.stage === s ? "bg-primary/15 border-primary/50 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logline */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Logline * <span className="normal-case text-muted-foreground/60">— 1–2 sentences</span>
                  </Label>
                  <Textarea
                    value={form.logline}
                    onChange={(e) => update("logline", e.target.value)}
                    rows={2}
                    placeholder="A disgraced detective returns to her hometown, where the disappearance of a child unravels decades of buried secrets."
                    className="bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">This is your hook — keep it sharp.</p>
                </div>

                {/* Synopsis */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Synopsis <span className="normal-case text-muted-foreground/60">(optional)</span>
                  </Label>
                  <Textarea
                    value={form.synopsis}
                    onChange={(e) => update("synopsis", e.target.value)}
                    rows={4}
                    placeholder="A longer description of your story, themes, and vision…"
                    className="bg-secondary border-border"
                  />
                </div>

                {/* Poster */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Poster / Key Art <span className="normal-case text-muted-foreground/60">(strongly recommended)</span>
                  </Label>
                  {form.poster_image ? (
                    <div className="relative inline-block">
                      <img src={form.poster_image} alt="Poster" className="rounded-xl border border-border max-h-56 object-cover" />
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2 h-7 text-xs bg-background/90 backdrop-blur"
                        onClick={() => update("poster_image", "")}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label
                      onDragOver={(e) => { e.preventDefault(); setPosterDrag(true); }}
                      onDragLeave={() => setPosterDrag(false)}
                      onDrop={(e) => { e.preventDefault(); setPosterDrag(false); const f = e.dataTransfer?.files?.[0]; if (f) handlePosterFile(f); }}
                      className={`flex flex-col items-center justify-center gap-2 px-6 py-10 rounded-xl border-2 border-dashed cursor-pointer transition-all text-center ${
                        posterDrag ? "border-primary bg-primary/10" : "border-border bg-secondary/40 hover:border-primary/40 hover:bg-secondary/60"
                      }`}
                    >
                      {uploadingPoster ? (
                        <>
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm text-muted-foreground">Uploading…</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-muted-foreground" />
                          <span className="text-sm text-foreground font-medium">Drop your poster here, or click to browse</span>
                          <span className="text-xs text-muted-foreground">Portrait format recommended · JPG or PNG</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePosterFile(f); }} />
                    </label>
                  )}
                </div>

                {/* Banner image */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Banner / Hero Image <span className="normal-case text-muted-foreground/60">(optional — wide landscape format)</span>
                  </Label>
                  {form.banner_image ? (
                    <div className="relative rounded-xl overflow-hidden border border-border">
                      <img src={form.banner_image} alt="Banner" className="w-full h-28 object-cover" />
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2 h-7 text-xs bg-background/90 backdrop-blur"
                        onClick={() => update("banner_image", "")}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-border bg-secondary/40 cursor-pointer hover:border-primary/40 transition-colors">
                      {uploadingBanner
                        ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        : <Upload className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm text-muted-foreground">{uploadingBanner ? "Uploading..." : "Upload banner image"}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBannerFile(f); }} />
                    </label>
                  )}
                </div>

                {/* Location + Language */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Filming Location</Label>
                    <Input value={form.filming_location} onChange={(e) => update("filming_location", e.target.value)} placeholder="e.g. Sydney, NSW" className="bg-secondary border-border" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Country</Label>
                    <Input value={form.country} onChange={(e) => update("country", e.target.value)} placeholder="e.g. Australia" className="bg-secondary border-border" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Estimated Runtime</Label>
                    <Input value={form.runtime} onChange={(e) => update("runtime", e.target.value)} placeholder="e.g. 90 min" className="bg-secondary border-border" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Language</Label>
                    <Input value={form.language} onChange={(e) => update("language", e.target.value)} placeholder="e.g. English" className="bg-secondary border-border" />
                  </div>
                </div>

                {/* Optional extra fields */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Director's Statement <span className="normal-case text-muted-foreground/60">(optional)</span>
                  </Label>
                  <Textarea value={form.director_statement} onChange={(e) => update("director_statement", e.target.value)} rows={3} placeholder="What drives this project? What do you want audiences to feel?" className="bg-secondary border-border" />
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Production Notes <span className="normal-case text-muted-foreground/60">(optional)</span>
                  </Label>
                  <Textarea value={form.production_notes} onChange={(e) => update("production_notes", e.target.value)} rows={2} placeholder="Shooting schedule, co-production details, financial close status, etc." className="bg-secondary border-border" />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                      Festival Status <span className="normal-case text-muted-foreground/60">(optional)</span>
                    </Label>
                    <Input value={form.festival_status} onChange={(e) => update("festival_status", e.target.value)} placeholder="e.g. Sundance 2025 Official Selection" className="bg-secondary border-border" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                      IMDb Link <span className="normal-case text-muted-foreground/60">(optional)</span>
                    </Label>
                    <Input value={form.imdb_link} onChange={(e) => update("imdb_link", e.target.value)} placeholder="https://imdb.com/title/..." className="bg-secondary border-border" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                      Trailer URL <span className="normal-case text-muted-foreground/60">(optional)</span>
                    </Label>
                    <Input value={form.trailer_url} onChange={(e) => update("trailer_url", e.target.value)} placeholder="https://vimeo.com/..." className="bg-secondary border-border" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                      Pitch Deck URL <span className="normal-case text-muted-foreground/60">(optional)</span>
                    </Label>
                    <Input value={form.pitch_deck_url} onChange={(e) => update("pitch_deck_url", e.target.value)} placeholder="https://drive.google.com/..." className="bg-secondary border-border" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Release Goals <span className="normal-case text-muted-foreground/60">(optional)</span>
                  </Label>
                  <Input value={form.release_goals} onChange={(e) => update("release_goals", e.target.value)} placeholder="e.g. Festival circuit then streaming" className="bg-secondary border-border" />
                </div>

                {/* Extended attachment URLs */}
                <div>
                  <p className="text-xs uppercase tracking-wider font-mono text-muted-foreground mb-3">Additional Materials <span className="normal-case">(optional)</span></p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Lookbook URL</Label>
                      <Input value={form.lookbook_url} onChange={(e) => update("lookbook_url", e.target.value)} placeholder="https://..." className="bg-secondary border-border" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Screener URL</Label>
                      <Input value={form.screener_url} onChange={(e) => update("screener_url", e.target.value)} placeholder="https://..." className="bg-secondary border-border" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Business Plan URL</Label>
                      <Input value={form.business_plan_url} onChange={(e) => update("business_plan_url", e.target.value)} placeholder="https://..." className="bg-secondary border-border" />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Moodboard URL</Label>
                      <Input value={form.moodboard_url} onChange={(e) => update("moodboard_url", e.target.value)} placeholder="https://..." className="bg-secondary border-border" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: SEEKING ────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="font-display text-xl font-semibold text-foreground">What are you looking for?</h2>
                  <p className="text-sm text-muted-foreground mt-1">Select everything this project is currently seeking.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SEEKING_OPTIONS.map((tag) => {
                    const selected = form.seeking.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleSeeking(tag)}
                        className={`px-3 py-3 rounded-xl border text-sm font-medium text-center transition-all ${
                          selected
                            ? "bg-primary/15 border-primary/50 text-primary"
                            : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                        }`}
                      >
                        {selected && <span className="mr-1">✓</span>}
                        {tag.replace("Seeking ", "")}
                      </button>
                    );
                  })}
                </div>

                {form.seeking.length === 0 && (
                  <div className="text-center py-6 rounded-xl border border-dashed border-border bg-secondary/20">
                    <p className="text-sm text-muted-foreground">Select at least one category to continue.</p>
                  </div>
                )}

                {form.seeking.length > 0 && (
                  <div className="p-4 rounded-xl bg-secondary/40 border border-border">
                    <p className="text-xs uppercase tracking-wider font-mono text-muted-foreground mb-2">Selected</p>
                    <div className="flex flex-wrap gap-2">
                      {form.seeking.map((tag) => (
                        <span key={tag} className="text-xs px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 4: REVIEW & PUBLISH ───────────────────────────── */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="font-display text-xl font-semibold text-foreground">Review & Publish</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {canPublish
                      ? "Your project meets the minimum requirements."
                      : "Complete the required fields to publish publicly."}
                  </p>
                </div>

                {/* Completeness */}
                <div className="bg-card border border-white/[0.06] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-foreground">Project Completeness</p>
                    <span className={`font-display text-2xl font-bold ${completeness >= 75 ? "text-primary" : completeness >= 50 ? "text-amber-400" : "text-muted-foreground"}`}>
                      {completeness}%
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all ${completeness >= 75 ? "bg-primary" : completeness >= 50 ? "bg-amber-400" : "bg-muted-foreground/40"}`}
                      style={{ width: `${completeness}%` }}
                    />
                  </div>

                  {missingFields.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">
                        {missingFields.filter((f) => ["Format", "Stage", "Genre", "Logline", "Seeking category", "Contact role"].includes(f)).length > 0 ? "Required to publish" : "Optional — improves visibility"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {missingFields.map((f) => {
                          const isRequired = ["Format", "Stage", "Genre", "Logline", "Seeking category", "Contact role"].includes(f);
                          return (
                            <span key={f} className={`text-[11px] px-2 py-0.5 rounded-full border ${isRequired ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-amber-500/20 bg-amber-500/5 text-amber-400"}`}>
                              {isRequired && <AlertCircle className="w-2.5 h-2.5 inline mr-0.5" />}{f}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="bg-card border border-white/[0.06] rounded-xl p-5 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-3">Summary</p>
                  {[
                    ["Title",    form.title],
                    ["Format",   form.project_type],
                    ["Genre",    form.genre],
                    ["Stage",    form.stage],
                    ["Location", form.filming_location || form.country],
                    ["Budget",   form.budget_range],
                    ["Festival", form.festival_status],
                    ["Seeking",  form.seeking.join(", ")],
                    ["Banner",   form.banner_image ? "✓ Uploaded" : ""],
                    ["Poster",   form.poster_image ? "✓ Uploaded" : ""],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex gap-3 text-sm">
                      <span className="text-muted-foreground/60 w-20 flex-shrink-0">{k}</span>
                      <span className="text-foreground">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Publish / Save Draft */}
                <div className="space-y-3">
                  <Button
                    className="w-full bg-primary text-primary-foreground font-semibold h-12 text-base"
                    disabled={saving || !canPublish}
                    onClick={() => handleSave(true)}
                  >
                    {saving
                      ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      : "Publish Project"}
                  </Button>
                  {!canPublish && (
                    <p className="text-xs text-muted-foreground text-center">
                      Complete the required fields above to publish. You can still save as a draft.
                    </p>
                  )}
                  <Button
                    variant="outline"
                    className="w-full border-border h-10"
                    disabled={saving || !form.title}
                    onClick={() => handleSave(false)}
                  >
                    Save as Draft
                  </Button>
                </div>
              </div>
            )}

            {/* Navigation */}
            {step < 4 && (
              <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => step > 1 ? setStep((s) => s - 1) : navigate(isEditMode ? `/projects/${editId}` : "/projects")}
                  className="border-border"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {step === 1 ? "Cancel" : "Back"}
                </Button>
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canNext()}
                  className="bg-primary text-primary-foreground font-semibold"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 4 && (
              <div className="flex justify-start mt-6 pt-6 border-t border-border">
                <Button variant="outline" onClick={() => setStep(3)} className="border-border">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
