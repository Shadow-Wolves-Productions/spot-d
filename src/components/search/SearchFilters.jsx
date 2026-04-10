import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

const ROLES = ["Actor", "Director", "Producer", "Cinematographer", "Editor", "Writer", "Sound Designer", "Production Designer", "Costume Designer", "Makeup Artist", "Gaffer", "Grip", "1st AD", "2nd AD", "Line Producer", "Production Manager", "Script Supervisor", "Stunt Coordinator", "VFX Artist", "Colorist", "Composer", "Sound Mixer", "Boom Operator", "Art Director", "Set Designer", "Props Master", "Location Manager", "Casting Director", "Other"];

const GENDERS = ["Male", "Female", "Non-Binary", "Other"];
const HAIR_COLORS = ["Blonde", "Brown", "Black", "Red", "Grey", "White", "Bald", "Other"];
const EYE_COLORS = ["Blue", "Brown", "Green", "Hazel", "Grey", "Amber", "Other"];
const BUILDS = ["Slim", "Athletic", "Average", "Stocky", "Plus-size"];
const EXPERIENCE_LEVELS = ["Entry", "Mid", "Senior", "Expert"];
const AVAILABILITY = ["Available Now", "Available Soon", "Not Available"];
const UNIONS = ["SAG-AFTRA", "MEAA", "Equity", "DGA", "IATSE", "WGA", "Non-Union"];

export default function SearchFilters({ filters, onChange, isProUser }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const updateFilter = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onChange({ role: "", location: "", availability: "", union: "", experience: "", proOnly: false, verifiedOnly: false, imdbLinked: false, availableNow: false, gender: "", hair_color: "", eye_color: "", build: "", age_min: "", age_max: "" });
  };

  const activeCount = Object.values(filters).filter((v) => v && v !== false && v !== "").length;

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Role */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Role</Label>
        <Select value={filters.role || ""} onValueChange={(v) => updateFilter("role", v)}>
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border max-h-64">
            <SelectItem value="all_roles">All Roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Location */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Location</Label>
        <Input
          placeholder="City, State, or Country"
          value={filters.location || ""}
          onChange={(e) => updateFilter("location", e.target.value)}
          className="bg-secondary border-border"
        />
      </div>

      {/* Availability */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Availability</Label>
        <Select value={filters.availability || ""} onValueChange={(v) => updateFilter("availability", v)}>
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue placeholder="Any Availability" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="any_availability">Any Availability</SelectItem>
            {AVAILABILITY.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Union Status */}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Union</Label>
        <Select value={filters.union || ""} onValueChange={(v) => updateFilter("union", v)}>
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue placeholder="Any Union" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="any_union">Any Union</SelectItem>
            {UNIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Experience Level (PRO) */}
      <div className={!isProUser ? "opacity-50" : ""}>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
          Experience Level {!isProUser && <span className="text-primary text-[10px]">PRO</span>}
        </Label>
        <Select value={filters.experience || ""} onValueChange={(v) => updateFilter("experience", v)} disabled={!isProUser}>
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue placeholder="Any Level" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="any_level">Any Level</SelectItem>
            {EXPERIENCE_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Quick toggles */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <Label className="text-sm text-foreground">Available Now</Label>
          <Switch checked={filters.availableNow} onCheckedChange={(v) => updateFilter("availableNow", v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm text-foreground">PRO Only {!isProUser && <span className="text-primary text-[10px]">PRO</span>}</Label>
          <Switch checked={filters.proOnly} onCheckedChange={(v) => updateFilter("proOnly", v)} disabled={!isProUser} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm text-foreground">IMDb Linked {!isProUser && <span className="text-primary text-[10px]">PRO</span>}</Label>
          <Switch checked={filters.imdbLinked} onCheckedChange={(v) => updateFilter("imdbLinked", v)} disabled={!isProUser} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm text-foreground">Verified Only {!isProUser && <span className="text-primary text-[10px]">PRO</span>}</Label>
          <Switch checked={filters.verifiedOnly} onCheckedChange={(v) => updateFilter("verifiedOnly", v)} disabled={!isProUser} />
        </div>
      </div>

      {/* Appearance Filters */}
      <div className="pt-4 border-t border-border">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Appearance</p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Gender</Label>
            <Select value={filters.gender || ""} onValueChange={(v) => updateFilter("gender", v)}>
              <SelectTrigger className="bg-secondary border-border text-sm h-8"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="any_gender">Any</SelectItem>
                {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Hair Colour</Label>
            <Select value={filters.hair_color || ""} onValueChange={(v) => updateFilter("hair_color", v)}>
              <SelectTrigger className="bg-secondary border-border text-sm h-8"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="any_hair">Any</SelectItem>
                {HAIR_COLORS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Eye Colour</Label>
            <Select value={filters.eye_color || ""} onValueChange={(v) => updateFilter("eye_color", v)}>
              <SelectTrigger className="bg-secondary border-border text-sm h-8"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="any_eye">Any</SelectItem>
                {EYE_COLORS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Build</Label>
            <Select value={filters.build || ""} onValueChange={(v) => updateFilter("build", v)}>
              <SelectTrigger className="bg-secondary border-border text-sm h-8"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="any_build">Any</SelectItem>
                {BUILDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Age Min</Label>
              <Input type="number" placeholder="18" value={filters.age_min || ""} onChange={(e) => updateFilter("age_min", e.target.value)} className="bg-secondary border-border h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Age Max</Label>
              <Input type="number" placeholder="60" value={filters.age_max || ""} onChange={(e) => updateFilter("age_max", e.target.value)} className="bg-secondary border-border h-8 text-sm" />
            </div>
          </div>
        </div>
      </div>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4 mr-1" /> Clear All Filters
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-72 flex-shrink-0">
        <div className="sticky top-24 bg-card border border-border/60 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">Filters</h3>
            {activeCount > 0 && (
              <Badge variant="outline" className="text-primary border-primary/30 text-xs">{activeCount}</Badge>
            )}
          </div>
          <FilterContent />
        </div>
      </div>

      {/* Mobile filter sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="outline" size="sm" className="border-border gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5">{activeCount}</Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="bg-card border-border w-80">
          <SheetHeader>
            <SheetTitle className="font-display">Filters</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-100px)] mt-6 pr-4">
            <FilterContent />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}