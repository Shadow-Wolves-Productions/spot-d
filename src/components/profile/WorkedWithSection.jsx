import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { UserCheck, CheckCircle } from "lucide-react";

export default function WorkedWithSection({ profileId }) {
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    const load = async () => {
      const data = await base44.entities.WorkedWith.filter({ profile_id: profileId }, "-year", 20);
      setConnections(data);
    };
    load();
  }, [profileId]);

  if (connections.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
        <UserCheck className="w-5 h-5 text-primary" /> Worked With
      </h2>
      <div className="space-y-2">
        {connections.map((conn) => (
          <div
            key={conn.id}
            className="flex items-center justify-between bg-secondary/30 rounded-lg p-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-muted-foreground">
                  {conn.person_name?.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{conn.person_name}</p>
                  {conn.is_confirmed && (
                    <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {conn.person_role} · {conn.project_title}
                </p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{conn.year}</span>
          </div>
        ))}
      </div>
    </section>
  );
}