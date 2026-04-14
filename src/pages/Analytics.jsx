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

// Mock analytics data — replace with real tracking entity when available
function generateViewData() {
  const days = [];
  let base = 18;
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    base = Math.max(5, base + Math.round((Math.random() - 0.45) * 8));
    days.push({
      date: date.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
      views: base,
      saves: Math.max(0, Math.round(base * 0.12 + Math.random() * 2)),
    });
  }
  return days;
}

const PORTFOLIO_CTR = [
  { item: "Showreel", clicks: 142, ctr: 68 },
  { item: "Headshot 1", clicks: 98, ctr: 47 },
  { item: "Headshot 2", clicks: 74, ctr: 35 },
  { item: "Resume", clicks: 56, ctr: 27 },
  { item: "IMDb Link", clicks: 39, ctr: 19 },
];

const REGIONAL_DATA = [
  { region: "Sydney", count: 84, pct: 38 },
  { region: "Melbourne", count: 61, pct: 27 },
  { region: "Brisbane", count: 34, pct: 15 },
  { region: "Perth", count: 22, pct: 10 },
  { region: "Adelaide", count: 14, pct: 6 },
  { region: "Other", count: 9, pct: 4 },
];

const SEARCH_APPEARANCES = [
  { week: "Wk 1", appearances: 42 },
  { week: "Wk 2", appearances: 57 },
  { week: "Wk 3", appearances: 49 },
  { week: "Wk 4", appearances: 73 },
];

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
  const [viewData] = useState(generateViewData);
  const [range, setRange] = useState(30);

  useEffect(() => {
    const load = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) { base44.auth.redirectToLogin(); return; }
      const me = await base44.auth.me();
      setUser(me);
      const profiles = await base44.entities.Profile.filter({ user_id: me.id });
      if (profiles.length > 0) setProfile(profiles[0]);
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

  const slicedViews = viewData.slice(viewData.length - range);
  const totalViews = slicedViews.reduce((s, d) => s + d.views, 0);
  const totalSaves = slicedViews.reduce((s, d) => s + d.saves, 0);
  const avgCTR = Math.round(PORTFOLIO_CTR.reduce((s, d) => s + d.ctr, 0) / PORTFOLIO_CTR.length);

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
          <StatCard icon={Eye} label={`Profile views (${range}d)`} value={hasAccess ? totalViews : "—"} change={12} changeDir="up" />
          <StatCard icon={Users} label={`Profile saves (${range}d)`} value={hasAccess ? totalSaves : "—"} change={5} changeDir="up" />
          <StatCard icon={MousePointerClick} label="Avg portfolio CTR" value={hasAccess ? `${avgCTR}%` : "—"} change={3} changeDir="down" />
          <StatCard icon={TrendingUp} label="Search appearances (mo)" value={hasAccess ? "221" : "—"} change={18} changeDir="up" />
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
            <AreaChart data={slicedViews} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
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
              <BarChart data={PORTFOLIO_CTR} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
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
              {REGIONAL_DATA.map((r) => (
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
            <BarChart data={SEARCH_APPEARANCES} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="appearances" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Appearances" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

      </div>
    </div>
  );
}