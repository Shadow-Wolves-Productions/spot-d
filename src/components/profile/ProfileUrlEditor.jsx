import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

const RESERVED = ["admin", "login", "register", "settings", "dashboard", "search", "discover", "casting", "notifications", "help", "about", "terms", "privacy", "support", "api"];
const SLUG_RE = /^[a-zA-Z0-9_-]{3,30}$/;

export default function ProfileUrlEditor({ profile, onUpdated }) {
  const [slug, setSlug] = useState(profile?.profile_slug || "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentUrl = `spotd.app/u/${profile?.profile_slug || profile?.id || ""}`;

  const handleSave = async () => {
    const cleaned = slug.trim().toLowerCase();
    if (!SLUG_RE.test(cleaned)) {
      toast.error("Slug must be 3–30 characters: letters, numbers, hyphens, underscores only.");
      return;
    }
    if (RESERVED.includes(cleaned)) {
      toast.error(`"${cleaned}" is a reserved word. Please choose another.`);
      return;
    }
    setSaving(true);

    // Check uniqueness
    const existing = await base44.entities.Profile.filter({ profile_slug: cleaned });
    const taken = existing.filter((p) => p.id !== profile.id);
    if (taken.length > 0) {
      // Suggest a variant
      const suggestion = `${cleaned}${Math.floor(Math.random() * 90 + 10)}`;
      toast.error(`That URL is already taken — try "${suggestion}"`);
      setSaving(false);
      return;
    }

    await base44.entities.Profile.update(profile.id, { profile_slug: cleaned });
    toast.success(`Profile URL updated — share it: spotd.app/u/${cleaned}`);
    onUpdated && onUpdated(cleaned);
    setSaving(false);
  };

  const handleCopy = async () => {
    const url = `https://spotd.app/u/${profile?.profile_slug || profile?.id}`;
    try { await navigator.clipboard.writeText(url); } catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground block">Profile URL</Label>
      <div className="flex items-center gap-2 p-3 bg-secondary/40 rounded-lg text-xs text-muted-foreground">
        <span className="text-muted-foreground/60">spotd.app/u/</span>
        <span className="text-foreground font-medium">{profile?.profile_slug || profile?.id}</span>
        <button onClick={handleCopy} className="ml-auto text-muted-foreground hover:text-primary transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 pointer-events-none">spotd.app/u/</span>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            placeholder="your-handle"
            className="bg-secondary border-border pl-[96px] text-sm"
            maxLength={30}
          />
        </div>
        <Button onClick={handleSave} disabled={saving || slug === profile?.profile_slug} size="sm" className="bg-primary text-primary-foreground shrink-0">
          {saving ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : "Save"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">3–30 characters. Letters, numbers, hyphens, underscores.</p>
    </div>
  );
}