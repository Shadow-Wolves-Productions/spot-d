import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Star, Tag, StickyNote, Search, Filter, X, Edit2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const PRESET_TAGS = ["Shortlist", "Dream hire", "Follow up", "Project X", "On hold", "Contacted"];

const SORTS = [
  { value: "saved_at", label: "Recently saved" },
  { value: "name", label: "Name A–Z" },
  { value: "score", label: "SpotScore ↓" },
];

function EditModal({ savedRecord, profileDetail, onSave, onDelete, onClose }) {
  const [notes, setNotes] = useState(savedRecord.notes || "");
  const [tags, setTags] = useState(savedRecord.tags || []);
  const [superLiked, setSuperLiked] = useState(savedRecord.is_super_liked || false);
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleTag = (t) => setTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const addCustom = () => {
    const t = customTag.trim();
    if (!t || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setCustomTag("");
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(savedRecord.id, { notes, tags, is_super_liked: superLiked });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            {profileDetail?.preferred_name || profileDetail?.full_name}
          </DialogTitle>
        </DialogHeader>

        {/* Super-like */}
        <div className="flex items-center justify-between py-2 border-b border-border">
          <span className="text-sm text-foreground flex items-center gap-2">
            <Star className={`w-4 h-4 ${superLiked ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            Super-like
          </span>
          <button
            onClick={() => setSuperLiked((v) => !v)}
            className={`relative w-9 h-5 rounded-full transition-colors ${superLiked ? "bg-primary" : "bg-border"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${superLiked ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TAGS.map((t) => (
              <button key={t} onClick={() => toggleTag(t)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-all ${tags.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-1">
            <Input value={customTag} onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
              placeholder="Custom tag..." className="h-7 text-xs bg-secondary border-border" />
            <Button size="sm" variant="outline" onClick={addCustom} disabled={!customTag.trim()} className="h-7 px-2 text-xs">Add</Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs">
                  {t}
                  <button onClick={() => setTags((p) => p.filter((x) => x !== t))}><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Notes</p>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Great DP, reach out for Project X..."
            className="bg-secondary border-border text-sm resize-none h-20" />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
            onClick={() => { onDelete(savedRecord.id); onClose(); }}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
          </Button>
          <Button size="sm" className="flex-1 bg-primary text-primary-foreground" onClick={handleSave} disabled={saving}>
            {saving ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SavedCard({ savedRecord, profileDetail, onEdit }) {
  const [hovered, setHovered] = useState(false);
  if (!profileDetail) return null;

  const savedAgo = savedRecord.saved_at
    ? formatDistanceToNow(new Date(savedRecord.saved_at), { addSuffix: true })
    : savedRecord.created_date
      ? formatDistanceToNow(new Date(savedRecord.created_date), { addSuffix: true })
      : "";

  return (
    <div className="relative group" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <Link to={`/profile/${profileDetail.profile_slug || profileDetail.id}`}
        className={`block rounded-xl border transition-all duration-200 overflow-hidden ${savedRecord.is_super_liked ? "border-primary/40 bg-card" : "border-border bg-card"}`}>

        {/* Photo */}
        <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
          {profileDetail.profile_photo ? (
            <img src={profileDetail.profile_photo} alt={profileDetail.full_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/20 text-3xl font-display font-bold">
              {(profileDetail.preferred_name || profileDetail.full_name || "?")[0]}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          {savedRecord.is_super_liked && (
            <Star className="absolute top-2 right-2 w-4 h-4 fill-primary text-primary drop-shadow" />
          )}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="font-display text-xs font-semibold text-white leading-tight">{profileDetail.preferred_name || profileDetail.full_name}</p>
            <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">{profileDetail.primary_role}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-2.5 space-y-1.5">
          {savedAgo && <p className="text-[10px] text-muted-foreground">Saved {savedAgo}</p>}

          {savedRecord.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {savedRecord.tags.slice(0, 3).map((t) => (
                <span key={t} className="px-1.5 py-0.5 rounded text-[9px] bg-primary/10 text-primary font-medium">{t}</span>
              ))}
            </div>
          )}

          {savedRecord.notes && (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
              {savedRecord.notes.length > 60 ? savedRecord.notes.slice(0, 60) + "…" : savedRecord.notes}
            </p>
          )}
        </div>
      </Link>

      {/* Edit button on hover */}
      {hovered && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(savedRecord); }}
          className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors z-10"
        >
          <Edit2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default function SavedProfilesPanel({ savedRecords, profileDetails, myProfileId, onRefresh }) {
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [sort, setSort] = useState("saved_at");
  const [editing, setEditing] = useState(null); // savedRecord being edited

  // Merge saved records with profile details
  const merged = savedRecords.map((s) => ({
    saved: s,
    profile: profileDetails.find((p) => p.id === s.profile_id),
  })).filter((m) => m.profile && m.profile.id !== myProfileId);

  // Collect all tags in use
  const allTags = [...new Set(merged.flatMap((m) => m.saved.tags || []))];

  const filtered = useMemo(() => {
    let list = [...merged];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(({ profile }) =>
        (profile.full_name || "").toLowerCase().includes(q) ||
        (profile.preferred_name || "").toLowerCase().includes(q)
      );
    }
    if (filterTag) {
      list = list.filter(({ saved }) => (saved.tags || []).includes(filterTag));
    }
    if (sort === "saved_at") {
      list.sort((a, b) => {
        const aT = a.saved.saved_at || a.saved.created_date || "";
        const bT = b.saved.saved_at || b.saved.created_date || "";
        return bT.localeCompare(aT);
      });
    } else if (sort === "name") {
      list.sort((a, b) => (a.profile.full_name || "").localeCompare(b.profile.full_name || ""));
    } else if (sort === "score") {
      list.sort((a, b) => (b.profile.spot_score || 0) - (a.profile.spot_score || 0));
    }
    return list;
  }, [merged, search, filterTag, sort]);

  const handleSave = async (id, patch) => {
    await base44.entities.SavedProfile.update(id, patch);
    toast.success("Updated");
    onRefresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.SavedProfile.delete(id);
    toast.success("Removed from saved");
    onRefresh();
  };

  const editingRecord = editing ? merged.find((m) => m.saved.id === editing.id) : null;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved..." className="pl-8 h-8 text-xs bg-secondary border-border" />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="h-8 px-2 text-xs bg-secondary border border-border rounded-md text-foreground">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {allTags.length > 0 && (
          <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
            className="h-8 px-2 text-xs bg-secondary border border-border rounded-md text-foreground">
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No saved profiles match your filters.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map(({ saved, profile }) => (
            <SavedCard key={saved.id} savedRecord={saved} profileDetail={profile} onEdit={setEditing} />
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && editingRecord && (
        <EditModal
          savedRecord={editingRecord.saved}
          profileDetail={editingRecord.profile}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}