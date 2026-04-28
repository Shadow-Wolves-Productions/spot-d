import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import ProfileCard from "../ProfileCard";
import { useQuery } from "@tanstack/react-query";

export default function FeaturedProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const top = await base44.entities.Profile.list("-spot_score", 16);
      const visible = top.filter((p) => !p.is_minor_profile).slice(0, 8);
      setProfiles(visible);
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
    <section className="py-20 px-4" data-testid="featured-profiles-section">
      <div className="max-w-7xl mx-auto">
        {/* Section header — editorial */}
        <div className="mb-10 border-b border-border pb-4">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">In the spotlight</span>
                <h2 className="font-display font-500 text-4xl sm:text-5xl text-foreground mt-1" style={{ letterSpacing: "-1px" }}>
                  Profiles worth watching
                </h2>
              </div>
              <Link to="/search" className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                View full directory <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {profiles.map((profile, i) => (
            <ProfileCard key={profile.id} profile={profile} index={i} featured={profile.is_boosted} subscription={null} />
          ))}
        </div>

        <div className="mt-8 sm:hidden">
          <Link to="/search" className="flex items-center justify-center gap-2 text-sm font-medium text-foreground border border-border rounded-full py-3 hover:border-primary transition-colors">
            View full directory <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}