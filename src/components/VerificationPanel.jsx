import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, Phone, Film, Award, CheckCircle2, Circle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function VerificationPanel({ profile, onVerified }) {
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
        phone: profile.phone,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setActive(type);
      toast.success(type === "email" ? "Code sent to your email!" : "SMS code sent to " + profile.phone);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Failed to send code");
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
      onVerified();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Invalid or expired code");
    }
    setVerifying(false);
  };

  const items = [
    {
      key: "email",
      label: "Email",
      icon: Shield,
      verified: profile.email_verified,
      canSend: true,
      hint: null,
    },
    {
      key: "phone",
      label: "Phone / SMS",
      icon: Phone,
      verified: profile.phone_verified,
      canSend: !!profile.phone,
      hint: !profile.phone ? "Add your phone number in Edit Profile first" : null,
    },
    {
      key: "union",
      label: "Union Membership",
      icon: Award,
      verified: profile.union_verified,
      canSend: false,
      hint: !profile.union_verified
        ? !profile.union_number
          ? "Add your union membership number in Edit Profile"
          : "Will auto-verify once email or phone is confirmed"
        : null,
    },
    {
      key: "imdb",
      label: "IMDb / Credits",
      icon: Film,
      verified: profile.imdb_verified,
      canSend: false,
      hint: !profile.imdb_verified ? "Reviewed manually by our team" : null,
    },
  ];

  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
          Verification
        </h3>
        <span className="text-xs text-muted-foreground">Boosts your CineScore</span>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <div key={item.key} className="bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center gap-2">
                {item.verified
                  ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  : <Circle className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />}
                <Icon className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                <span className="text-sm text-foreground flex-1 min-w-0 truncate">{item.label}</span>

                {item.verified ? (
                  <Badge variant="outline" className="border-green-500/30 text-green-400 text-[10px] flex-shrink-0">Verified</Badge>
                ) : item.canSend ? (
                  <div className="flex gap-1 flex-shrink-0">
                    {isActive && (
                      <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-muted-foreground"
                        onClick={() => { setActive(null); setCode(""); }}>
                        Cancel
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={isActive ? "ghost" : "outline"}
                      className="text-xs h-7 px-3 border-primary/30 text-primary hover:bg-primary/10"
                      disabled={sending}
                      onClick={() => sendCode(item.key)}
                    >
                      {sending && isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : isActive ? <RefreshCw className="w-3 h-3" /> : "Verify"}
                    </Button>
                  </div>
                ) : item.key === "union" && !profile.union_number ? (
                  <Link to="/create-profile">
                    <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-primary">Add #</Button>
                  </Link>
                ) : (
                  <Badge variant="outline" className="border-border text-muted-foreground text-[10px] flex-shrink-0">Pending</Badge>
                )}
              </div>

              {item.hint && !item.verified && (
                <p className="text-[11px] text-muted-foreground mt-1.5 ml-7">{item.hint}</p>
              )}

              {isActive && (
                <div className="mt-3 ml-7 flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    className="bg-secondary border-border text-sm h-8 w-32"
                    onKeyDown={(e) => e.key === "Enter" && confirmCode(item.key)}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-8 bg-primary text-primary-foreground text-xs px-3"
                    onClick={() => confirmCode(item.key)}
                    disabled={code.length !== 6 || verifying}
                  >
                    {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
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