import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Zap } from "lucide-react";

const SPOT_TYPES = [
  "Reliable on set", "Great communicator", "Strong leadership",
  "Excellent with actors", "Calm under pressure", "Fast and professional",
  "Creative problem solver", "Technical excellence", "Team player", "Highly organized"
];

export default function SpotRequestModal({ open, onClose, targetProfile, myProfile }) {
  const [selectedType, setSelectedType] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!selectedType) { toast.error("Please select a Spot type"); return; }
    setSending(true);
    // Check for duplicate
    const existing = await base44.entities.SpotRequest.filter({
      requester_profile_id: myProfile.id,
      target_profile_id: targetProfile.id,
      spot_type: selectedType,
    });
    if (existing.length > 0) {
      toast.error("You've already sent this Spot request.");
      setSending(false);
      return;
    }
    await base44.entities.SpotRequest.create({
      requester_profile_id: myProfile.id,
      requester_name: myProfile.preferred_name || myProfile.full_name,
      target_user_id: targetProfile.user_id,
      target_profile_id: targetProfile.id,
      spot_type: selectedType,
      message: message.trim() || undefined,
      status: "pending",
    });
    toast.success("Spot request sent!");
    setSelectedType("");
    setMessage("");
    setSending(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Spot {targetProfile?.preferred_name || targetProfile?.full_name}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Request that they endorse you — choose what you'd like them to spot you for.
        </p>

        <div className="grid grid-cols-2 gap-2 mt-2">
          {SPOT_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`text-xs px-3 py-2 rounded-lg border text-left transition-all ${
                selectedType === type
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <Textarea
          placeholder="Add an optional message... (e.g. 'We worked together on Thunk 2026')"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-2 bg-secondary border-border text-sm resize-none h-20"
        />

        <div className="flex gap-3 mt-2">
          <Button variant="outline" className="flex-1 border-border" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 bg-primary text-primary-foreground font-semibold"
            disabled={!selectedType || sending}
            onClick={handleSend}
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              : <><Zap className="w-4 h-4 mr-1" /> Send Spot Request</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}