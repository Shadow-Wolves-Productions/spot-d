import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, Eye, Mail, Sparkles, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

/**
 * Spot'd Email Composer.
 *
 * The admin doesn't write raw HTML — they fill in a structured form whose
 * fields map directly to the canonical Spot'd email template (the same
 * dark-themed brand layout used for the founding-member welcome). Inline HTML
 * IS allowed inside paragraph fields (links, <strong>, etc.) for power users,
 * but the layout — wordmark, eyebrows, dividers, highlight boxes, CTA button,
 * sign-off, footer — is always identical and on-brand.
 *
 * Live preview pulls from POST /api/admin/preview-broadcast so the admin sees
 * exactly what every recipient will receive.
 */

const AUDIENCES = [
  { key: "all_users",        label: "All users",            blurb: "Every user with an email" },
  { key: "founders",         label: "Founding members",     blurb: "Locked-in lifetime PRO" },
  { key: "verified",         label: "Verified emails",      blurb: "Active, engaged users" },
  { key: "imported_pending", label: "Imports — unclaimed",  blurb: "Reserved spot, not signed in yet" },
  { key: "custom",           label: "Custom recipient list", blurb: "Paste emails (comma or newline)" },
];

// Templates are STRUCTURED (greeting + sections + CTA), not raw HTML.
// All admin needs to do is tweak text in the form — layout stays consistent.
const TEMPLATES = {
  blank: {
    name: "Blank",
    subject: "",
    template: {
      greeting: "Hey {first_name},",
      intro: [""],
      sections: [],
      cta: { label: "", url: "" },
      post_cta: "",
    },
  },
  announcement: {
    name: "Update / Announcement",
    subject: "Quick update from Spot'd",
    template: {
      greeting: "Hey {first_name},",
      intro: [
        "Quick update from the Spot'd team — we just shipped something new.",
      ],
      sections: [
        {
          eyebrow: "What's new",
          paragraphs: [
            "Describe the feature here. Multiple sentences are fine.",
            "Mention what it unlocks for the user — be specific.",
          ],
        },
      ],
      cta: { label: "TRY IT NOW →", url: "https://getspotd.app" },
      post_cta: "Sign in with this email — we'll send you a code, no password needed.",
    },
  },
  digest: {
    name: "Weekly Digest",
    subject: "This week on Spot'd",
    template: {
      greeting: "Hey {first_name},",
      intro: ["Here's everything that happened on Spot'd this week."],
      sections: [
        {
          eyebrow: "By the numbers",
          paragraphs: [],
          list: [
            "X new casting calls",
            "Y new profiles claimed",
            "Z spotlights this week",
          ],
        },
        {
          eyebrow: "Featured spotlight",
          paragraphs: [
            "Highlight a profile or casting call. One paragraph is plenty.",
          ],
        },
      ],
      cta: { label: "OPEN SPOT'D →", url: "https://getspotd.app" },
    },
  },
  reupload: {
    name: "Photo re-upload",
    subject: "We need your headshot 📸",
    template: {
      greeting: "Hey {first_name},",
      intro: [
        "During our move from CineConnect, some headshots didn't make the trip.",
        "Drop a fresh photo in your profile and you're back in the directory.",
      ],
      sections: [
        {
          eyebrow: "Why this matters",
          paragraphs: [
            "Profiles with photos rank higher in search and get 3x more contact reveals. Five minutes, max.",
          ],
        },
      ],
      cta: { label: "RE-UPLOAD MY HEADSHOT →", url: "https://getspotd.app/create-profile" },
    },
  },
  founder_reminder: {
    name: "Founder reminder",
    subject: "Your founding spot is still waiting",
    template: {
      greeting: "Hey {first_name},",
      intro: [
        "Just a reminder — your <strong style=\"color:#FFFFFF;\">Founding Member</strong> spot on Spot'd hasn't been claimed yet.",
      ],
      sections: [
        {
          eyebrow: "Founding member — your spot is waiting",
          eyebrow_color: "#FF5C35",
          paragraphs: ["What that means:"],
          highlight: [
            "⚡ <strong style=\"color:#FFFFFF;\">Lifetime free PRO access</strong> — on us, forever",
            "⚡ Priority placement in search",
            "⚡ Unlimited contact reveals",
            "⚡ Full portfolio uploads",
            "⚡ Founding member badge on your profile",
          ],
        },
        {
          paragraphs: [
            "There are only <strong style=\"color:#FFFFFF;\">100 founding member spots total</strong>. After that, unclaimed spots go to the public waitlist.",
          ],
        },
      ],
      cta: { label: "CLAIM YOUR FOUNDING SPOT →", url: "https://getspotd.app/login" },
      post_cta: "Enter this email at sign-in and we'll send you a code — no password needed.",
    },
  },
};


export default function EmailComposer({ onSent }) {
  const [audience, setAudience] = useState("founders");
  const [subject, setSubject] = useState("");
  const [template, setTemplate] = useState(() => structuredClone(TEMPLATES.announcement.template));
  const [customEmails, setCustomEmails] = useState("");
  const [counts, setCounts] = useState({});
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    base44.http.get("/api/admin/audience-counts").then(({ data }) => setCounts(data || {})).catch(() => {});
  }, []);

  const customList = useMemo(
    () => customEmails.split(/[\s,;\n]+/).map((e) => e.trim()).filter(Boolean),
    [customEmails],
  );
  const recipientCount = audience === "custom" ? customList.length : (counts[audience] ?? 0);

  const applyTemplate = (key) => {
    const t = TEMPLATES[key];
    if (!t) return;
    setSubject(t.subject);
    setTemplate(structuredClone(t.template));
  };

  const refreshPreview = async () => {
    try {
      const { data } = await base44.http.post("/api/admin/preview-broadcast", {
        audience,
        subject: subject.trim() || "(no subject)",
        template,
      });
      setPreviewHtml(data.html);
    } catch (e) {
      toast.error("Preview failed");
    }
  };

  // Auto-refresh preview every time the user toggles into preview mode.
  useEffect(() => { if (previewing) refreshPreview(); /* eslint-disable-next-line */ }, [previewing]);

  const send = async (dryRun) => {
    if (!subject.trim()) return toast.error("Subject is required");
    if (audience === "custom" && customList.length === 0) return toast.error("Add at least one custom email");
    if (!dryRun && recipientCount > 0) {
      const ok = window.confirm(`Send "${subject.trim()}" to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}?\n\nThis cannot be undone.`);
      if (!ok) return;
    }
    setSending(true);
    try {
      const { data } = await base44.http.post("/api/admin/broadcast-email", {
        audience,
        subject: subject.trim(),
        template,
        custom_emails: audience === "custom" ? customList : undefined,
        from_name: "Spot'd",
        dry_run: !!dryRun,
      });
      toast.success(dryRun
        ? `Dry run: would deliver to ${data.count} recipient${data.count === 1 ? "" : "s"}`
        : `Queued ${data.count} email${data.count === 1 ? "" : "s"} via Postmark`);
      if (!dryRun) {
        setSubject("");
        setTemplate(structuredClone(TEMPLATES.announcement.template));
        setCustomEmails("");
        onSent?.();
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Send failed");
    } finally {
      setSending(false);
    }
  };

  // Section helpers
  const addSection = () => {
    setTemplate((t) => ({
      ...t,
      sections: [...(t.sections || []), { eyebrow: "Section title", paragraphs: [""] }],
    }));
  };
  const removeSection = (idx) => {
    setTemplate((t) => ({ ...t, sections: t.sections.filter((_, i) => i !== idx) }));
  };
  const updateSection = (idx, patch) => {
    setTemplate((t) => ({
      ...t,
      sections: t.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  return (
    <div className="rounded-xl p-4 border border-white/[0.06]" style={{ background: "#131418" }} data-testid="email-composer">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-4 h-4 text-primary" />
        <h3 className="font-display text-sm font-semibold text-foreground">Compose broadcast email</h3>
      </div>

      {/* Templates */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {Object.entries(TEMPLATES).map(([key, t]) => (
          <Button
            key={key}
            size="sm"
            variant="outline"
            className="border-border h-7 text-[11px]"
            onClick={() => applyTemplate(key)}
            data-testid={`email-template-${key}`}
          >
            <Sparkles className="w-3 h-3 mr-1" /> {t.name}
          </Button>
        ))}
      </div>

      {/* Audience */}
      <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-2">Send to</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        {AUDIENCES.map((a) => {
          const count = a.key === "custom" ? customList.length : (counts[a.key] ?? 0);
          const selected = audience === a.key;
          return (
            <button
              key={a.key}
              onClick={() => setAudience(a.key)}
              data-testid={`email-audience-${a.key}`}
              className={`text-left p-2.5 rounded-lg border transition-colors ${selected ? "border-primary bg-primary/5" : "border-white/[0.08] hover:border-white/[0.15]"}`}
              style={{ background: selected ? undefined : "rgba(255,255,255,0.02)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{a.label}</span>
                <span className={`text-[11px] font-mono ${selected ? "text-primary" : "text-muted-foreground"}`}>{count}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{a.blurb}</p>
            </button>
          );
        })}
      </div>

      {audience === "custom" && (
        <Textarea
          placeholder="Paste emails — comma, semicolon or newline separated"
          value={customEmails}
          onChange={(e) => setCustomEmails(e.target.value)}
          className="bg-secondary border-border text-sm mb-3 min-h-[72px] font-mono"
          data-testid="email-custom-list"
        />
      )}

      {/* Subject */}
      <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1">Subject</p>
      <Input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject line"
        className="bg-secondary border-border text-sm mb-4"
        data-testid="email-subject-input"
      />

      {/* Structured form */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Email body</p>
        <button
          onClick={() => setPreviewing((v) => !v)}
          className="text-[11px] font-mono text-primary hover:underline"
          data-testid="email-preview-toggle"
        >
          {previewing ? "← Edit" : "Preview →"}
        </button>
      </div>

      {previewing ? (
        <div className="rounded-lg border border-white/[0.06] overflow-hidden" data-testid="email-preview" style={{ maxHeight: 600 }}>
          <iframe
            title="Email preview"
            srcDoc={previewHtml || "<p style=\"padding:24px;color:#888;font-family:sans-serif;\">Loading preview…</p>"}
            className="w-full"
            style={{ height: 600, background: "#0D0D0D", border: 0 }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Greeting */}
          <Field label="Greeting" hint="Use {first_name} for personalization">
            <Input
              value={template.greeting || ""}
              onChange={(e) => setTemplate({ ...template, greeting: e.target.value })}
              className="bg-secondary border-border text-sm"
              data-testid="email-greeting"
            />
          </Field>

          {/* Intro paragraphs */}
          <Field label="Opening paragraphs" hint="One per line (HTML allowed for links/strong)">
            <Textarea
              value={(template.intro || []).join("\n\n")}
              onChange={(e) => setTemplate({ ...template, intro: e.target.value.split(/\n\n+/) })}
              className="bg-secondary border-border text-sm min-h-[96px]"
              placeholder="Hey, just sharing a quick update…"
              data-testid="email-intro"
            />
          </Field>

          {/* Sections */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Sections</p>
              <Button
                size="sm" variant="outline" onClick={addSection}
                className="h-7 text-[11px] border-border"
                data-testid="email-add-section"
              >
                <Plus className="w-3 h-3 mr-1" /> Add section
              </Button>
            </div>
            <div className="space-y-2">
              {(template.sections || []).map((sec, idx) => (
                <SectionEditor
                  key={idx}
                  section={sec}
                  onChange={(patch) => updateSection(idx, patch)}
                  onRemove={() => removeSection(idx)}
                  index={idx}
                />
              ))}
              {(template.sections || []).length === 0 && (
                <p className="text-[11px] text-muted-foreground py-3 text-center border border-dashed border-white/[0.08] rounded">No sections yet — click "Add section" above.</p>
              )}
            </div>
          </div>

          {/* CTA */}
          <Field label="Call-to-action button (optional)">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] gap-2">
              <Input
                value={template.cta?.label || ""}
                onChange={(e) => setTemplate({ ...template, cta: { ...(template.cta || {}), label: e.target.value } })}
                placeholder="CLAIM YOUR FOUNDING SPOT →"
                className="bg-secondary border-border text-sm"
                data-testid="email-cta-label"
              />
              <Input
                value={template.cta?.url || ""}
                onChange={(e) => setTemplate({ ...template, cta: { ...(template.cta || {}), url: e.target.value } })}
                placeholder="https://getspotd.app/login"
                className="bg-secondary border-border text-sm font-mono"
                data-testid="email-cta-url"
              />
            </div>
          </Field>

          {/* Post-CTA */}
          <Field label="Post-CTA caption (optional)">
            <Input
              value={template.post_cta || ""}
              onChange={(e) => setTemplate({ ...template, post_cta: e.target.value })}
              placeholder="Enter this email at sign-in and we'll send you a code…"
              className="bg-secondary border-border text-sm"
              data-testid="email-post-cta"
            />
          </Field>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 mt-4 flex-wrap pt-3 border-t border-white/[0.06]">
        <p className="text-[11px] text-muted-foreground">
          Will deliver to <span className="font-mono text-foreground font-semibold">{recipientCount}</span> recipient{recipientCount === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => send(true)} disabled={sending || recipientCount === 0} className="border-border" data-testid="email-dry-run-btn">
            <Eye className="w-3.5 h-3.5 mr-1" /> Dry run
          </Button>
          <Button size="sm" onClick={() => send(false)} disabled={sending || recipientCount === 0} className="bg-primary text-primary-foreground" data-testid="email-send-btn">
            <Send className="w-3.5 h-3.5 mr-1" /> {sending ? "Sending…" : `Send to ${recipientCount}`}
          </Button>
        </div>
      </div>
    </div>
  );
}


function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">{label}</p>
        {hint && <span className="text-[10px] text-muted-foreground/60">{hint}</span>}
      </div>
      {children}
    </div>
  );
}


function SectionEditor({ section, onChange, onRemove, index }) {
  const [open, setOpen] = useState(true);
  const eyebrowColor = section.eyebrow_color || "#E6FF00";
  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/20" data-testid={`email-section-${index}`}>
      <div className="flex items-center justify-between px-3 py-2">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 flex-1 text-left">
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="text-[11px] uppercase tracking-[0.12em] font-mono" style={{ color: eyebrowColor }}>{section.eyebrow || `Section ${index + 1}`}</span>
        </button>
        <button onClick={onRemove} className="text-[#F87171] hover:bg-destructive/10 p-1 rounded" data-testid={`email-section-${index}-remove`}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/[0.06] pt-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-2">
            <Input
              value={section.eyebrow || ""}
              onChange={(e) => onChange({ eyebrow: e.target.value })}
              placeholder="Eyebrow heading (optional)"
              className="bg-secondary border-border text-sm"
            />
            <select
              value={eyebrowColor}
              onChange={(e) => onChange({ eyebrow_color: e.target.value })}
              className="rounded text-[11px] border border-white/[0.08] px-2 text-foreground/80"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <option value="#E6FF00">Neon yellow</option>
              <option value="#FF5C35">Signal orange</option>
              <option value="#38BDF8">Sky blue</option>
              <option value="#22C55E">Green</option>
            </select>
          </div>
          <Textarea
            value={(section.paragraphs || []).join("\n\n")}
            onChange={(e) => onChange({ paragraphs: e.target.value.split(/\n\n+/).filter(Boolean) })}
            placeholder="Paragraphs (separated by blank line, HTML allowed)"
            className="bg-secondary border-border text-sm min-h-[80px]"
          />
          <Textarea
            value={(section.list || []).join("\n")}
            onChange={(e) => onChange({ list: e.target.value.split(/\n+/).map((s) => s.trim()).filter(Boolean) })}
            placeholder="Bullet list (one per line, optional)"
            className="bg-secondary border-border text-sm min-h-[60px]"
          />
          <Textarea
            value={(section.highlight || []).join("\n")}
            onChange={(e) => onChange({ highlight: e.target.value.split(/\n+/).map((s) => s.trim()).filter(Boolean) })}
            placeholder='Highlight box (one per line — e.g. "⚡ Lifetime PRO access")'
            className="bg-secondary border-border text-sm min-h-[60px]"
          />
        </div>
      )}
    </div>
  );
}
