import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import ProfileCard from "../ProfileCard";

export default function FeaturedProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const boosted = await base44.entities.Profile.filter({ is_boosted: true }, "-cine_score", 8);
      let data = boosted;
      if (data.length < 4) {
        const pro = await base44.entities.Profile.filter({ is_pro: true }, "-cine_score", 8);
        const extra = pro.filter((p) => !data.find((b) => b.id === p.id));
        data = [...data, ...extra].slice(0, 8);
      }
      if (data.length < 4) {
        const top = await base44.entities.Profile.list("-cine_score", 8);
        const extra = top.filter((p) => !data.find((b) => b.id === p.id));
        data = [...data, ...extra].slice(0, 8);
      }
      setProfiles(data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto flex justify-center h-48 items-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  if (profiles.length === 0) return null;

  return (
    <section className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Section header — editorial */}
        <div className="mb-10">
          <div className="editorial-line pb-4">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-[0.25em] text-primary font-semibold">In the Spotlight</span>
                <h2 className="font-display font-bold text-4xl sm:text-5xl text-foreground mt-1">
                  Profiles Worth Watching
                </h2>
              </div>
              <Link to="/search" className="hidden sm:flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors border-b border-foreground pb-1 hover:border-primary">
                Full Directory <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {profiles.slice(0, 8).map((profile, i) => (
            <ProfileCard key={profile.id} profile={profile} index={i} featured={profile.is_boosted} />
          ))}
        </div>

        <div className="mt-8 sm:hidden">
          <Link to="/search" className="flex items-center justify-center gap-2 text-sm font-semibold text-foreground border border-foreground rounded-sm py-3 hover:bg-foreground hover:text-background transition-colors">
            View Full Directory <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}