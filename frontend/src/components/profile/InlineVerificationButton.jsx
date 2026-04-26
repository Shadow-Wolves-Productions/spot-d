import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Normalize phone to international format for Twilio
function normalizePhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return phone;
  if (digits.startsWith("04") && digits.length === 10) return "+61" + digits.slice(1);
  return phone;
}

export default function InlineVerificationButton({ type, form, onVerified }) {
  const [stage, setStage] = useState("idle"); // idle | sent | verifying
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("sendVerificationCode", {
        type,
        phone: normalizePhone(form.phone),
      });
      if (res.data?.error) throw new Error(res.data.error);
      setStage("sent");
      setCode("");
      toast.success(type === "email" ? "Code sent to your email!" : "SMS sent to " + form.phone);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Failed to send");
    }
    setLoading(false);
  };

  const confirmCode = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke("verifyCode", { type, code });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`${type === "email" ? "Email" : "Phone"} verified!`);
      setStage("idle");
      setCode("");
      onVerified();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Invalid or expired code");
    }
    setLoading(false);
  };

  const canSend = type === "email" ? true : !!form.phone;

  if (!canSend && stage === "idle") {
    return <span className="text-[11px] text-muted-foreground whitespace-nowrap">Add phone first</span>;
  }

  if (stage === "idle") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10 whitespace-nowrap"
        disabled={loading}
        onClick={sendCode}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1 w-full">
      {type === "phone" && (
        <p className="text-[10px] text-muted-foreground col-span-full">Include country code, e.g. +61…</p>
      )}
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="6-digit code"
        className="bg-secondary border-border text-sm h-8 w-28"
        onKeyDown={(e) => e.key === "Enter" && confirmCode()}
        autoFocus
      />
      <Button
        size="sm"
        className="h-8 bg-primary text-primary-foreground text-xs px-3 whitespace-nowrap"
        onClick={confirmCode}
        disabled={code.length !== 6 || loading}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-xs text-muted-foreground px-2"
        onClick={sendCode}
        disabled={loading}
        title="Resend"
      >
        <RefreshCw className="w-3 h-3" />
      </Button>
    </div>
  );
}