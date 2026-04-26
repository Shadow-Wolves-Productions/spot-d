import { useState } from "react";
import { Link } from "react-router-dom";
import { X, Camera, Film, Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const DISMISSED_KEY = "spotd_welcome_dismissed";

export default function WelcomeBanner({ user, profile }) {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(DISMISSED_KEY) === "true";
  });

  if (dismissed || !profile) return null;

  // Only show if welcome email was sent in the last 7 days OR profile has no photo
  const sentAt = profile.welcome_email_sent_at ? new Date(profile.welcome_email_sent_at) : null;
  const isRecent = sentAt && (Date.now() - sentAt.getTime()) < 7 * 24 * 60 * 60 * 1000;
  const isFirstTime = !profile.profile_photo; // No photo = clearly hasn't set up yet
  if (!isRecent && !isFirstTime) return null;

  const firstName = (profile.preferred_name || profile.full_name || '').split(' ')[0] || 'there';
  const completionPct = Math.min(profile.spot_score || 0, 100);

  const missingItems = [
    !profile.profile_photo && { icon: Camera, label: "Add a photo", to: "/create-profile" },
    !profile.showreel_link && { icon: Film, label: "Link your showreel", to: "/create-profile" },
    (!profile.credits || profile.credits.length === 0) && { icon: Star, label: "Add your credits", to: "/create-profile" },
  ].filter(Boolean).slice(0, 3);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-card overflow-hidden" style={{ boxShadow: "0 0 0 1px rgba(232,252,108,0.1), 0 4px 24px rgba(232,252,108,0.06)" }}>
      {/* Accent top bar */}
      <div className="h-1 w-full" style={{ background: "#E8FC6C" }} />

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-bold text-foreground">
              Welcome to Spot'd, {firstName}. 👋
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your profile is live — complete it to boost your SpotScore.
            </p>

            {/* Progress */}
            <div className="mt-4 mb-1 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Profile completion</span>
              <span className="text-xs font-bold text-primary font-mono">{completionPct}/100</span>
            </div>
            <Progress value={completionPct} className="h-1.5" />

            {/* Quick actions */}
            {missingItems.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {missingItems.map(({ icon: Icon, label, to }) => (
                  <Link key={label} to={to}>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted hover:border-primary/50 hover:bg-primary/5 transition-colors text-xs font-medium text-foreground">
                      <Icon className="w-3 h-3 text-primary" />
                      {label}
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}