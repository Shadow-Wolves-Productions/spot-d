import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";

/**
 * 1080×1080 square share card for a CastingCall.
 * Same html2canvas approach as ShareSpotScoreCard.
 */
function CardArt({ call }) {
  const W = 1080, H = 1080;
  const displayW = 270;
  const displayH = 270;
  const isCompany = call.posted_as === "company" && (call.posted_as_company_name || call.posted_as_company_logo);
  const attribution = isCompany ? call.posted_as_company_name : (call.company_name || "");
  const logo = isCompany ? call.posted_as_company_logo : call.company_logo;
  const roles = (call.roles_needed || []).slice(0, 6);
  const compensation = call.compensation || (call.budget_range ? call.budget_range : "");

  return (
    <div
      data-share-card-root
      style={{
        width: W,
        height: H,
        background: "#0D0D0D",
        position: "relative",
        fontFamily: "'Sora', 'Helvetica Neue', Arial, sans-serif",
        color: "#FFFFFF",
        overflow: "hidden",
        transform: `scale(${displayW / W})`,
        transformOrigin: "top left",
        marginBottom: -(H - displayH),
        marginRight: -(W - displayW),
      }}
    >
      {/* Film grain */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
        backgroundSize: "3px 3px",
      }} />

      {/* Top-right glow */}
      <div style={{
        position: "absolute", top: -200, right: -200,
        width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(230,255,0,0.18) 0%, rgba(230,255,0,0) 60%)",
        pointerEvents: "none",
      }} />

      {/* Bottom-left orange glow */}
      <div style={{
        position: "absolute", bottom: -250, left: -250,
        width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,92,53,0.14) 0%, rgba(255,92,53,0) 60%)",
        pointerEvents: "none",
      }} />

      {/* Wordmark */}
      <div style={{ padding: "70px 80px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-2px", color: "#FFFFFF" }}>
          Spot<span style={{ color: "#E6FF00" }}>'</span>d
        </div>
        <div style={{
          padding: "10px 22px",
          borderRadius: 999,
          background: "#FF5C35",
          color: "#FFFFFF",
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}>
          Now Casting
        </div>
      </div>

      {/* Project type label */}
      <div style={{ padding: "70px 80px 0", color: "rgba(255,255,255,0.5)", fontSize: 24, letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {call.project_type || "Project"}
      </div>

      {/* Project title */}
      <div style={{
        padding: "16px 80px 0",
        fontSize: 96,
        fontWeight: 800,
        letterSpacing: "-3px",
        lineHeight: 1.05,
        color: "#FFFFFF",
        maxWidth: W - 160,
      }}>
        {call.project_title || "Casting call"}
      </div>

      {/* Roles row */}
      {roles.length > 0 && (
        <div style={{ padding: "44px 80px 0", display: "flex", flexWrap: "wrap", gap: 16 }}>
          {roles.map((r) => (
            <div key={r} style={{
              padding: "14px 26px",
              borderRadius: 999,
              border: "2px solid rgba(230,255,0,0.5)",
              color: "#E6FF00",
              fontSize: 28,
              fontWeight: 600,
            }}>{r}</div>
          ))}
        </div>
      )}

      {/* Bottom bar — location + comp + apply */}
      <div style={{
        position: "absolute",
        left: 80,
        right: 80,
        bottom: 80,
      }}>
        {/* Location + compensation */}
        <div style={{ display: "flex", gap: 48, color: "rgba(255,255,255,0.7)", fontSize: 28, marginBottom: 32 }}>
          {call.location && <div><span style={{ color: "rgba(255,255,255,0.4)", marginRight: 10 }}>📍</span>{call.location}</div>}
          {compensation && <div><span style={{ color: "rgba(255,255,255,0.4)", marginRight: 10 }}>💰</span>{compensation}</div>}
        </div>

        {/* Posted-by chip */}
        {attribution && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
            {logo ? (
              <img src={logo.startsWith("/api/static/") ? logo : logo}
                   alt=""
                   crossOrigin="anonymous"
                   style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", background: "#222" }} />
            ) : null}
            <div style={{ fontSize: 24, color: "rgba(255,255,255,0.6)" }}>
              Posted by <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{attribution}</span>
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 28,
          borderTop: "2px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#E6FF00" }}>
            Apply at getspotd.app
          </div>
          <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)" }}>
            The indie film directory
          </div>
        </div>
      </div>
    </div>
  );
}

async function captureCard(rootEl) {
  const originalTransform = rootEl.style.transform;
  const originalMarginB = rootEl.style.marginBottom;
  const originalMarginR = rootEl.style.marginRight;
  rootEl.style.transform = "scale(1)";
  rootEl.style.marginBottom = "0px";
  rootEl.style.marginRight = "0px";
  try {
    return await html2canvas(rootEl, {
      backgroundColor: "#0D0D0D",
      scale: 1,
      useCORS: true,
      logging: false,
      width: rootEl.offsetWidth,
      height: rootEl.offsetHeight,
    });
  } finally {
    rootEl.style.transform = originalTransform;
    rootEl.style.marginBottom = originalMarginB;
    rootEl.style.marginRight = originalMarginR;
  }
}

export default function CastingCallShareCard({ call, trigger }) {
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);
  const filename = `spotd-casting-${(call.id || "call").slice(0, 8)}.png`;

  const findCard = () => wrapRef.current?.querySelector("[data-share-card-root]");

  const handleDownload = async () => {
    const root = findCard();
    if (!root) return;
    setBusy(true);
    try {
      const canvas = await captureCard(root);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    const root = findCard();
    if (!root) return;
    setBusy(true);
    try {
      const canvas = await captureCard(root);
      canvas.toBlob(async (blob) => {
        try {
          const file = new File([blob], filename, { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Now casting: ${call.project_title}`,
              text: `${call.project_title} on Spot'd · ${call.location || "getspotd.app"}`,
              files: [file],
            });
          } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }
        } finally {
          setBusy(false);
        }
      }, "image/png");
    } catch {
      setBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md" data-testid="casting-share-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Share this casting call</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <div ref={wrapRef} className="rounded-xl overflow-hidden border border-border">
            <CardArt call={call} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center -mt-2">1080 × 1080 PNG · perfect for Instagram / Twitter / Discord</p>
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1 border-border"
            onClick={handleDownload}
            disabled={busy}
            data-testid="casting-share-download"
          >
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            Download PNG
          </Button>
          <Button
            className="flex-1 bg-primary text-primary-foreground font-semibold"
            onClick={handleShare}
            disabled={busy}
            data-testid="casting-share-share"
          >
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Share2 className="w-4 h-4 mr-1.5" />}
            Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
