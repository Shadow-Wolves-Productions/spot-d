import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, MapPin, Calendar, DollarSign, Briefcase, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import ApplyModal from "../components/casting/ApplyModal";

const TYPE_COLORS = {
  "Feature Film": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Short Film": "text-green-400 bg-green-500/10 border-green-500/20",
  "TV Series": "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Commercial": "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "Music Video": "text-pink-400 bg-pink-500/10 border-pink-500/20",
  "Documentary": "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

function CastingCallCard({ call, myProfile, index }) {
  const [applyOpen, setApplyOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="bg-card border border-border/60 rounded-xl p-6 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[call.project_type] || "text-muted-foreground border-border"}`}>
              {call.project_type || "Project"}
            </Badge>
            {call.compensation && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                {call.compensation}
              </Badge>
            )}
          </div>

          <h3 className="font-display text-lg font-semibold text-foreground leading-tight mb-1">
            {call.project_title}
          </h3>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {call.description}
          </p>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {call.roles_needed?.map((role) => (
              <span key={role} className="px-2 py-1 rounded-md bg-secondary/60 text-xs text-foreground">
                {role}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {call.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {call.location}
              </div>
            )}
            {call.shoot_dates && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {call.shoot_dates}
              </div>
            )}
            {call.budget_range && (
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> {call.budget_range}
              </div>
            )}
            {call.experience_level && call.experience_level !== "Any" && (
              <div className="flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> {call.experience_level}
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0">
          {myProfile ? (
            <Button
              onClick={() => setApplyOpen(true)}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              Apply
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => base44.auth.redirectToLogin()}
            >
              Sign in to Apply
            </Button>
          )}
        </div>
      </div>

      <ApplyModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        castingCall={call}
        myProfile={myProfile}
      />
    </motion.div>
  );
}

export default function CastingCalls() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const me = await base44.auth.me();
        setUser(me);
        const profiles = await base44.entities.Profile.filter({ user_id: me.id });
        if (profiles.length > 0) setMyProfile(profiles[0]);
      }
      const data = await base44.entities.CastingCall.filter({ is_active: true }, "-created_date", 50);
      setCalls(data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = filter === "all" ? calls : calls.filter((c) => c.project_type === filter);
  const types = [...new Set(calls.map((c) => c.project_type).filter(Boolean))];

  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}
      <div className="relative py-12 sm:py-16 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full" />

        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
            Casting &amp; Crew Calls
          </h1>
          <p className="text-muted-foreground mt-3 text-sm sm:text-base max-w-xl mx-auto">
            Open calls from filmmakers across Australia. One click to apply.
          </p>

          <div className="flex items-center justify-center gap-3 mt-8">
            {user && (
              <Link to="/casting/new">
                <Button className="glass-gold text-primary-foreground font-semibold">
                  <Plus className="w-4 h-4 mr-2" /> Post a Call
                </Button>
              </Link>
            )}
            {!user && (
              <Button onClick={() => base44.auth.redirectToLogin()} className="glass-gold text-primary-foreground font-semibold">
                <Plus className="w-4 h-4 mr-2" /> Post a Call
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${filter === "all" ? "glass-gold text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
          >
            All ({calls.length})
          </button>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${filter === t ? "glass-gold text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground">No open calls right now</h3>
            <p className="text-sm text-muted-foreground mt-2">Be the first to post a casting call.</p>
            {user && (
              <Link to="/casting/new" className="mt-6 inline-block">
                <Button className="bg-primary text-primary-foreground mt-4">
                  <Plus className="w-4 h-4 mr-2" /> Post a Call
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-20">
            {filtered.map((call, i) => (
              <CastingCallCard key={call.id} call={call} myProfile={myProfile} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}