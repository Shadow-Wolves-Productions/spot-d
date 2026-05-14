import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, MapPin, DollarSign, Film, Building2, User as UserIcon,
  Share2, Pencil, Trash2, ExternalLink, Eye, Bookmark,
  MessageSquare, CheckCircle2, Globe, Timer, Clock, Settings,
  Users, Plus, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { usePageMeta } from "@/lib/usePageMeta";

const STAGE_STYLES = {
  "Development":          "text-slate-400  bg-slate-500/10  border-slate-500/20",
  "Packaging":            "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Financing":            "text-amber-400  bg-amber-500/10  border-amber-500/20",
  "Pre-Production":       "text-blue-400   bg-blue-500/10   border-blue-500/20",
  "Production":           "text-green-400  bg-green-500/10  border-green-500/20",
  "Post-Production":      "text-teal-400   bg-teal-500/10   border-teal-500/20",
  "Festival Run":         "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "Seeking Distribution": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Released":             "text-primary    bg-primary/10    border-primary/20",
};

const TYPE_STYLES = {
  "Feature Film":     "text-blue-400   bg-blue-500/10   border-blue-500/20",
  "Short Film":       "text-green-400  bg-green-500/10  border-green-500/20",
  "TV Series":        "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Web Series":       "text-violet-400 bg-violet-500/10 border-violet-500/20",
  "Documentary":      "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Commercial":       "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "Music Video":      "text-pink-400   bg-pink-500/10   border-pink-500/20",
  "Proof of Concept": "text-teal-400   bg-teal-500/10   border-teal-500/20",
  "Student Film":     "text-slate-400  bg-slate-500/10  border-slate-500/20",
};

const ALL_STAGES = [
  "Development", "Packaging", "Financing", "Pre-Production", "Production",
  "Post-Production", "Festival Run", "Seeking Distribution", "Released",
];

const INQUIRY_TYPES = [
  "General", "Collaboration", "Casting", "Crew", "Investment", "Distribution",
  "Sales Agent", "Sponsorship", "Location", "Other",
];

const ATTACHMENT_ROLES = [
  "Director", "Producer", "Executive Producer", "Writer", "Actor",
  "DOP / Cinematographer", "Editor", "Composer", "Production Designer",
  "Costume Designer", "Sound Designer", "Visual Effects", "Casting Director",
  "Unit Production Manager", "1st AD", "Investor", "Distribution Partner", "Other",
];

function computeCompleteness(p) {
  const checks = [
    { label: "Title",            ok: !!p.title },
    { label: "Format",           ok: !!p.project_type },
    { label: "Stage",            ok: !!p.stage },
    { label: "Genre",            ok: !!p.genre },
    { label: "Logline",          ok: !!p.logline },
    { label: "Seeking category", ok: Array.isArray(p.seeking) && p.seeking.length > 0 },
    { label: "Poster / key art", ok: !!p.poster_image },
    { label: "Contact role",     ok: !!p.contact_role },
  ];
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { score, missing: checks.filter((c) => !c.ok).map((c) => c.label) };
}

function StageTracker({ currentStage }) {
  const idx = ALL_STAGES.indexOf(currentStage);
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {ALL_STAGES.map((stage, i) => {
        const isCurrent = i === idx;
        const isPast    = i < idx;
        return (
          <div key={stage} className="flex items-center">
            <div className={`px-2.5 py-1 text-[9px] uppercase tracking-[0.08em] font-semibold whitespace-nowrap rounded-full border transition-all ${
              isCurrent
                ? (STAGE_STYLES[stage] || "text-primary bg-primary/10 border-primary/20")
                : isPast
                ? "text-muted-foreground/50 bg-secondary/30 border-border/30"
                : "text-muted-foreground/30 bg-transparent border-border/20"
            }`}>
              {stage}
            </div>
            {i < ALL_STAGES.length - 1 && (
              <div className={`w-3 h-px mx-0.5 flex-shrink-0 ${i < idx ? "bg-border/60" : "bg-border/20"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Inquiry modal ─────────────────────────────────────────────────────────────
function InquiryModal({ project, myProfile, onClose }) {
  const [inquiryType, setInquiryType] = useState("General");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) { toast.error("Please write a message"); return; }
    setSending(true);
    try {
      await base44.http.post(`/api/projects/${project.id}/inquiry`, {
        inquiry_type: inquiryType,
        message: message.trim(),
        sender_profile_id: myProfile?.id || null,
        sender_name: myProfile?.full_name || null,
        sender_photo: myProfile?.profile_photo || null,
      });
      toast.success("Inquiry sent");
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to send inquiry");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
        className="w-full max-w-md bg-card border border-white/[0.08] rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Send Inquiry</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{project.title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Type of Inquiry</Label>
            <Select value={inquiryType} onValueChange={setInquiryType}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {INQUIRY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Introduce yourself and explain your interest in this project…"
              className="bg-secondary border-border text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{message.length}/2000</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1 border-border" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 bg-primary text-primary-foreground font-semibold" onClick={handleSend} disabled={sending || !message.trim()}>
            {sending ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : "Send"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Attach modal ──────────────────────────────────────────────────────────────
function AttachModal({ project, myProfile, onClose, onAttached }) {
  const [role, setRole] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const handleAttach = async () => {
    if (!role) { toast.error("Please select a role"); return; }
    setSending(true);
    try {
      await base44.http.post(`/api/projects/${project.id}/attach`, {
        profile_id: myProfile?.id || null,
        role_on_project: role,
        note: note.trim() || null,
        display_name: myProfile?.full_name || null,
        display_photo: myProfile?.profile_photo || null,
      });
      toast.success("Attachment request sent — waiting for owner approval");
      onAttached();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to send request");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
        className="w-full max-w-md bg-card border border-white/[0.08] rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Attach Yourself</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{project.title}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Your Role on This Project *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {ATTACHMENT_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
              Note to owner <span className="normal-case text-muted-foreground/60">(optional)</span>
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Briefly describe your involvement or why you're attaching…"
              className="bg-secondary border-border text-sm"
            />
          </div>
          <div className="p-3 rounded-lg bg-secondary/40 border border-border/40 text-xs text-muted-foreground">
            Your request will be sent to the project owner. Once approved, your profile will appear in the project's team section.
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1 border-border" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 bg-primary text-primary-foreground font-semibold" onClick={handleAttach} disabled={sending || !role}>
            {sending ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : "Send Request"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [user, setUser]                 = useState(null);
  const [myProfile, setMyProfile]       = useState(null);
  const [isSaved, setIsSaved]           = useState(false);
  const [savedId, setSavedId]           = useState(null);
  const [savingToggle, setSavingToggle] = useState(false);
  const [teamMembers, setTeamMembers]   = useState([]);
  const [myAttachment, setMyAttachment] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [inquiryOpen, setInquiryOpen]   = useState(false);
  const [attachOpen, setAttachOpen]     = useState(false);

  const loadAttachments = async (projectId) => {
    const all = await base44.entities.ProjectAttachment.filter({ project_id: projectId });
    setTeamMembers(all.filter((a) => a.status === "approved"));
    setPendingCount(all.filter((a) => a.status === "pending").length);
    return all;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const p = await base44.entities.Project.get(id);
        setProject(p);
        try { await base44.http.post(`/api/projects/${id}/view`, {}); } catch { /* non-critical */ }

        const me = await base44.auth.me().catch(() => null);
        setUser(me);

        if (me) {
          const [profiles, saved, allAttachments] = await Promise.all([
            base44.entities.Profile.filter({ user_id: me.id }),
            base44.entities.SavedProject.filter({ user_id: me.id, project_id: id }),
            base44.entities.ProjectAttachment.filter({ project_id: id }),
          ]);
          if (profiles.length > 0) {
            setMyProfile(profiles[0]);
            const mine = allAttachments.find((a) => a.profile_id === profiles[0].id);
            setMyAttachment(mine || null);
          }
          if (saved.length > 0) { setIsSaved(true); setSavedId(saved[0].id); }
          setTeamMembers(allAttachments.filter((a) => a.status === "approved"));
          setPendingCount(allAttachments.filter((a) => a.status === "pending").length);
        } else {
          // Unauthenticated: still show approved team
          const all = await base44.entities.ProjectAttachment.filter({ project_id: id, status: "approved" });
          setTeamMembers(all);
        }
      } catch {
        setProject(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  usePageMeta({
    title: project ? `${project.title} — Spot'd Projects` : undefined,
    description: project
      ? `${project.project_type || "Project"}${project.genre ? " · " + project.genre : ""}${project.stage ? " · " + project.stage : ""}. ${project.logline || ""}`
      : undefined,
    image: project?.poster_image || undefined,
  });

  const isOwner = user?.id === project?.creator_user_id;
  const { score: completeness, missing: missingFields } = project
    ? computeCompleteness(project)
    : { score: 0, missing: [] };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    try {
      await base44.entities.Project.delete(id);
      toast.success("Project deleted");
      navigate("/projects");
    } catch { toast.error("Delete failed"); }
  };

  const handleSaveToggle = async () => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    setSavingToggle(true);
    try {
      if (isSaved && savedId) {
        await base44.entities.SavedProject.delete(savedId);
        setIsSaved(false); setSavedId(null);
        toast.success("Removed from saved");
      } else {
        const created = await base44.entities.SavedProject.create({ project_id: id, user_id: user.id });
        setIsSaved(true); setSavedId(created.id);
        // bump save_count on project
        await base44.entities.Project.update(id, { save_count: (project?.save_count || 0) + 1 });
        toast.success("Project saved");
      }
    } catch { toast.error("Failed to update saved"); }
    finally { setSavingToggle(false); }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: project?.title, url }).catch(() => {});
    else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center px-4 text-center">
        <Film className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
        <h1 className="font-display text-3xl font-semibold text-foreground">Project not found</h1>
        <p className="text-muted-foreground mt-3">It may have been removed or the link is wrong.</p>
        <Link to="/projects"><Button className="mt-6 bg-primary text-primary-foreground rounded-full">Browse projects</Button></Link>
      </div>
    );
  }

  const typeCls  = TYPE_STYLES[project.project_type]  || "text-muted-foreground border-border bg-secondary/40";
  const stageCls = STAGE_STYLES[project.stage] || "text-muted-foreground border-border bg-secondary/40";
  const isCompanyPost = project.posted_as === "company" && project.posted_as_company_id;
  const attributionName = isCompanyPost ? project.posted_as_company_name : project.production_company;
  const attributionLogo = isCompanyPost ? project.posted_as_company_logo : project.company_logo;
  const attributionHref = isCompanyPost && project.posted_as_company_slug ? `/c/${project.posted_as_company_slug}` : null;

  const canAttach = user && myProfile && !isOwner && (!myAttachment || myAttachment.status === "rejected");
  const attachLabel = myAttachment?.status === "pending"
    ? "Request Pending"
    : myAttachment?.status === "approved"
    ? "Attached"
    : "Attach Yourself";

  const attachmentLinks = [
    { label: "Pitch Deck",     url: project.pitch_deck_url },
    { label: "Trailer",        url: project.trailer_url },
    { label: "Lookbook",       url: project.lookbook_url },
    { label: "Screener",       url: project.screener_url },
    { label: "Business Plan",  url: project.business_plan_url },
    { label: "Moodboard",      url: project.moodboard_url },
  ].filter((a) => a.url);

  return (
    <div className="pt-24 pb-16 min-h-screen" data-testid="project-detail-page">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> All projects
        </Link>
      </div>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="relative mb-8">
        <div className="h-[220px] sm:h-[300px] relative overflow-hidden bg-card">
          {project.banner_image || project.poster_image ? (
            <img src={project.banner_image || project.poster_image} alt="" className="w-full h-full object-cover opacity-25" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary/40 to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-5 sm:gap-8 -mt-16 sm:--mt-24 relative" style={{ marginTop: "calc(-4rem)" }}>
            {/* Poster */}
            <div className="w-[88px] sm:w-[140px] flex-shrink-0">
              <div className="rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl bg-secondary/60 aspect-[2/3]">
                {project.poster_image
                  ? <img src={project.poster_image} alt={project.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Film className="w-8 h-8 text-muted-foreground/30" /></div>}
              </div>
            </div>

            {/* Title block */}
            <div className="flex-1 min-w-0 pt-14 sm:pt-24">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {project.project_type && (
                  <span className={`text-[10px] uppercase tracking-[0.08em] font-semibold px-2.5 py-1 rounded-full border ${typeCls}`}>
                    {project.project_type}
                  </span>
                )}
                {project.stage && (
                  <span className={`text-[10px] uppercase tracking-[0.08em] font-semibold px-2.5 py-1 rounded-full border ${stageCls}`}>
                    {project.stage}
                  </span>
                )}
                {project.is_verified && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" title="Verified project" />
                )}
              </div>

              <h1 className="font-display text-2xl sm:text-4xl font-bold text-foreground leading-tight" style={{ letterSpacing: "-0.5px" }} data-testid="project-title">
                {project.title}
              </h1>
              {project.genre && <p className="text-sm text-muted-foreground mt-1">{project.genre}</p>}

              {(attributionName || attributionLogo) && (
                <div className="flex items-center gap-2 mt-2">
                  {attributionLogo && <img src={attributionLogo} alt="" className="w-5 h-5 rounded object-cover border border-border" />}
                  {attributionHref ? (
                    <Link to={attributionHref} className="text-[11px] uppercase tracking-[0.06em] font-mono text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {attributionName}
                    </Link>
                  ) : (
                    <span className="text-[11px] uppercase tracking-[0.06em] font-mono text-muted-foreground inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {attributionName}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stage tracker */}
        {project.stage && (
          <div className="mb-6 overflow-x-auto">
            <StageTracker currentStage={project.stage} />
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Inquiry / contact */}
          {project.contact_role && !isOwner && (
            <Button
              size="sm"
              className="bg-primary text-primary-foreground rounded-full font-semibold px-5"
              onClick={() => user ? setInquiryOpen(true) : base44.auth.redirectToLogin()}
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Contact {project.contact_role}
            </Button>
          )}
          {/* Attach */}
          {(canAttach || myAttachment) && (
            <Button
              size="sm"
              variant="outline"
              className={`rounded-full px-5 ${
                myAttachment?.status === "approved"
                  ? "border-primary/30 text-primary"
                  : myAttachment?.status === "pending"
                  ? "border-amber-500/30 text-amber-400"
                  : "border-border"
              }`}
              disabled={!!myAttachment && myAttachment.status !== "rejected"}
              onClick={() => setAttachOpen(true)}
            >
              <Users className="w-3.5 h-3.5 mr-1.5" /> {attachLabel}
            </Button>
          )}
          {/* Save */}
          <Button
            size="sm"
            variant="outline"
            className={`rounded-full px-5 ${isSaved ? "border-primary/30 text-primary" : "border-border"}`}
            onClick={handleSaveToggle}
            disabled={savingToggle}
          >
            <Bookmark className={`w-3.5 h-3.5 mr-1.5 ${isSaved ? "fill-primary" : ""}`} />
            {isSaved ? "Saved" : "Save"}
          </Button>
          {/* Share */}
          <Button size="sm" variant="outline" className="border-border rounded-full px-5" onClick={handleShare}>
            <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share
          </Button>
          {/* Owner controls */}
          {isOwner && (
            <>
              <Link to={`/projects/${id}/manage`}>
                <Button size="sm" variant="outline" className="border-border rounded-full px-5 relative">
                  <Settings className="w-3.5 h-3.5 mr-1.5" /> Manage
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </Button>
              </Link>
              <Link to={`/projects/${id}/edit`}>
                <Button size="sm" variant="outline" className="border-border rounded-full px-5">
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                </Button>
              </Link>
              <Button size="sm" variant="outline" onClick={handleDelete} className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-full px-5">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
              </Button>
            </>
          )}
        </div>

        {/* Owner completeness card */}
        {isOwner && completeness < 100 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 bg-card border border-white/[0.06] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Project Completeness</p>
                <p className="text-xs text-muted-foreground mt-0.5">Complete your listing to increase visibility</p>
              </div>
              <span className="font-display text-2xl font-bold text-primary">{completeness}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completeness}%` }} />
            </div>
            {missingFields.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">Missing</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingFields.map((f) => (
                    <span key={f} className="text-[11px] px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400">{f}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Main 2-column layout */}
        <div className="grid lg:grid-cols-[1fr_300px] gap-8">
          {/* ── LEFT ─────────────────────────────────────────────────── */}
          <div className="space-y-8">
            {/* Seeking tags */}
            {(project.seeking || []).length > 0 && (
              <section>
                <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-muted-foreground mb-3">Currently Seeking</p>
                <div className="flex flex-wrap gap-2">
                  {project.seeking.map((tag) => (
                    <span key={tag} className="text-xs px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Logline */}
            {project.logline && (
              <section data-testid="project-logline">
                <h2 className="font-display text-lg font-semibold text-foreground mb-2">Logline</h2>
                <p className="text-muted-foreground leading-[1.8] italic text-base">"{project.logline}"</p>
              </section>
            )}

            {/* Synopsis */}
            {project.synopsis && (
              <section data-testid="project-synopsis">
                <h2 className="font-display text-lg font-semibold text-foreground mb-2">Synopsis</h2>
                <p className="text-muted-foreground leading-[1.8] whitespace-pre-wrap">{project.synopsis}</p>
              </section>
            )}

            {/* Director Statement */}
            {project.director_statement && (
              <section>
                <h2 className="font-display text-lg font-semibold text-foreground mb-2">Director's Statement</h2>
                <p className="text-muted-foreground leading-[1.8] whitespace-pre-wrap">{project.director_statement}</p>
              </section>
            )}

            {/* Production Notes */}
            {project.production_notes && (
              <section>
                <h2 className="font-display text-lg font-semibold text-foreground mb-2">Production Notes</h2>
                <p className="text-muted-foreground leading-[1.8] whitespace-pre-wrap">{project.production_notes}</p>
              </section>
            )}

            {/* Team */}
            {teamMembers.length > 0 && (
              <section>
                <h2 className="font-display text-lg font-semibold text-foreground mb-4">Attached Team</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {teamMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 bg-card border border-white/[0.06] rounded-xl p-3">
                      <div className="w-10 h-10 rounded-full bg-secondary/60 overflow-hidden flex-shrink-0 flex items-center justify-center border border-border/40">
                        {m.display_photo
                          ? <img src={m.display_photo} alt="" className="w-full h-full object-cover" />
                          : <UserIcon className="w-4 h-4 text-muted-foreground/50" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        {m.profile_id ? (
                          <Link to={`/profile/${m.profile_id}`} className="text-sm font-medium text-foreground hover:text-primary truncate block">
                            {m.display_name || "Team member"}
                          </Link>
                        ) : (
                          <p className="text-sm font-medium text-foreground truncate">{m.display_name || "Team member"}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">{m.role_on_project || "Team"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── RIGHT ────────────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Project details */}
            <div className="bg-card border border-white/[0.06] rounded-xl p-5 space-y-3">
              <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-muted-foreground mb-1">Project Details</p>
              {[
                { icon: Building2,  label: "Production Co.", value: project.production_company },
                { icon: UserIcon,   label: "Director",       value: project.director_name },
                { icon: MapPin,     label: "Location",       value: project.filming_location || project.country },
                { icon: DollarSign, label: "Budget",         value: project.budget_range },
                { icon: Timer,      label: "Runtime",        value: project.runtime },
                { icon: Globe,      label: "Language",       value: project.language },
                { icon: Clock,      label: "Festival",       value: project.festival_status },
              ].filter((r) => r.value).map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3 text-sm">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground/60">{label}</p>
                    <p className="text-foreground">{value}</p>
                  </div>
                </div>
              ))}
              {project.imdb_link && (
                <a href={project.imdb_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
                  <ExternalLink className="w-3 h-3" /> IMDb
                </a>
              )}
            </div>

            {/* Release goals */}
            {project.release_goals && (
              <div className="bg-card border border-white/[0.06] rounded-xl p-5">
                <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-muted-foreground mb-2">Release Goals</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{project.release_goals}</p>
              </div>
            )}

            {/* Attachments */}
            {attachmentLinks.length > 0 && (
              <div className="bg-card border border-white/[0.06] rounded-xl p-5">
                <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-muted-foreground mb-3">Attachments</p>
                <div className="space-y-2">
                  {attachmentLinks.map(({ label, url }) => (
                    <a key={label} href={url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" /> {label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Analytics (owner only) */}
            {isOwner && (
              <div className="bg-card border border-white/[0.06] rounded-xl p-5">
                <p className="text-[10px] uppercase tracking-[0.1em] font-mono text-muted-foreground mb-3">Analytics</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Eye,          label: "Views",    value: project.view_count    || 0 },
                    { icon: Bookmark,     label: "Saves",    value: project.save_count    || 0 },
                    { icon: MessageSquare,label: "Inquiries",value: project.inquiry_count || 0 },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="text-center p-2.5 rounded-lg bg-secondary/40">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground/60 mx-auto mb-1" />
                      <p className="font-display text-lg font-bold text-foreground">{value}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
                    </div>
                  ))}
                </div>
                {pendingCount > 0 && (
                  <Link to={`/projects/${id}/manage`} className="mt-3 flex items-center justify-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="w-3 h-3" /> {pendingCount} pending team request{pendingCount !== 1 ? "s" : ""}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-[11px] uppercase tracking-[0.06em] font-mono text-muted-foreground/40 mt-12 pt-6 border-t border-border/40">
          {project.view_count > 0 && <>{project.view_count} view{project.view_count !== 1 ? "s" : ""} · </>}
          Listed {project.created_date ? new Date(project.created_date).toLocaleDateString() : "recently"}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {inquiryOpen && (
          <InquiryModal project={project} myProfile={myProfile} onClose={() => setInquiryOpen(false)} />
        )}
        {attachOpen && (
          <AttachModal
            project={project}
            myProfile={myProfile}
            onClose={() => setAttachOpen(false)}
            onAttached={() => loadAttachments(id).catch(() => {})}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
