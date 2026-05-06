import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, Eye, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";

/**
 * Admin email composer — pick an audience (or paste custom list), write
 * subject + HTML body, preview it, send a test, then broadcast.
 *
 * Design notes
 * - The HTML body renders inside a 600px-wide preview box that mirrors what
 *   the email shell wraps around it (the backend prepends the brand logo +
 *   greeting and appends the footer).
 * - Audience counts come live from /api/admin/audience-counts so the admin
 *   sees exactly how many people each segment will hit.
 * - Custom mode accepts a comma-or-newline-separated list — handy for
 *   one-off announcements to specific people.
 */

const AUDIENCES = [
  { key: "all_users",        label: "All users",            blurb: "Every user with an email" },
  { key: "founders",         label: "Founding members",     blurb: "Locked-in lifetime PRO" },
  { key: "verified",         label: "Verified emails",      blurb: "Active, engaged users" },
  { key: "imported_pending", label: "Imports — unclaimed",  blurb: "Reserved spot, not signed in yet" },
  { key: "custom",           label: "Custom recipient list", blurb: "Paste emails (comma or newline)" },
];

const TEMPLATES = [
  {
    name: "Update / announcement",
    subject: "Quick update from Spot'd",
    html: `<h2 style="margin:0 0 12px 0;color:#0D0D0D;font-size:22px;">A quick update</h2>
<p style="margin:0 0 16px 0;line-height:1.55;color:#333;">Just shipped: [feature].</p>
<p style="margin:0 0 24px 0;line-height:1.55;color:#333;">Try it here:</p>
<p style="margin:0 0 24px 0;"><a href="https://getspotd.app" style="display:inline-block;padding:12px 24px;background:#E6FF00;color:#0D0D0D;text-decoration:none;border-radius:999px;font-weight:600;">Open Spot'd</a></p>`,
  },
  {
    name: "Weekly digest",
    subject: "This week on Spot'd",
    html: `<h2 style="margin:0 0 12px 0;color:#0D0D0D;font-size:22px;">This week on Spot'd</h2>
<ul style="margin:0 0 16px 0;padding-left:20px;line-height:1.6;color:#333;">
  <li>X new casting calls</li>
  <li>Y new profiles</li>
  <li>Z spotlights</li>
</ul>`,
  },
  {
    name: "Photo re-upload nudge",
    subject: "We need your headshot 📸",
    html: `<h2 style="margin:0 0 12px 0;color:#0D0D0D;font-size:22px;">Heads up — re-upload your headshot</h2>
<p style="margin:0 0 16px 0;line-height:1.55;color:#333;">During our move from CineConnect, some headshots didn't make the trip. Drop a fresh one in your profile and you're back in the directory.</p>
<p style="margin:0 0 24px 0;"><a href="https://getspotd.app/create-profile" style="display:inline-block;padding:12px 24px;background:#FF5C35;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;">Re-upload now</a></p>`,
  },
];

export default function EmailComposer({ onSent }) {
  const [audience, setAudience] = useState("founders");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [customEmails, setCustomEmails] = useState("");
  const [counts, setCounts] = useState({});
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    base44.http.get("/api/admin/audience-counts").then(({ data }) => {
      if (!cancelled) setCounts(data || {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const customList = useMemo(
    () => customEmails.split(/[\s,;\n]+/).map((e) => e.trim()).filter(Boolean),
    [customEmails],
  );

  const recipientCount = audience === "custom" ? customList.length : (counts[audience] ?? 0);

  const applyTemplate = (tpl) => {
    setSubject(tpl.subject);
    setHtml(tpl.html);
  };

  const send = async (dryRun) => {
    if (!subject.trim() || !html.trim()) {
      toast.error("Subject and body are required");
      return;
    }
    if (audience === "custom" && customList.length === 0) {
      toast.error("Add at least one custom email");
      return;
    }
    if (!dryRun && recipientCount > 0) {
      const ok = window.confirm(`Send "${subject.trim()}" to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}?\n\nThis is permanent and emails will go out via Postmark.`);
      if (!ok) return;
    }
    setSending(true);
    try {
      const { data } = await base44.http.post("/api/admin/broadcast-email", {
        audience,
        subject: subject.trim(),
        html,
        custom_emails: audience === "custom" ? customList : undefined,
        from_name: "Spot'd",
        dry_run: !!dryRun,
      });
      toast.success(
        dryRun
          ? `Dry run: would deliver to ${data.count} recipient${data.count === 1 ? "" : "s"}`
          : `Queued ${data.count} email${data.count === 1 ? "" : "s"} via Postmark`,
      );
      if (!dryRun) {
        setSubject("");
        setHtml("");
        setCustomEmails("");
        onSent?.();
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-card border border-border/60 rounded-xl p-4" data-testid="email-composer">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-4 h-4 text-primary" />
        <h3 className="font-display text-sm font-semibold text-foreground">Compose broadcast email</h3>
      </div>

      {/* Templates */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {TEMPLATES.map((t) => (
          <Button
            key={t.name}
            size="sm"
            variant="outline"
            className="border-border h-7 text-[11px]"
            onClick={() => applyTemplate(t)}
            data-testid={`email-template-${t.name.toLowerCase().replace(/\s+/g, "-")}`}
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
              className={`text-left p-2.5 rounded-lg border transition-colors ${selected ? "border-primary bg-primary/5" : "border-border hover:border-border/80 bg-background/40"}`}
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
        className="bg-secondary border-border text-sm mb-3"
        data-testid="email-subject-input"
      />

      {/* HTML body */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">HTML body</p>
        <button
          onClick={() => setPreviewing((v) => !v)}
          className="text-[11px] font-mono text-primary hover:underline"
          data-testid="email-preview-toggle"
        >
          {previewing ? "← Edit" : "Preview →"}
        </button>
      </div>

      {previewing ? (
        <div className="rounded-lg border border-border bg-white p-4 min-h-[260px] max-h-[400px] overflow-auto" data-testid="email-preview">
          <p className="text-[11px] text-muted-foreground mb-3 font-mono">Preview — Postmark wraps with logo + greeting + footer</p>
          <div
            className="text-[#0D0D0D] text-sm"
            dangerouslySetInnerHTML={{ __html: html || "<p style=\"color:#aaa;\">Body is empty…</p>" }}
          />
        </div>
      ) : (
        <Textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder='<h2 style="margin:0 0 12px 0;">Hello!</h2><p>Write your HTML here…</p>'
          className="bg-secondary border-border text-xs font-mono min-h-[200px]"
          data-testid="email-html-textarea"
        />
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
        <p className="text-[11px] text-muted-foreground">
          Will deliver to <span className="font-mono text-foreground font-semibold">{recipientCount}</span> recipient{recipientCount === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => send(true)}
            disabled={sending || recipientCount === 0}
            className="border-border"
            data-testid="email-dry-run-btn"
          >
            <Eye className="w-3.5 h-3.5 mr-1" /> Dry run
          </Button>
          <Button
            size="sm"
            onClick={() => send(false)}
            disabled={sending || recipientCount === 0}
            className="bg-primary text-primary-foreground"
            data-testid="email-send-btn"
          >
            <Send className="w-3.5 h-3.5 mr-1" /> {sending ? "Sending…" : `Send to ${recipientCount}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
