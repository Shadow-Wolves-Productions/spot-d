import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, Phone, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function InlineVerification({ form, onVerified }) {
  const [active, setActive] = useState(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const sendCode = async (type) => {
    setSending(true);
    setCode("");
    try {
      const res = await base44.functions.invoke("sendVerificationCode", {
        type,
        phone: form.phone,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setActive(type);
      toast.success(type === "email" ? "Code sent to your email!" : "SMS sent to " + form.phone);
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "Failed to send";
      toast.error(msg);
    }
    setSending(false);
  };

  const confirmCode = async (type) => {
    if (code.length !== 6) return;
    setVerifying(true);
    try {
      const res = await base44.functions.invoke("verifyCode", { type, code });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(`${type === "email" ? "Email" : "Phone"} verified! CineScore updated.`);
      setActive(null);
      setCode("");
      onVerified(type);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Invalid or expired code");
    }
    setVerifying(false);
  };

  const items = [
    { key: "email", label: "Verify Email", icon: Shield, verified: form.email_verified, canSend: true },
    { key: "phone", label: "Verify Phone", icon: Phone, verified: form.phone_verified, canSend: !!form.phone },
  ];

  return (
    <div className="border-t border-border pt-6 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Verify Your Identity</p>
        <p className="text-xs text-muted-foreground">Verified profiles get a higher CineScore and trust badges.</p>
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <div key={item.key} className="bg-secondary/40 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
              <span className="text-sm text-foreground flex-1">{item.label}</span>
              {item.verified ? (
                <Badge variant="outline" className="border-green-500/30 text-green-400 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                </Badge>
              ) : item.canSend ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
                  disabled={sending && isActive}
                  onClick={() => isActive ? setActive(null) : sendCode(item.key)}
                >
                  {sending && isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : isActive ? "Cancel" : "Send Code"}
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground">Add phone first</span>
              )}
            </div>
            {isActive && (
              <div className="mt-3 ml-6 flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  className="bg-secondary border-border text-sm h-8 w-32"
                  onKeyDown={(e) => e.key === "Enter" && confirmCode(item.key)}
                  autoFocus
                />
                <Button size="sm" className="h-8 bg-primary text-primary-foreground text-xs px-3"
                  onClick={() => confirmCode(item.key)} disabled={code.length !== 6 || verifying}>
                  {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground px-2"
                  onClick={() => sendCode(item.key)} disabled={sending}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}