import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import ProximityFilter from "./ProximityFilter";

const ROLES = ["Actor", "Director", "Producer", "Cinematographer", "Editor", "Writer", "Sound Designer", "Production Designer", "Costume Designer", "Makeup Artist", "Gaffer", "Grip", "1st AD", "2nd AD", "Line Producer", "Production Manager", "Script Supervisor", "Stunt Coordinator", "VFX Artist", "Colorist", "Composer", "Sound Mixer", "Boom Operator", "Art Director", "Set Designer", "Props Master", "Location Manager", "Casting Director", "Other"];
const EXPERIENCE_LEVELS = ["Entry", "Mid", "Senior", "Expert"];
const AVAILABILITY = ["Available Now", "Available Soon", "Not Available"];
const UNIONS = ["SAG-AFTRA", "MEAA", "Equity", "DGA", "IATSE", "WGA", "Non-Union"];
const LANGUAGES = ["English", "Spanish", "French", "Mandarin", "Cantonese", "Japanese", "Korean", "Italian", "German", "Portuguese", "Arabic", "Hindi"];

export default function SearchFilters({ filters, onChange, isProUser, proximity, onProximityChange }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const updateFilter = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onChange({ role: "", location: "", availability: "", union: "", experience: "", proOnly: false, verifiedOnly: false, imdbLinked: false, availableNow: false, language: "" });
  };

  const activeCount = Object.values(filters).filter((v) => v && v !== false && v !== "").length;

  const FilterContent = () => (
    <div className="space-y-5">
      {/* Proximity */}
      <ProximityFilter proximity={proximity} onChange={onProximityChange} />

      <div className="border-t border-border/60 my-1" />

      {/* Role */}
      <div>
        <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2 block">Role</Label>
        <Select value={filters.role || ""} onValueChange={(v) => updateFilter("role", v)}>
          <SelectTrigger className="border text-sm h-9 bg-background border-border">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all_roles">All roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Location */}
      <div>
        <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2 block">Location</Label>
        <Input
        placeholder="City, state, or country"
        value={filters.location || ""}
        onChange={(e) => updateFilter("location", e.target.value)}
        className="border text-sm h-9 bg-background border-border"
        />
      </div>

      {/* Availability */}
      <div>
        <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2 block">Availability</Label>
        <Select value={filters.availability || ""} onValueChange={(v) => updateFilter("availability", v)}>
          <SelectTrigger className="border text-sm h-9 bg-background border-border">
            <SelectValue placeholder="Any availability" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="any_availability">Any availability</SelectItem>
            {AVAILABILITY.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Union affiliation */}
      <div>
        <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2 block">Union affiliation</Label>
        <Select value={filters.union || ""} onValueChange={(v) => updateFilter("union", v)}>
          <SelectTrigger className="border text-sm h-9 bg-background border-border">
            <SelectValue placeholder="Any union" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="any_union">Any union</SelectItem>
            {UNIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Languages */}
      <div>
        <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2 block">Languages</Label>
        <Select value={filters.language || ""} onValueChange={(v) => updateFilter("language", v)}>
          <SelectTrigger className="border text-sm h-9 bg-background border-border">
            <SelectValue placeholder="Any language" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="any_language">Any language</SelectItem>
            {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Experience Level */}
      <div className={!isProUser ? "opacity-50" : ""}>
        <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2 block flex items-center gap-1.5">
          Experience level {!isProUser && <Badge variant="outline" className="text-primary border-primary/30 text-[9px] px-1.5">PRO</Badge>}
        </Label>
        <Select value={filters.experience || ""} onValueChange={(v) => updateFilter("experience", v)} disabled={!isProUser}>
          <SelectTrigger className="border text-sm h-9 bg-background border-border">
            <SelectValue placeholder="Any level" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="any_level">Any level</SelectItem>
            {EXPERIENCE_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Quick toggles */}
      <div className="space-y-3 pt-3 border-t border-border">
        {[
          { label: "Available now", key: "availableNow", pro: false },
          { label: "PRO only", key: "proOnly", pro: true },
          { label: "IMDb linked", key: "imdbLinked", pro: true },
          { label: "Verified only", key: "verifiedOnly", pro: true },
        ].map(({ label, key, pro }) => (
          <div key={key} className={`flex items-center justify-between ${pro && !isProUser ? "opacity-50" : ""}`}>
            <Label className="text-sm text-foreground">
              {label} {pro && !isProUser && <span className="text-primary text-[10px]">PRO</span>}
            </Label>
            <Switch
              checked={!!filters[key]}
              onCheckedChange={(v) => updateFilter(key, v)}
              disabled={pro && !isProUser}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        ))}
      </div>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4 mr-1" /> Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-24 rounded-xl p-5 border bg-card border-border">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Filters</h3>
            {activeCount > 0 && (
              <Badge variant="outline" className="text-primary border-primary/30 text-xs">{activeCount}</Badge>
            )}
          </div>
          <FilterContent />
        </div>
      </div>

      {/* Mobile filter drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="outline" size="sm" className="border-border gap-2 bg-card text-foreground" data-testid="mobile-filters-trigger">
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5" data-testid="mobile-filters-active-count">{activeCount}</Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="border-border rounded-t-2xl max-h-[85vh] bg-card flex flex-col" data-testid="mobile-filters-sheet">
          <SheetHeader className="pb-2 flex-shrink-0">
            <SheetTitle className="font-display text-sm uppercase tracking-[0.08em]">Filters{activeCount > 0 ? ` · ${activeCount}` : ""}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 mt-2 pr-4">
            <FilterContent />
          </ScrollArea>
          {/* Sticky footer with Apply + Clear all */}
          <div className="flex-shrink-0 flex items-center gap-3 pt-3 border-t border-border bg-card sticky bottom-0">
            <Button
              variant="outline"
              size="lg"
              data-testid="mobile-filters-clear"
              className="flex-1 border-border min-h-[44px]"
              onClick={() => { clearFilters(); }}
            >
              <X className="w-4 h-4 mr-1.5" /> Clear all
            </Button>
            <Button
              size="lg"
              data-testid="mobile-filters-apply"
              className="flex-1 bg-primary text-primary-foreground font-semibold min-h-[44px]"
              onClick={() => setMobileOpen(false)}
            >
              Apply{activeCount > 0 ? ` · ${activeCount}` : ""}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}