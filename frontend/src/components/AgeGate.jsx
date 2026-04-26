import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldAlert, Sparkles } from "lucide-react";

const STORAGE_KEY = "spotd_age_gate_v1";

/**
 * Age gate shown before the registration / create-profile form.
 * - Asks: "Are you 18 or older?"
 * - If Yes: pass through.
 * - If No: requires parent/guardian/agent consent + minor performer profile is opt-in
 *   on the form itself.
 *
 * Returns:
 *   - onComplete({ is_minor, responsible_adult_consent, terms_accepted })
 */
export default function AgeGate({ onComplete }) {
  const [step, setStep] = useState("age"); // age | adult | minor-consent
  const [terms, setTerms] = useState(false);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    const cached = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.terms_accepted) onComplete(parsed);
      } catch { /* noop */ }
    }
  }, [onComplete]);

  const finish = (data) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, completed_at: new Date().toISOString() }));
    } catch { /* noop */ }
    onComplete(data);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center px-4 py-10">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 sm:p-10"
          data-testid="age-gate"
        >
          <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center mb-6">
            {step === "minor-consent" ? (
              <ShieldAlert className="w-5 h-5 text-primary" />
            ) : (
              <Sparkles className="w-5 h-5 text-primary" />
            )}
          </div>

          {step === "age" && (
            <>
              <h2 className="font-display text-3xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>
                Quick check first.
              </h2>
              <p className="text-muted-foreground mt-3 leading-[1.7]">
                Spot'd profiles for performers under 18 must be managed by a parent, legal guardian, or licensed agent. Please confirm your age.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <Button
                  data-testid="age-gate-under-btn"
                  variant="outline"
                  onClick={() => setStep("minor-consent")}
                  className="h-12 rounded-full border-border"
                >
                  Under 18
                </Button>
                <Button
                  data-testid="age-gate-over-btn"
                  onClick={() => setStep("adult")}
                  className="h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full"
                >
                  18 or older
                </Button>
              </div>
            </>
          )}

          {step === "adult" && (
            <>
              <h2 className="font-display text-3xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>
                One last thing.
              </h2>
              <p className="text-muted-foreground mt-3 leading-[1.7]">
                We need you to agree to our terms before you continue.
              </p>
              <label className="flex items-start gap-3 mt-8 cursor-pointer" data-testid="age-gate-terms-label">
                <Checkbox checked={terms} onCheckedChange={(v) => setTerms(!!v)} className="mt-1" data-testid="age-gate-terms-checkbox" />
                <span className="text-sm text-foreground/90 leading-[1.6]">
                  I agree to Spot'd's <a href="/terms" target="_blank" rel="noreferrer" className="underline hover:text-primary">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-primary">Privacy Policy</a>.
                </span>
              </label>
              <Button
                data-testid="age-gate-adult-continue"
                onClick={() => finish({ is_minor: false, responsible_adult_consent: false, terms_accepted: true })}
                disabled={!terms}
                className="w-full mt-8 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full"
              >
                Continue
              </Button>
              <button onClick={() => setStep("age")} className="block mx-auto mt-4 text-xs text-muted-foreground hover:text-foreground">
                ← Back
              </button>
            </>
          )}

          {step === "minor-consent" && (
            <>
              <h2 className="font-display text-3xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>
                Parent / guardian / agent consent
              </h2>
              <p className="text-muted-foreground mt-3 leading-[1.7]">
                Profiles for performers under 18 must be managed by a responsible adult. To continue, please confirm:
              </p>

              <ul className="text-sm text-foreground/85 mt-6 space-y-2 leading-[1.7] border border-border rounded-lg p-4 bg-secondary/30">
                <li>• You are the parent, legal guardian, or licensed agent of the minor performer.</li>
                <li>• Only your contact details (not the minor's) will be visible on the profile.</li>
                <li>• All communication initiated through Spot'd will be directed to you.</li>
              </ul>

              <label className="flex items-start gap-3 mt-6 cursor-pointer" data-testid="age-gate-minor-consent-label">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-1" data-testid="age-gate-minor-consent-checkbox" />
                <span className="text-sm text-foreground/90 leading-[1.6]">
                  I confirm I am a responsible adult (parent / guardian / agent) creating this profile on behalf of a minor, and I consent to managing all communication on their behalf.
                </span>
              </label>
              <label className="flex items-start gap-3 mt-3 cursor-pointer" data-testid="age-gate-minor-terms-label">
                <Checkbox checked={terms} onCheckedChange={(v) => setTerms(!!v)} className="mt-1" data-testid="age-gate-minor-terms-checkbox" />
                <span className="text-sm text-foreground/90 leading-[1.6]">
                  I agree to Spot'd's <a href="/terms" target="_blank" rel="noreferrer" className="underline hover:text-primary">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-primary">Privacy Policy</a>.
                </span>
              </label>

              <Button
                data-testid="age-gate-minor-continue"
                onClick={() => finish({ is_minor: true, responsible_adult_consent: true, terms_accepted: true })}
                disabled={!terms || !consent}
                className="w-full mt-8 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full"
              >
                Continue
              </Button>
              <button onClick={() => setStep("age")} className="block mx-auto mt-4 text-xs text-muted-foreground hover:text-foreground">
                ← Back
              </button>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
