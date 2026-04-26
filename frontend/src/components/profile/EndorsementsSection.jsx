import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function EndorsementsSection({ profileId }) {
  const [endorsements, setEndorsements] = useState([]);

  useEffect(() => {
    const load = async () => {
      const data = await base44.entities.Endorsement.filter({ profile_id: profileId }, "-created_date", 30);
      setEndorsements(data);
    };
    load();
  }, [profileId]);

  if (endorsements.length === 0) return null;

  const grouped = endorsements.reduce((acc, e) => {
    acc[e.endorsement_type] = (acc[e.endorsement_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary" /> Spots
      </h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries(grouped)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => (
            <div key={type} className="glass-effect rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-sm text-foreground">{type}</span>
              <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0">
                {count} spotted
              </Badge>
            </div>
          ))}
      </div>
    </section>
  );
}