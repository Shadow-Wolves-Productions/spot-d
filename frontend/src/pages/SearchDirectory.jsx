import { useState, useEffect, useCallback } from "react";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { base44 } from "@/api/base44Client";
import { Search, Star, Map, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ProfileCard from "../components/ProfileCard";
import CompanyProfileCard from "../components/CompanyProfileCard";
import SearchFilters from "../components/search/SearchFilters";
import MapView from "../components/search/MapView";
import { geocodePlace, haversineKm } from "../components/search/ProximityFilter";
import { motion } from "framer-motion";

const SORT_OPTIONS = [
  { value: "-spot_score", label: "Highest SpotScore" },
  { value: "-created_date", label: "Newest Profiles" },
  { value: "-years_of_experience", label: "Most Experienced" },
];

export default function SearchDirectory() {
  const [profiles, setProfiles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [tab, setTab] = useState("crew"); // "talent" | "crew" | "companies"
  const [spotCountMap, setSpotCountMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [superLikedIds, setSuperLikedIds] = useState(new Set());
  const [sort, setSort] = useState("-spot_score");
  const [filters, setFilters] = useState({
    role: "",
    location: "",
    availability: "",
    union: "",
    experience: "",
    proOnly: false,
    verifiedOnly: false,
    imdbLinked: false,
    availableNow: false,
    gender: "",
    hair_color: "",
    eye_color: "",
    build: "",
    age_min: "",
    age_max: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "map"
  const [proximity, setProximity] = useState(null); // { lat, lon, radius, display }

  useEffect(() => {
    const init = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const me = await base44.auth.me();
        setUser(me);
        const myProfiles = await base44.entities.Profile.filter({ user_id: me.id });
        if (myProfiles.length > 0) setMyProfile(myProfiles[0]);
        const saved = await base44.entities.SavedProfile.filter({ user_id: me.id });
        setSavedIds(new Set(saved.map((s) => s.profile_id)));
        setSuperLikedIds(new Set(saved.filter((s) => s.is_super_liked).map((s) => s.profile_id)));
      }
    };
    init();
  }, []);

  const loadProfiles = useCallback(async () => {
    // eslint-disable-next-line
    setLoading(true);

    // Companies tab — load CompanyProfile records
    if (tab === "companies") {
      const all = await base44.entities.CompanyProfile.list("-spot_score", 100).catch(() => []);
      let data = all;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        data = data.filter((c) =>
          c.company_name?.toLowerCase().includes(q) ||
          c.company_type?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.country?.toLowerCase().includes(q)
        );
      }
      setCompanies(data);
      setProfiles([]);
      setLoading(false);
      return;
    }

    const filterObj = {};
    if (filters.role && filters.role !== "all_roles") filterObj.primary_role = filters.role;
    if (filters.availability && filters.availability !== "any_availability") filterObj.availability_status = filters.availability;
    if (filters.availableNow) filterObj.availability_status = "Available Now";
    if (filters.proOnly) filterObj.is_pro = true;
    if (filters.experience && filters.experience !== "any_level") filterObj.experience_level = filters.experience;

    let data;
    if (Object.keys(filterObj).length > 0) {
      data = await base44.entities.Profile.filter(filterObj, sort, 50);
    } else {
      data = await base44.entities.Profile.list(sort, 50);
    }

    // Client-side filtering for text search and other filters
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (p) =>
          p.full_name?.toLowerCase().includes(q) ||
          p.primary_role?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q) ||
          p.country?.toLowerCase().includes(q)
      );
    }
    if (filters.location) {
      const loc = filters.location.toLowerCase();
      data = data.filter(
        (p) =>
          p.city?.toLowerCase().includes(loc) ||
          p.state?.toLowerCase().includes(loc) ||
          p.country?.toLowerCase().includes(loc)
      );
    }
    if (filters.verifiedOnly) {
      data = data.filter((p) => p.email_verified || p.imdb_verified);
    }
    if (filters.imdbLinked) {
      data = data.filter((p) => p.imdb_link);
    }
    if (filters.gender && filters.gender !== "any_gender") {
      data = data.filter((p) => p.gender === filters.gender);
    }
    if (filters.hair_color && filters.hair_color !== "any_hair") {
      data = data.filter((p) => p.hair_color === filters.hair_color);
    }
    if (filters.eye_color && filters.eye_color !== "any_eye") {
      data = data.filter((p) => p.eye_color === filters.eye_color);
    }
    if (filters.build && filters.build !== "any_build") {
      data = data.filter((p) => p.build === filters.build);
    }
    if (filters.age_min) {
      data = data.filter((p) => p.age >= Number(filters.age_min));
    }
    if (filters.age_max) {
      data = data.filter((p) => p.age <= Number(filters.age_max));
    }

    // Proximity filter — geocode city field and compute distance
    if (proximity) {
      const filtered = [];
      for (const p of data) {
        if (!p.city && !p.state) continue;
        const query = [p.city, p.state, p.country].filter(Boolean).join(", ");
        // Cache geocodes on the profile object itself to avoid repeated API calls
        if (!p._lat) {
          const geo = await geocodePlace(query);
          if (geo) { p._lat = geo.lat; p._lon = geo.lon; }
        }
        if (p._lat) {
          const dist = haversineKm(proximity.lat, proximity.lon, p._lat, p._lon);
          if (dist <= proximity.radius) { p._distKm = Math.round(dist); filtered.push(p); }
        }
      }
      data = filtered.sort((a, b) => a._distKm - b._distKm);
    }

    // Matching algorithm: boost super-liked profiles and profiles matching user's history
    if (user && superLikedIds.size > 0) {
      data = data.sort((a, b) => {
        const aScore = (superLikedIds.has(a.id) ? 30 : 0) + (savedIds.has(a.id) ? 10 : 0) + (a.spot_score || 0);
        const bScore = (superLikedIds.has(b.id) ? 30 : 0) + (savedIds.has(b.id) ? 10 : 0) + (b.spot_score || 0);
        return bScore - aScore;
      });
    }

    setProfiles(data);

    // Apply Talent vs Crew split
    let visible = data;
    if (tab === "talent") {
      visible = data.filter((p) => p.primary_role === "Actor");
    } else if (tab === "crew") {
      visible = data.filter((p) => p.primary_role && p.primary_role !== "Actor");
    }
    setProfiles(visible);

    // Build spot count map for visible profiles
    if (visible.length > 0) {
      const allSpots = await base44.entities.Spot.list("-created_date", 500);
      const countMap = {};
      allSpots.forEach((s) => { countMap[s.spotted_profile_id] = (countMap[s.spotted_profile_id] || 0) + 1; });
      setSpotCountMap(countMap);
    }

    setLoading(false);
  }, [filters, sort, searchQuery, proximity, tab]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleSave = async (profileId) => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    if (myProfile?.id === profileId) return; // prevent self-save
    // Optimistic update
    const wasSaved = savedIds.has(profileId);
    setSavedIds((prev) => { const next = new Set(prev); wasSaved ? next.delete(profileId) : next.add(profileId); return next; });
    if (wasSaved) {
      const saved = await base44.entities.SavedProfile.filter({ user_id: user.id, profile_id: profileId });
      if (saved.length > 0) await base44.entities.SavedProfile.delete(saved[0].id);
    } else {
      await base44.entities.SavedProfile.create({ user_id: user.id, profile_id: profileId });
    }
  };

  const handleSuperLike = async (profileId) => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    // Optimistic update
    setSuperLikedIds((prev) => new Set(prev).add(profileId));
    setSavedIds((prev) => new Set(prev).add(profileId));
    const existing = await base44.entities.SavedProfile.filter({ user_id: user.id, profile_id: profileId });
    if (existing.length > 0) {
      await base44.entities.SavedProfile.update(existing[0].id, { is_super_liked: true });
    } else {
      await base44.entities.SavedProfile.create({ user_id: user.id, profile_id: profileId, is_super_liked: true });
    }
  };

  const { pullY, refreshing } = usePullToRefresh(loadProfiles);

  return (
    <div className="pt-20">
      {/* Pull-to-refresh indicator */}
      {(pullY > 0 || refreshing) && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center w-9 h-9 bg-card border border-border rounded-full shadow-md transition-transform"
          style={{ transform: `translateX(-50%) translateY(${Math.min(pullY, 56)}px)` }}
        >
          <div className={`w-4 h-4 border-2 border-primary border-t-transparent rounded-full ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: refreshing ? undefined : `rotate(${(pullY / 56) * 360}deg)` }}
          />
        </div>
      )}
      {/* Hero Search Strip */}
      <div className="relative py-12 sm:py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full" />

        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground" style={{ letterSpacing: "-1px" }}>
            Find cast & crew
          </h1>
          <p className="text-muted-foreground mt-3 text-sm sm:text-base">
            Search by role, location, experience, and availability.
          </p>

          <div className="mt-8 rounded-2xl p-4 sm:p-6 max-w-3xl mx-auto border border-border bg-card">
            {/* Directory tabs */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-secondary border border-border mb-4 mx-auto w-fit" data-testid="directory-tabs">
              {[
                { id: "talent", label: "Talent" },
                { id: "crew", label: "Crew" },
                { id: "companies", label: "Companies" },
              ].map((t) => (
                <button
                  key={t.id}
                  data-testid={`tab-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`px-4 sm:px-6 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-colors ${
                    tab === t.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, role, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border/50 h-11"
                />
              </div>
              <Button className="h-11 px-6 font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>

            {/* Quick toggles */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {[
                { key: "availableNow", label: "Available Now" },
                { key: "proOnly", label: "PRO Only" },
                { key: "imdbLinked", label: "IMDb Linked" },
                { key: "verifiedOnly", label: "Verified" },
              ].map((toggle) => (
                <button
                  key={toggle.key}
                  onClick={() => setFilters((f) => ({ ...f, [toggle.key]: !f[toggle.key] }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filters[toggle.key]
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {toggle.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex gap-8">
          <SearchFilters filters={filters} onChange={setFilters} isProUser={myProfile?.is_pro} proximity={proximity} onProximityChange={setProximity} />

          <div className="flex-1 min-w-0">
            {/* Results header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {loading ? "Searching..." : (tab === "companies" ? `${companies.length} companies found` : `${profiles.length} profiles found`)}
                </span>
                <div className="lg:hidden">
                  <SearchFilters filters={filters} onChange={setFilters} isProUser={myProfile?.is_pro} proximity={proximity} onProximityChange={setProximity} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    title="Grid view"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("map")}
                    className={`p-1.5 rounded transition-colors ${viewMode === "map" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    title="Map view"
                  >
                    <Map className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-48 bg-secondary border-border hidden sm:flex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
            </div>

            {/* Results */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tab === "companies" ? (
              companies.length === 0 ? (
                <div className="text-center py-20">
                  <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="font-display text-lg font-semibold text-foreground">No companies yet</h3>
                  <p className="text-sm text-muted-foreground mt-2">Be the first — <a href="/create-company" className="text-primary underline">create your company profile</a>.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {companies.map((c, i) => (
                    <CompanyProfileCard key={c.id} company={c} index={i} />
                  ))}
                </div>
              )
            ) : profiles.length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-display text-lg font-semibold text-foreground">No profiles found</h3>
                <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters or search query.</p>
              </div>
            ) : viewMode === "map" ? (
              <MapView profiles={profiles} center={proximity} />
            ) : (
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {profiles.map((profile, i) => (
                  <div key={profile.id} className="relative group">
                   <ProfileCard
                     profile={profile}
                     index={i}
                     onSave={handleSave}
                     isSaved={savedIds.has(profile.id)}
                     spotCount={spotCountMap[profile.id] || 0}
                   />
                   {profile._distKm !== undefined && (
                     <div className="absolute top-3 left-3 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary text-primary-foreground z-10">
                       {profile._distKm} km
                     </div>
                   )}
                   <button
                     onClick={() => handleSuperLike(profile.id)}
                     title="Super Like"
                     className={`absolute bottom-[88px] right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                       superLikedIds.has(profile.id)
                         ? "bg-yellow-500/30 text-yellow-400"
                         : "bg-card/80 backdrop-blur-sm border border-border/50 text-muted-foreground opacity-0 group-hover:opacity-100"
                     }`}
                   >
                     <Star className={`w-3.5 h-3.5 ${superLikedIds.has(profile.id) ? "fill-yellow-400" : ""}`} />
                   </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}