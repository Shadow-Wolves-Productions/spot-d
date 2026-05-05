import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/**
 * Email verification pill + code entry. Phone verification was removed
 * in the Emergent migration — Twilio is no longer a dependency.
 *
 * Layout: lives inside the Email field row of CreateProfile. Wraps to the
 * next line while in the `sent` stage so the 6-digit code input + Confirm
 * button have room to breathe on narrow viewports.
 */
export default function InlineVerificationButton({ form, onVerified }) {
  const [stage, setStage] = useState("idle"); // idle | sent
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("sendVerificationCode", { type: "email" });
      if (res.data?.error) throw new Error(res.data.error);
      setStage("sent");
      setCode("");
      toast.success("Code sent to your email!");
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Failed to send");
    }
    setLoading(false);
  };

  const confirmCode = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("verifyCode", { type: "email", code });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success("Email verified!");
      setStage("idle");
      setCode("");
      onVerified?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Invalid or expired code");
    }
    setLoading(false);
  };

  if (stage === "idle") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10 whitespace-nowrap"
        disabled={loading}
        onClick={sendCode}
        data-testid="inline-verify-send-btn"
        type="button"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 basis-full flex-wrap mt-2 w-full" data-testid="inline-verify-code-row">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="6-digit code"
        inputMode="numeric"
        className="bg-secondary border-border text-sm h-9 w-32"
        onKeyDown={(e) => e.key === "Enter" && confirmCode()}
        autoFocus
        data-testid="inline-verify-code-input"
      />
      <Button
        size="sm"
        className="h-9 bg-primary text-primary-foreground text-xs px-3 whitespace-nowrap"
        onClick={confirmCode}
        disabled={code.length !== 6 || loading}
        data-testid="inline-verify-confirm-btn"
        type="button"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-9 text-xs text-muted-foreground px-2"
        onClick={sendCode}
        disabled={loading}
        title="Resend"
        data-testid="inline-verify-resend-btn"
        type="button"
      >
        <RefreshCw className="w-3 h-3" />
      </Button>
    </div>
  );
}
