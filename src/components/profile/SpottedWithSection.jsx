import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Users, CheckCircle, Film } from "lucide-react";

export default function SpottedWithSection({ profileId }) {
  const [connections, setConnections] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [asA, asB] = await Promise.all([
        base44.entities.SpottedWith.filter({ profile_id_a: profileId }),
        base44.entities.SpottedWith.filter({ profile_id_b: profileId }),
      ]);
      const all = [...asA, ...asB];
      setConnections(all);

      // Fetch the other profiles
      const otherIds = all.map(c => c.profile_id_a === profileId ? c.profile_id_b : c.profile_id_a);
      const uniqueIds = [...new Set(otherIds)];
      const profileMap = {};
      await Promise.all(uniqueIds.map(async id => {
        const res = await base44.entities.Profile.filter({ id });
        if (res.length > 0) profileMap[id] = res[0];
      }));
      setProfiles(profileMap);
      setLoading(false);
    };
    load();
  }, [profileId]);

  if (loading) return null;

  if (connections.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> Frequently Spotted With
        </h2>
        <p className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-4">
          Add credits to your profile to discover crew you've worked with on Spot'd.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" /> Frequently Spotted With
      </h2>
      <div className="space-y-2">
        {connections.map((conn) => {
          const otherId = conn.profile_id_a === profileId ? conn.profile_id_b : conn.profile_id_a;
          const other = profiles[otherId];
          if (!other) return null;
          const slug = other.profile_slug || other.id;
          return (
            <Link key={conn.id} to={`/profile/${slug}`}>
              <div className="flex items-center gap-3 bg-secondary/30 hover:bg-secondary/50 rounded-lg p-3 transition-colors">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary border border-border flex-shrink-0">
                  {other.profile_photo
                    ? <img src={other.profile_photo} alt={other.full_name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <span className="text-sm font-bold text-muted-foreground">{other.full_name?.charAt(0)}</span>
                      </div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{other.preferred_name || other.full_name}</p>
                    {conn.confirmed && (
                      <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" title="Verified connection" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{other.primary_role}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Film className="w-3 h-3" />
                    <span>{conn.times_matched} project{conn.times_matched !== 1 ? "s" : ""}</span>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider font-semibold mt-0.5 block ${
                    conn.match_confidence === "exact" ? "text-green-400" : "text-yellow-400"
                  }`}>
                    {conn.match_confidence === "exact" ? "exact match" : "fuzzy match"}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}