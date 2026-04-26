import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SpotsSection({ profileId }) {
  const [spots, setSpots] = useState([]);

  useEffect(() => {
    const load = async () => {
      const data = await base44.entities.Spot.filter({ spotted_profile_id: profileId }, "-created_date", 50);
      setSpots(data);
    };
    load();
  }, [profileId]);

  if (spots.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary" /> Spots
        <span className="text-sm font-normal text-muted-foreground">({spots.length})</span>
      </h2>
      <div className="glass-effect rounded-lg px-4 py-3 flex items-center gap-3">
        <Zap className="w-5 h-5 text-primary flex-shrink-0" />
        <span className="text-sm text-foreground">
          <span className="font-semibold text-primary">{spots.length}</span> {spots.length === 1 ? "person has" : "people have"} spotted this profile
        </span>
      </div>
    </section>
  );
}