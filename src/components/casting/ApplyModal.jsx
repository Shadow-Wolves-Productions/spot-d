import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function ApplyModal({ open, onClose, castingCall, myProfile }) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleApply = async () => {
    setSubmitting(true);
    const me = await base44.auth.me();

    // Check if already applied
    const existing = await base44.entities.CastingApplication.filter({
      casting_call_id: castingCall.id,
      applicant_user_id: me.id,
    });

    if (existing.length > 0) {
      toast.error("You've already applied to this call.");
      setSubmitting(false);
      return;
    }

    await base44.entities.CastingApplication.create({
      casting_call_id: castingCall.id,
      applicant_user_id: me.id,
      profile_id: myProfile.id,
      note: note.trim(),
      status: "pending",
    });

    setDone(true);
    setSubmitting(false);
  };

  const handleClose = () => {
    setNote("");
    setDone(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground">
            Apply — {castingCall?.project_title}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground mb-2">Application Sent</h3>
            <p className="text-muted-foreground text-sm">
              Your profile card has been submitted. The casting team will review it and be in touch.
            </p>
            <Button className="mt-6 bg-primary text-primary-foreground" onClick={handleClose}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Profile preview */}
            <div className="flex items-center gap-3 p-3 bg-secondary/40 rounded-lg">
              {myProfile?.profile_photo && (
                <img src={myProfile.profile_photo} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{myProfile?.preferred_name || myProfile?.full_name}</p>
                <p className="text-xs text-primary">{myProfile?.primary_role}</p>
                {myProfile?.city && <p className="text-xs text-muted-foreground">{myProfile.city}</p>}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Your full profile card will be shared automatically. Optionally leave a brief note:
            </p>

            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Optional: Why are you right for this role? (Keep it brief.)"
              className="bg-secondary border-border text-sm resize-none"
            />

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-border" onClick={handleClose}>Cancel</Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                disabled={submitting}
                onClick={handleApply}
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Apply Now</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}