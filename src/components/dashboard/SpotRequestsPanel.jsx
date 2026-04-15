import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Zap, Check, X, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SpotRequestsPanel({ user, profile }) {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [responding, setResponding] = useState(null);
  const [showOutgoing, setShowOutgoing] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    const load = async () => {
      const [inc, out] = await Promise.all([
        base44.entities.SpotRequest.filter({ target_user_id: user.id, status: "pending" }, "-created_date", 20),
        base44.entities.SpotRequest.filter({ requester_profile_id: profile.id }, "-created_date", 20),
      ]);
      setIncoming(inc);
      setOutgoing(out);
    };
    load();
  }, [user, profile]);

  const respond = async (requestId, action) => {
    setResponding(requestId);
    await base44.functions.invoke("respondToSpotRequest", { request_id: requestId, action });
    setIncoming(prev => prev.filter(r => r.id !== requestId));
    toast.success(action === "accepted" ? "You spotted them! 🎬" : "Request declined.");
    setResponding(null);
  };

  const pendingOutgoing = outgoing.filter(r => r.status === "pending");
  const resolvedOutgoing = outgoing.filter(r => r.status !== "pending");

  if (incoming.length === 0 && outgoing.length === 0) return null;

  return (
    <div className="bg-card border border-border/60 rounded-xl p-6 space-y-5">
      <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" /> Spot Requests
      </h3>

      {/* Incoming */}
      {incoming.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Incoming ({incoming.length})</p>
          {incoming.map(req => (
            <div key={req.id} className="bg-secondary/40 rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{req.requester_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">wants you to spot them as</p>
                  <Badge className="bg-primary/15 text-primary border-0 text-xs mt-1">{req.spot_type}</Badge>
                </div>
                <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              </div>
              {req.message && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-3">"{req.message}"</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 bg-primary text-primary-foreground font-semibold text-xs"
                  disabled={responding === req.id}
                  onClick={() => respond(req.id, "accepted")}
                >
                  {responding === req.id
                    ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    : <><Check className="w-3.5 h-3.5 mr-1" /> Spot them</>
                  }
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border text-xs"
                  disabled={responding === req.id}
                  onClick={() => respond(req.id, "declined")}
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Outgoing */}
      {outgoing.length > 0 && (
        <div className="space-y-2">
          <button
            className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground w-full text-left"
            onClick={() => setShowOutgoing(v => !v)}
          >
            Your Requests ({outgoing.length})
            {showOutgoing ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>
          {showOutgoing && (
            <div className="space-y-2">
              {outgoing.map(req => (
                <div key={req.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{req.spot_type}</p>
                    <p className="text-[10px] text-muted-foreground">→ {req.target_profile_id}</p>
                  </div>
                  <Badge className={`text-[10px] flex-shrink-0 ml-2 border-0 ${
                    req.status === "accepted" ? "bg-green-500/20 text-green-400" :
                    req.status === "declined" ? "bg-red-500/20 text-red-400" :
                    "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {req.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}