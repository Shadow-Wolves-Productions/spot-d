import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Mail, KeyRound, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

/**
 * Hybrid auth flow:
 *
 *   step = "password"     → email + password (default)
 *   step = "code"         → enter OTP (registration / legacy migration / password reset)
 *   step = "set_password" → after OTP verified, set a new password
 *   step = "reset_password" → forgot-password OTP+new-password combined screen
 */
export default function Login() {
  const [step, setStep] = useState("password");
  const [mode, setMode] = useState("login"); // "login" | "register" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devCode, setDevCode] = useState("");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get("next") || "/dashboard";

  useEffect(() => {
    base44.auth.isAuthenticated().then((ok) => { if (ok) navigate(next); });
  }, [navigate, next]);

  const finishLogin = (res) => {
    if (!res.profile) navigate("/create-profile");
    else navigate(next);
  };

  // ---- LOGIN with password -------------------------------------------- //
  const submitPassword = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await base44.auth.login(email.trim().toLowerCase(), password);
      finishLogin(res);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 409 && detail?.code === "set_password_required") {
        // Legacy user — push them through OTP, then set-password.
        setMode("legacy");
        setInfo("This account doesn't have a password yet. We'll send a one-time code to verify your email — then you can set one.");
        await sendOtp(email.trim().toLowerCase());
        return;
      }
      setError(typeof detail === "string" ? detail : (detail?.message || err?.message || "Sign-in failed"));
    } finally {
      setLoading(false);
    }
  };

  // ---- OTP request (used for register, legacy, and reset) ------------- //
  const sendOtp = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    try {
      const res = await base44.auth.requestCode(email.trim().toLowerCase());
      setStep("code");
      setInfo("We sent a 6-digit code to your email. It expires in 10 minutes.");
      if (res.dev_code) setDevCode(res.dev_code);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Couldn't send code.");
    } finally {
      setLoading(false);
    }
  };

  // ---- OTP verify (register + legacy migration paths) ---------------- //
  const submitCode = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await base44.auth.verifyCode(email.trim().toLowerCase(), code.trim());
      // After OTP we're authenticated. If the account has no password yet
      // (registration or legacy migration), prompt for one before continuing.
      if (res.needs_password_setup) {
        setStep("set_password");
        setInfo("Email verified — set a password so you can sign in faster next time.");
      } else {
        finishLogin(res);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Invalid code.");
    } finally {
      setLoading(false);
    }
  };

  // ---- Set new password (after OTP) ---------------------------------- //
  const submitSetPassword = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await base44.auth.setPassword(newPassword);
      // We're already signed in via the OTP-issued token. Continue.
      const profile = await base44.entities.Profile.filter({ user_id: (await base44.auth.me()).id }, undefined, 1).catch(() => []);
      if (!profile?.length) navigate("/create-profile");
      else navigate(next);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Couldn't save password.");
    } finally {
      setLoading(false);
    }
  };

  // ---- One-shot reset (forgot password) ------------------------------ //
  const submitReset = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await base44.auth.resetPassword(email.trim().toLowerCase(), code.trim(), newPassword);
      finishLogin(res);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Couldn't reset password.");
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
          <img src="/brand/master-badge.png?v=3" alt="Spot'd" className="h-14 w-auto mb-6" data-testid="login-logo" />

          {/* HEADLINE */}
          {step === "password" && (
            <>
              <h1 className="font-display text-3xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>
                {mode === "register" ? "Create your account" : "Sign in"}
              </h1>
              <p className="text-sm text-muted-foreground mt-2 leading-[1.7]">
                {mode === "register"
                  ? "Enter your email — we'll send a one-time code, then you'll set a password."
                  : "Welcome back. Enter your email and password."}
              </p>
            </>
          )}
          {step === "code" && (
            <>
              <h1 className="font-display text-3xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>Verify your email</h1>
              <p className="text-sm text-muted-foreground mt-2">Code sent to <strong className="text-foreground">{email}</strong>.</p>
            </>
          )}
          {step === "set_password" && (
            <>
              <h1 className="font-display text-3xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>Set a password</h1>
              <p className="text-sm text-muted-foreground mt-2">Choose at least 8 characters. You'll use this to sign in next time.</p>
            </>
          )}
          {step === "reset_password" && (
            <>
              <h1 className="font-display text-3xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>Reset your password</h1>
              <p className="text-sm text-muted-foreground mt-2">Enter the 6-digit code we sent to <strong className="text-foreground">{email}</strong> and choose a new password.</p>
            </>
          )}

          {/* FORM: PASSWORD LOGIN (default) */}
          {step === "password" && mode !== "register" && (
            <form onSubmit={submitPassword} className="mt-8 space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="login-email-input"
                  type="email" required autoFocus placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-background border-border"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  required placeholder="Your password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-background border-border"
                />
                <button
                  type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  data-testid="login-toggle-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {info && <p className="text-sm text-muted-foreground">{info}</p>}
              {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
              <Button
                data-testid="login-submit-btn"
                type="submit" disabled={loading || !email || !password}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => { setMode("register"); setError(""); setInfo(""); }}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="login-register-link"
                >
                  New here? Create account
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!email) { setError("Enter your email first."); return; }
                    setMode("reset");
                    await sendOtp();
                    setStep("reset_password");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="login-forgot-password"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          )}

          {/* FORM: REGISTER (email-only first step) */}
          {step === "password" && mode === "register" && (
            <form onSubmit={sendOtp} className="mt-8 space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="register-email-input"
                  type="email" required autoFocus placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-background border-border"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                data-testid="register-send-code-btn"
                type="submit" disabled={loading || !email}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send verification code <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Already have an account? Sign in
              </button>
            </form>
          )}

          {/* FORM: VERIFY OTP */}
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
                  type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} required autoFocus
                  placeholder="123456" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="pl-10 h-11 bg-background border-border tracking-[0.4em] font-mono text-center text-lg"
                />
              </div>
              {error && <p className="text-sm text-destructive" data-testid="login-error">{error}</p>}
              <Button
                data-testid="login-verify-btn"
                type="submit" disabled={loading || code.length !== 6}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify code"}
              </Button>
              <button
                type="button"
                onClick={() => { setStep("password"); setMode("login"); setCode(""); setError(""); setDevCode(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
                data-testid="login-back-btn"
              >
                ← Back to sign in
              </button>
            </form>
          )}

          {/* FORM: SET NEW PASSWORD (after OTP) */}
          {step === "set_password" && (
            <form onSubmit={submitSetPassword} className="mt-8 space-y-4">
              {info && <p className="text-sm text-muted-foreground">{info}</p>}
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="set-password-input"
                  type={showPassword ? "text" : "password"}
                  required autoFocus minLength={8} placeholder="Choose a password (8+ chars)"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-background border-border"
                />
                <button
                  type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                data-testid="set-password-submit"
                type="submit" disabled={loading || newPassword.length < 8}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save password & continue"}
              </Button>
            </form>
          )}

          {/* FORM: RESET PASSWORD (forgot flow — combined OTP + new pw) */}
          {step === "reset_password" && (
            <form onSubmit={submitReset} className="mt-8 space-y-4">
              {info && <p className="text-sm text-muted-foreground">{info}</p>}
              {devCode && (
                <p className="text-xs font-mono p-3 rounded bg-secondary border border-border">
                  Dev mode code: <span className="font-bold text-primary">{devCode}</span>
                </p>
              )}
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="reset-code-input"
                  type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} required autoFocus
                  placeholder="6-digit code" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="pl-10 h-11 bg-background border-border tracking-[0.4em] font-mono text-center text-lg"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="reset-new-password-input"
                  type={showPassword ? "text" : "password"}
                  required minLength={8} placeholder="New password (8+ chars)"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-background border-border"
                />
                <button
                  type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                data-testid="reset-submit-btn"
                type="submit" disabled={loading || code.length !== 6 || newPassword.length < 8}
                className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset password & sign in"}
              </Button>
              <button
                type="button"
                onClick={() => { setStep("password"); setMode("login"); setCode(""); setNewPassword(""); setError(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back to sign in
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
