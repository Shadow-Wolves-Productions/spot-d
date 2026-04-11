import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, Phone, Film, Award, CheckCircle2, Circle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function VerificationPanel({ profile, onVerified }) {
  const [active, setActive] = useState(null); // 'email' | 'phone'
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const sendCode = async (type) => {
    setSending(true);
    setCode("");
    try {
      await base44.functions.invoke("sendVerificationCode", {
        type,
        phone: type === "phone" ? profile.phone : undefined,
      });
      setActive(type);
      toast.success(type === "email" ? "Code sent to your email!" : "SMS code sent!");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to send code");
    }
    setSending(false);
  };

  const verifyCode = async (type) => {
    if (code.length !== 6) return;
    setVerifying(true);
    try {
      await base44.functions.invoke("verifyCode", { type, code });
      toast.success(`${type === "email" ? "Email" : "Phone"} verified! +CineScore`);
      setActive(null);
      setCode("");
      onVerified();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Invalid or expired code");
    }
    setVerifying(false);
  };

  const items = [
    {
      key: "email",
      label: "Email",
      icon: Shield,
      verified: profile.email_verified,
      canVerify: true,
      hint: null,
    },
    {
      key: "phone",
      label: "Phone / SMS",
      icon: Phone,
      verified: profile.phone_verified,
      canVerify: !!profile.phone,
      hint: !profile.phone ? "Add your phone number first" : null,
    },
    {
      key: "union",
      label: "Union Membership",
      icon: Award,
      verified: profile.union_verified,
      canVerify: false,
      hint: !profile.union_verified
        ? !profile.union_number
          ? "Add your union number to auto-verify"
          : "Union verification in review"
        : null,
    },
    {
      key: "imdb",
      label: "IMDb / Credits",
      icon: Film,
      verified: profile.imdb_verified,
      canVerify: false,
      hint: !profile.imdb_verified ? "Manually reviewed by our team" : null,
    },
  ];

  return (
    <div className="bg-card border border-border/60 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
          Verification Status
        </h3>
        <span className="text-xs text-muted-foreground">+CineScore for each</span>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <div key={item.key} className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center gap-3">
                {item.verified
                  ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  : <Circle className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />}
                <Icon className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
                <span className="text-sm text-foreground flex-1">{item.label}</span>
                {item.verified ? (
                  <Badge variant="outline" className="border-green-500/30 text-green-400 text-[10px]">Verified</Badge>
                ) : item.canVerify ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 border-primary/30 text-primary hover:bg-primary/10"
                    disabled={sending && isActive}
                    onClick={() => isActive ? setActive(null) : sendCode(item.key)}
                  >
                    {sending && isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : isActive ? "Cancel" : "Verify"}
                  </Button>
                ) : item.hint && item.key === "union" && !profile.union_number ? (
                  <Link to="/create-profile">
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground">Add Number</Button>
                  </Link>
                ) : (
                  <Badge variant="outline" className="border-border text-muted-foreground text-[10px]">Pending</Badge>
                )}
              </div>

              {item.hint && !item.verified && (
                <p className="text-[11px] text-muted-foreground mt-2 ml-10">{item.hint}</p>
              )}

              {/* Code input */}
              {isActive && (
                <div className="mt-3 ml-10 flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    className="bg-secondary border-border text-sm h-8 max-w-[180px]"
                    onKeyDown={(e) => e.key === "Enter" && verifyCode(item.key)}
                  />
                  <Button
                    size="sm"
                    className="h-8 bg-primary text-primary-foreground text-xs"
                    onClick={() => verifyCode(item.key)}
                    disabled={code.length !== 6 || verifying}
                  >
                    {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={() => sendCode(item.key)}
                    disabled={sending}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}