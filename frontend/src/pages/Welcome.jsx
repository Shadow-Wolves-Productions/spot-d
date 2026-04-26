import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

export default function Welcome() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const plan = params.get("plan") || "PRO";
  const [status, setStatus] = useState(sessionId ? "checking" : "ready");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    let attempts = 0;
    const poll = async () => {
      try {
        const r = await base44.payments.status(sessionId);
        if (r.payment_status === "paid") {
          setStatus("paid");
          return;
        }
        if (r.status === "expired") {
          setError("Payment session expired.");
          setStatus("error");
          return;
        }
        attempts += 1;
        if (attempts >= 8) {
          setError("Still processing… check your email for confirmation.");
          setStatus("error");
          return;
        }
        setTimeout(poll, 2000);
      } catch (e) {
        setError(e?.response?.data?.detail || e.message);
        setStatus("error");
      }
    };
    poll();
  }, [sessionId]);

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full text-center"
      >
        <div className="rounded-2xl border border-primary/40 bg-card p-10">
          <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-primary/15 flex items-center justify-center">
            {status === "checking" ? (
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            ) : status === "paid" ? (
              <CheckCircle2 className="w-7 h-7 text-primary" />
            ) : (
              <Sparkles className="w-7 h-7 text-primary" />
            )}
          </div>
          <h1 className="font-display text-3xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>
            {status === "checking"
              ? "Confirming your payment…"
              : status === "paid"
              ? `Welcome to Spot'd ${plan.toUpperCase()}!`
              : status === "error"
              ? "Hmm, something's off"
              : "Welcome to Spot'd!"}
          </h1>
          <p className="text-muted-foreground mt-3 leading-[1.7]">
            {status === "paid"
              ? "Your subscription is active. Time to make your profile pop."
              : status === "error"
              ? error
              : "Your profile is live. Let's complete your setup."}
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link to="/dashboard">
              <Button data-testid="welcome-dashboard-btn" className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full">
                Go to dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/create-profile">
              <Button variant="outline" className="w-full h-11 rounded-full">
                Edit my profile
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
