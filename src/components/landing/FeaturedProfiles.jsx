import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowRight, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import ProfileCard from "../ProfileCard";

export default function FeaturedProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Show boosted profiles first, then fill with top PRO profiles
      const boosted = await base44.entities.Profile.filter({ is_boosted: true }, "-cine_score", 8);
      let data = boosted;
      if (data.length < 4) {
        const pro = await base44.entities.Profile.filter({ is_pro: true }, "-cine_score", 8);
        const extra = pro.filter((p) => !data.find((b) => b.id === p.id));
        data = [...data, ...extra].slice(0, 8);
      }
      setProfiles(data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </section>
    );
  }

  if (profiles.length === 0) return null;

  return (
    <section className="py-24 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-primary font-medium flex items-center gap-1.5"><Zap className="w-3 h-3" /> Featured This Week</span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mt-3">
              Spotlight Profiles
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Verified talent with strong credits and industry presence.
            </p>
          </div>
          <Link
            to="/search"
            className="hidden sm:flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {profiles.slice(0, 4).map((profile, i) => (
            <div key={profile.id} className="relative">
              {profile.is_boosted && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shadow-md">
                  <Zap className="w-2.5 h-2.5" /> Featured
                </div>
              )}
              <ProfileCard profile={profile} index={i} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}