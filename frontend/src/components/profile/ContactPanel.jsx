import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Eye, Mail, Phone, Globe, Instagram, Linkedin, Film, Lock, Crown, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export default function ContactPanel({ profile, user, myProfile }) {
  const [revealed, setRevealed] = useState(false);
  const [revealCount, setRevealCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [revealLimit, setRevealLimit] = useState(5);

  useEffect(() => {
    if (!user) return;
    const checkReveals = async () => {
      const monthKey = new Date().toISOString().slice(0, 7);

      // Load subscription to get reveal limit
      const subs = await base44.entities.Subscription.filter({ user_id: user.id, status: "active" });
      if (subs.length > 0) {
        setRevealLimit(subs[0].contact_reveal_limit ?? 5);
      }

      const existing = await base44.entities.ContactReveal.filter({
        viewer_id: user.id,
        profile_id: profile.id,
      });
      if (existing.length > 0) setRevealed(true);

      const monthReveals = await base44.entities.ContactReveal.filter({
        viewer_id: user.id,
        month_key: monthKey,
      });
      setRevealCount(monthReveals.length);
    };
    checkReveals();
  }, [user, profile.id]);

  const handleReveal = async () => {
    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }
    setLoading(true);
    const monthKey = new Date().toISOString().slice(0, 7);
    await base44.entities.ContactReveal.create({
      viewer_id: user.id,
      profile_id: profile.id,
      month_key: monthKey,
    });
    setRevealed(true);
    setRevealCount((c) => c + 1);
    setLoading(false);
  };

  const isUnlimited = revealLimit === -1;
  const canReveal = isUnlimited || revealCount < revealLimit;
  const isOwnProfile = user && profile.user_id === user.id;

  const contactMethods = [
    { icon: Mail, label: "Email", value: profile.email },
    { icon: Phone, label: "Phone", value: profile.phone },
    { icon: Instagram, label: "Instagram", value: profile.instagram, isLink: true, prefix: "https://instagram.com/" },
    { icon: Linkedin, label: "LinkedIn", value: profile.linkedin, isLink: true },
    { icon: Globe, label: "Website", value: profile.website, isLink: true },
    { icon: Film, label: "IMDb", value: profile.imdb_link, isLink: true },
  ].filter((m) => m.value);

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
      <div className="p-6">
        <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
          Contact Details
        </h3>

        <AnimatePresence mode="wait">
          {revealed || isOwnProfile ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {contactMethods.length > 0 ? (
                contactMethods.map((method) => (
                  <div key={method.label} className="flex items-center gap-3 text-sm">
                    <method.icon className="w-4 h-4 text-primary flex-shrink-0" />
                    {method.isLink ? (
                      <a
                        href={method.value.startsWith("http") ? method.value : `${method.prefix || ""}${method.value}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:text-primary transition-colors truncate"
                      >
                        {method.value}
                      </a>
                    ) : (
                      <span className="text-foreground truncate">{method.value}</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No contact details available.</p>
              )}

              {(profile.agent_name || profile.agent_email) && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Agent / Manager</p>
                  {profile.agent_name && <p className="text-sm text-foreground">{profile.agent_name}</p>}
                  {profile.agent_email && (
                    <a href={`mailto:${profile.agent_email}`} className="text-sm text-primary hover:underline">
                      {profile.agent_email}
                    </a>
                  )}
                  {profile.agent_phone && <p className="text-sm text-muted-foreground">{profile.agent_phone}</p>}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded bg-secondary" />
                    <div className="h-4 rounded bg-secondary flex-1" />
                  </div>
                ))}
              </div>

              {canReveal ? (
                <Button
                  onClick={handleReveal}
                  disabled={loading}
                  className="w-full glass-gold text-primary-foreground font-semibold h-11 gold-glow"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Reveal Contact Details
                    </>
                  )}
                </Button>
              ) : (
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Lock className="w-4 h-4" />
                    <span>You've used all {revealLimit} free reveals this month</span>
                  </div>
                  <Button className="w-full bg-primary text-primary-foreground">
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to PRO for Unlimited
                  </Button>
                </div>
              )}

              {!isUnlimited && canReveal && (
                <p className="text-center text-xs text-muted-foreground">
                  {revealLimit - revealCount} free reveals remaining this month
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}