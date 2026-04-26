import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ApplyModal({ open, onClose, castingCall, myProfile }) {
  const [roleAppliedFor, setRoleAppliedFor] = useState("");
  const [showreel, setShowreel] = useState(myProfile?.showreel_link || "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleApply = async () => {
    if (!roleAppliedFor) {
      toast.error("Please select a role you're applying for.");
      return;
    }
    setSubmitting(true);
    const me = await base44.auth.me();

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
      role_applied_for: roleAppliedFor,
      submitted_showreel: showreel.trim(),
      submitted_note: note.trim(),
      status: "pending",
      applied_at: new Date().toISOString(),
    });

    setDone(true);
    setSubmitting(false);
  };

  const handleClose = () => {
    setRoleAppliedFor("");
    setShowreel(myProfile?.showreel_link || "");
    setNote("");
    setDone(false);
    onClose();
  };

  const roles = castingCall?.roles_needed || [];

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

            {/* Role selector */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Role Applying For *</Label>
              <Select value={roleAppliedFor} onValueChange={setRoleAppliedFor}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Showreel */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Showreel URL</Label>
              <Input
                value={showreel}
                onChange={(e) => setShowreel(e.target.value)}
                placeholder="https://vimeo.com/yourshowreel"
                className="bg-secondary border-border text-sm"
              />
            </div>

            {/* Note */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Optional Note</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Why are you right for this role? (Keep it brief.)"
                className="bg-secondary border-border text-sm resize-none"
              />
            </div>

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