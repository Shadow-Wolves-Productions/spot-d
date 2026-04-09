import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const RECOMMENDATION_TYPES = [
  "Reliable on set",
  "Great communicator",
  "Strong leadership",
  "Excellent with actors",
  "Calm under pressure",
  "Fast and professional",
  "Creative problem solver",
  "Technical excellence",
  "Team player",
  "Highly organized",
];

export default function RecommendModal({ profile, user, open, onClose }) {
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    await base44.entities.Endorsement.create({
      profile_id: profile.id,
      endorser_id: user.id,
      endorser_name: user.full_name,
      endorsement_type: selected,
    });
    setDone(true);
    setSubmitting(false);
  };

  const handleClose = () => {
    setSelected(null);
    setDone(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground flex items-center gap-2">
            <ThumbsUp className="w-5 h-5 text-primary" />
            Recommend {profile?.preferred_name || profile?.full_name}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="text-center py-8">
            <ThumbsUp className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground mb-2">Recommendation Sent!</h3>
            <p className="text-muted-foreground text-sm">Your recommendation has been added to their profile.</p>
            <Button className="mt-6 bg-primary text-primary-foreground" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Choose what best describes working with this person:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {RECOMMENDATION_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelected(type)}
                  className={`text-left px-3 py-2.5 rounded-lg text-sm border transition-all ${
                    selected === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary/30 text-foreground hover:border-primary/40"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 border-border" onClick={handleClose}>Cancel</Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!selected || submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Submitting..." : "Submit Recommendation"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}