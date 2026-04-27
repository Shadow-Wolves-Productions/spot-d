import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";

const PERCENTILE_BADGES = [
  { min: 99, label: "TOP 1%",   bg: "#0D0D0D", fg: "#E6FF00", border: "#E6FF00" },
  { min: 95, label: "TOP 5%",   bg: "#7C3AED", fg: "#FFFFFF", border: "#7C3AED" },
  { min: 90, label: "TOP 10%",  bg: "#22C55E", fg: "#FFFFFF", border: "#22C55E" },
  { min: 75, label: "TOP 25%",  bg: "#F59E0B", fg: "#0D0D0D", border: "#F59E0B" },
];
function getBadge(pct) {
  return PERCENTILE_BADGES.find((b) => pct >= b.min) || null;
}

/**
 * Card visual — 1080x1920 (story) or 1080x1080 (square).
 * Uses inline styles + system fonts so html2canvas captures it exactly.
 */
function CardArt({ profile, format = "story" }) {
  const isSquare = format === "square";
  const W = 1080, H = isSquare ? 1080 : 1920;
  // Display scale (visible in dialog) — actual capture uses scale: H/displayed
  const displayW = 270;
  const displayH = isSquare ? 270 : 480;
  const badge = getBadge(profile.spot_percentile || 0);

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
        // Render at full res, then visually scale down inside the dialog
        transform: `scale(${displayW / W})`,
        transformOrigin: "top left",
        marginBottom: -(H - displayH),
        marginRight: -(W - displayW),
      }}
    >
      {/* Subtle film grain via repeating radial gradient noise */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
        backgroundSize: "3px 3px",
      }} />

      {/* Soft accent glow */}
      <div style={{
        position: "absolute", top: -200, right: -200,
        width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(230,255,0,0.18) 0%, rgba(230,255,0,0) 60%)",
        pointerEvents: "none",
      }} />

      {/* Top: wordmark */}
      <div style={{ padding: "70px 80px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-2px", color: "#FFFFFF" }}>
          Spot<span style={{ color: "#E6FF00" }}>'</span>d
        </div>
        <div style={{ fontSize: 22, letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
          SpotScore
        </div>
      </div>

      {/* Centre: big score */}
      <div style={{
        position: "absolute", left: 0, right: 0,
        top: isSquare ? "30%" : "32%",
        textAlign: "center",
      }}>
        <div style={{
          fontSize: isSquare ? 360 : 480,
          fontWeight: 800,
          lineHeight: 0.9,
          letterSpacing: "-12px",
          color: "#FFFFFF",
          fontFeatureSettings: "'tnum'",
        }}>
          {profile.spot_score ?? 0}
          <span style={{ fontSize: isSquare ? 100 : 130, color: "rgba(255,255,255,0.35)", letterSpacing: "-4px" }}>
            /100
          </span>
        </div>

        {badge && (
          <div style={{ marginTop: 50, display: "flex", justifyContent: "center" }}>
            <div style={{
              display: "inline-block",
              padding: "18px 40px",
              borderRadius: 999,
              background: badge.bg,
              color: badge.fg,
              border: `2px solid ${badge.border}`,
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: "0.18em",
            }}>
              {badge.label}
            </div>
          </div>
        )}
      </div>

      {/* Lower middle: name + role */}
      <div style={{
        position: "absolute", left: 80, right: 80,
        bottom: isSquare ? 180 : 280,
        textAlign: "left",
      }}>
        <div style={{ fontSize: 52, fontWeight: 700, color: "#FFFFFF", letterSpacing: "-1.5px" }}>
          {profile.preferred_name || profile.full_name || "Spot'd member"}
        </div>
        <div style={{ marginTop: 16, fontSize: 32, color: "#E6FF00", fontWeight: 600 }}>
          {profile.primary_role || "Filmmaker"}
        </div>
        {(profile.city || profile.country) && (
          <div style={{ marginTop: 12, fontSize: 26, color: "rgba(255,255,255,0.5)" }}>
            {[profile.city, profile.state, profile.country].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      {/* Bottom URL */}
      <div style={{
        position: "absolute", left: 0, right: 0,
        bottom: 70,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 30, fontWeight: 600, color: "#E6FF00", letterSpacing: "-0.5px" }}>
          getspotd.app
        </div>
        <div style={{ marginTop: 8, fontSize: 18, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
          The indie film directory
        </div>
      </div>
    </div>
  );
}

async function captureCard(rootEl, scaleBackUp) {
  // Temporarily reset transform so html2canvas captures full res
  const originalTransform = rootEl.style.transform;
  const originalMarginB = rootEl.style.marginBottom;
  const originalMarginR = rootEl.style.marginRight;
  rootEl.style.transform = "scale(1)";
  rootEl.style.marginBottom = "0px";
  rootEl.style.marginRight = "0px";
  try {
    const canvas = await html2canvas(rootEl, {
      backgroundColor: "#0D0D0D",
      scale: 1,
      useCORS: true,
      logging: false,
      width: rootEl.offsetWidth,
      height: rootEl.offsetHeight,
    });
    return canvas;
  } finally {
    rootEl.style.transform = originalTransform;
    rootEl.style.marginBottom = originalMarginB;
    rootEl.style.marginRight = originalMarginR;
  }
}

export default function ShareSpotScoreCard({ profile, trigger, defaultOpen = false }) {
  const [format, setFormat] = useState("story"); // story | square
  const [busy, setBusy] = useState(false);
  const cardRefStory = useRef(null);
  const cardRefSquare = useRef(null);

  const cardRef = format === "story" ? cardRefStory : cardRefSquare;

  const filename = `spotd-${(profile.profile_slug || "score")}-${format}.png`;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const canvas = await captureCard(cardRef.current);
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const canvas = await captureCard(cardRef.current);
      canvas.toBlob(async (blob) => {
        try {
          const file = new File([blob], filename, { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `My Spot'd SpotScore — ${profile.spot_score}/100`,
              text: `${profile.preferred_name || profile.full_name} on Spot'd · getspotd.app`,
              files: [file],
            });
          } else {
            // Fallback to download
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }
        } catch {
          /* user cancelled or unsupported */
        } finally {
          setBusy(false);
        }
      }, "image/png");
    } catch {
      setBusy(false);
    }
  };

  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="share-spotscore-trigger" variant="outline" className="rounded-full gap-2">
            <Share2 className="w-4 h-4" /> Share my SpotScore
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Share your SpotScore</DialogTitle>
        </DialogHeader>

        {/* Format toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-secondary border border-border w-fit mx-auto">
          <button
            data-testid="share-format-story"
            onClick={() => setFormat("story")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${format === "story" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            9:16 Story
          </button>
          <button
            data-testid="share-format-square"
            onClick={() => setFormat("square")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition ${format === "square" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            1:1 Square
          </button>
        </div>

        {/* Visible preview at scaled-down size — but the actual card lives at 1080x… hidden within an overflow */}
        <div className="flex justify-center mt-4">
          <div style={{ width: 270, height: format === "story" ? 480 : 270, overflow: "hidden", borderRadius: 16, border: "1px solid hsl(var(--border))" }}>
            {/* Render only the active format to avoid double captures */}
            {format === "story" ? (
              <div ref={cardRefStory}><CardArt profile={profile} format="story" /></div>
            ) : (
              <div ref={cardRefSquare}><CardArt profile={profile} format="square" /></div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <Button
            data-testid="share-download-btn"
            onClick={handleDownload}
            disabled={busy}
            variant="outline"
            className="flex-1 rounded-full gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PNG
          </Button>
          <Button
            data-testid="share-native-btn"
            onClick={handleShare}
            disabled={busy}
            className="flex-1 rounded-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Share
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          {format === "story" ? "1080×1920 — perfect for Instagram & TikTok stories." : "1080×1080 — perfect for Instagram & X feed posts."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
