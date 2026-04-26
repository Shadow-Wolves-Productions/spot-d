import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from "recharts";
import { Crown, TrendingUp, Eye, MousePointerClick, MapPin, Lock, Star, Users, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import AnalyticsAdvanced from "../components/AnalyticsAdvanced";

// Build daily chart data from raw ProfileView records
function buildViewData(views, saves, rangeDays) {
  const days = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    days.push({
      date: dateStr,
      views: views.filter((v) => { const t = new Date(v.created_date).getTime(); return t >= dayStart && t < dayEnd; }).length,
      saves: saves.filter((v) => { const t = new Date(v.created_date).getTime(); return t >= dayStart && t < dayEnd; }).length,
    });
  }
  return days;
}

// Build weekly search appearances from raw SearchAppearance records
function buildSearchData(appearances) {
  const weeks = [
    { week: "Wk 1", appearances: 0 },
    { week: "Wk 2", appearances: 0 },
    { week: "Wk 3", appearances: 0 },
    { week: "Wk 4", appearances: 0 },
  ];
  const now = Date.now();
  appearances.forEach((a) => {
    const daysAgo = (now - new Date(a.created_date).getTime()) / 86400000;
    if (daysAgo <= 7) weeks[3].appearances++;
    else if (daysAgo <= 14) weeks[2].appearances++;
    else if (daysAgo <= 21) weeks[1].appearances++;
    else if (daysAgo <= 28) weeks[0].appearances++;
  });
  return weeks;
}

// Build portfolio CTR data from PortfolioClick records
function buildPortfolioData(clicks) {
  const ASSET_LABELS = {
    showreel: "Showreel",
    headshot_1: "Headshot 1",
    headshot_2: "Headshot 2",
    resume: "Resume",
    imdb: "IMDb Link",
  };
  const total = clicks.length || 1;
  const counts = {};
  clicks.forEach((c) => { counts[c.asset_type] = (counts[c.asset_type] || 0) + 1; });
  return Object.entries(ASSET_LABELS).map(([key, label]) => ({
    item: label,
    clicks: counts[key] || 0,
    ctr: Math.round(((counts[key] || 0) / total) * 100),
  }));
}

function StatCard({ icon: Icon, label, value, change, changeDir }) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${changeDir === "up" ? "text-green-500" : "text-red-400"}`}>
            {changeDir === "up" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {change}%
          </div>
        )}
      </div>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function LockedOverlay() {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10 gap-3">
      <Lock className="w-6 h-6 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">Pro or Elite required</p>
      <Link to="/pricing">
        <Button size="sm" className="bg-primary text-primary-foreground">Upgrade Now</Button>
      </Link>
    </div>
  );
}

export default function Analytics() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rawViews, setRawViews] = useState([]);
  const [rawSaves, setRawSaves] = useState([]);
  const [rawSearches, setRawSearches] = useState([]);
  const [rawClicks, setRawClicks] = useState([]);
  const [range, setRange] = useState(30);

  useEffect(() => {
    const load = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) { base44.auth.redirectToLogin(); return; }
      const me = await base44.auth.me();
      setUser(me);
      const profiles = await base44.entities.Profile.filter({ user_id: me.id });
      if (profiles.length > 0) {
        const p = profiles[0];
        setProfile(p);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const [views, saves, searches, clicks] = await Promise.all([
          base44.entities.ProfileView.filter({ profile_id: p.id }),
          base44.entities.SavedProfile.filter({ profile_id: p.id }),
          base44.entities.SearchAppearance.filter({ profile_id: p.id }),
          base44.entities.PortfolioClick.filter({ profile_id: p.id }),
        ]);
        setRawViews(views);
        setRawSaves(saves);
        setRawSearches(searches);
        setRawClicks(clicks);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isPro = profile?.is_pro;
  const isElite = profile?.is_elite;
  const hasAccess = isPro || isElite;

  const viewData = buildViewData(rawViews, rawSaves, range);
  const portfolioData = buildPortfolioData(rawClicks);
  const searchData = buildSearchData(rawSearches);

  const totalViews = viewData.reduce((s, d) => s + d.views, 0);
  const totalSaves = viewData.reduce((s, d) => s + d.saves, 0);
  const totalSearches = rawSearches.filter((a) => {
    const now = Date.now();
    return (now - new Date(a.created_date).getTime()) / 86400000 <= 30;
  }).length;
  const avgCTR = portfolioData.length
    ? Math.round(portfolioData.reduce((s, d) => s + d.ctr, 0) / portfolioData.length)
    : 0;

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-display text-3xl font-bold text-foreground" style={{ letterSpacing: "-1px" }}>Profile analytics</h1>
              {isElite && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                  <Star className="w-2.5 h-2.5 mr-1" /> Elite
                </Badge>
              )}
              {isPro && !isElite && (
                <Badge className="bg-secondary text-foreground border-border text-[10px]">
                  <Crown className="w-2.5 h-2.5 mr-1" /> Pro
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Understand how your Spot'd profile is performing</p>
          </div>

          {/* Range selector */}
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  range === d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {!hasAccess && (
          <div className="bg-card border border-primary/30 rounded-xl p-6 mb-8 text-center">
            <Crown className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-display text-lg font-semibold text-foreground">Analytics is a Pro &amp; Elite feature</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Upgrade to Pro or Elite to see detailed insights on your profile views, portfolio engagement, and regional reach.
            </p>
            <Link to="/pricing" className="inline-block mt-4">
              <Button className="bg-primary text-primary-foreground">View Plans</Button>
            </Link>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Eye} label={`Profile views (${range}d)`} value={hasAccess ? totalViews : "—"} />
           <StatCard icon={Users} label={`Profile saves (${range}d)`} value={hasAccess ? totalSaves : "—"} />
           <StatCard icon={MousePointerClick} label="Avg portfolio CTR" value={hasAccess ? `${avgCTR}%` : "—"} />
          <StatCard icon={TrendingUp} label="Search appearances (mo)" value={hasAccess ? totalSearches : "—"} change={undefined} />
        </div>

        {/* Views Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative bg-card border border-border/60 rounded-xl p-6 mb-6"
        >
          {!hasAccess && <LockedOverlay />}
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider mb-6">
            Profile Views &amp; Saves
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={viewData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={range === 7 ? 0 : range === 14 ? 1 : 4} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#viewGrad)" name="Views" />
              <Line type="monotone" dataKey="saves" stroke="hsl(var(--success))" strokeWidth={1.5} dot={false} name="Saves" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Portfolio CTR */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative bg-card border border-border/60 rounded-xl p-6"
          >
            {!hasAccess && <LockedOverlay />}
            <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider mb-6">
              Portfolio Click-Through Rate
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={portfolioData} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="item" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="%" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${v}%`, "CTR"]}
                />
                <Bar dataKey="ctr" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="CTR" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Regional Engagement */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative bg-card border border-border/60 rounded-xl p-6"
          >
            {!hasAccess && <LockedOverlay />}
            {(!hasAccess || !isElite) && hasAccess && (
              <div className="absolute top-4 right-4">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                  <Star className="w-2.5 h-2.5 mr-1" /> Elite
                </Badge>
              </div>
            )}
            <div className="flex items-center gap-2 mb-6">
              <MapPin className="w-4 h-4 text-primary" />
              <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                Regional Engagement
              </h3>
            </div>
            <div className="space-y-3">
              {[
               { region: "Sydney", pct: 38 },
               { region: "Melbourne", pct: 27 },
               { region: "Brisbane", pct: 15 },
               { region: "Perth", pct: 10 },
               { region: "Adelaide", pct: 6 },
               { region: "Other", pct: 4 },
             ].map((r) => (
                <div key={r.region} className="flex items-center gap-3">
                  <span className="text-sm text-foreground w-20 flex-shrink-0">{r.region}</span>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700"
                      style={{ width: isElite ? `${r.pct}%` : "0%" }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {isElite ? `${r.pct}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
            {!isElite && hasAccess && (
              <div className="mt-5 p-3 bg-secondary/50 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Regional heatmaps are an <span className="text-primary font-semibold">Elite</span> feature.</p>
                <Link to="/pricing">
                  <Button size="sm" variant="outline" className="mt-2 border-primary/30 text-primary text-xs">Go Elite</Button>
                </Link>
              </div>
            )}
          </motion.div>
        </div>

        {/* Search appearances */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="relative bg-card border border-border/60 rounded-xl p-6"
        >
          {!hasAccess && <LockedOverlay />}
          <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider mb-6">
            Search Directory Appearances (This Month)
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={searchData} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="appearances" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Appearances" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Tier-gated SpotScore History + Who Saved You + Who Revealed Contact */}
        <AnalyticsAdvanced />

      </div>
    </div>
  );
}