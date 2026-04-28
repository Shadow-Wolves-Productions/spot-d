import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Mail, KeyRound, Loader2 } from "lucide-react";

export default function Login() {
  const [step, setStep] = useState("email"); // email | code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devCode, setDevCode] = useState("");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get("next") || "/dashboard";

  useEffect(() => {
    base44.auth.isAuthenticated().then((ok) => {
      if (ok) navigate(next);
    });
  }, [navigate, next]);

  const submitEmail = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      const res = await base44.auth.requestCode(email.trim().toLowerCase());
      setStep("code");
      setInfo("We sent a 6-digit code to your email. It expires in 10 minutes.");
      if (res.dev_code) setDevCode(res.dev_code);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Couldn't send code");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await base44.auth.verifyCode(email.trim().toLowerCase(), code.trim());
      // If user has no profile, send them to create
      if (!res.profile) navigate("/create-profile");
      else navigate(next);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
        data-testid="login-container"
      >
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
          <img src="/brand/dark-transparent.png" alt="Spot'd" className="h-12 w-auto mb-6" data-testid="login-logo" />
          <h1 className="font-display text-3xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>
            Sign in
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-[1.7]">
            {step === "email"
              ? "No password. Enter your email — we'll send a one-time code."
              : `Code sent to ${email}. Enter the 6-digit code below.`}
          </p>

          {step === "email" && (
            <form onSubmit={submitEmail} className="mt-8 space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="login-email-input"
                  type="email"
                  required
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-background border-border"
                />
              </div>
              {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
              <Button
                data-testid="login-send-code-btn"
                type="submit"
                disabled={loading || !email}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send code <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={submitCode} className="mt-8 space-y-4">
              {info && <p className="text-sm text-muted-foreground">{info}</p>}
              {devCode && (
                <p className="text-xs font-mono p-3 rounded bg-secondary border border-border" data-testid="login-dev-code">
                  Dev mode code: <span className="font-bold text-primary">{devCode}</span>
                </p>
              )}
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="login-code-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="pl-10 h-11 bg-background border-border tracking-[0.4em] font-mono text-center text-lg"
                />
              </div>
              {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
              <Button
                data-testid="login-verify-btn"
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & sign in"}
              </Button>
              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); setError(""); setDevCode(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
                data-testid="login-back-btn"
              >
                ← Use a different email
              </button>
            </form>
          )}

          <p className="text-xs text-muted-foreground mt-8">
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline hover:text-foreground">Terms</Link> and{" "}
            <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
