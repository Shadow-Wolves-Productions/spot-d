import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2, Instagram } from "lucide-react";
import html2canvas from "html2canvas";
import QRCode from "qrcode";

/**
 * 1080×1920 vertical share card optimised for Instagram / WhatsApp / Snapchat
 * Stories. Tries the Web Share API first (mobile native share sheet) and
 * falls back to a PNG download on desktop.
 *
 *   Usage:
 *     <CastingStoryShareCard call={castingCall} trigger={<Button>Share to Story</Button>} />
 */
function StoryArt({ call, qrSrc }) {
  const W = 1080, H = 1920;
  // Render preview at ~270×480 so the dialog stays compact.
  const previewW = 270;
  const previewH = 480;

  const isCompany = call.posted_as === "company" && (call.posted_as_company_name || call.posted_as_company_logo);
  const attribution = isCompany ? call.posted_as_company_name : (call.company_name || "");
  const logo = isCompany ? call.posted_as_company_logo : call.company_logo;
  const roles = (call.roles_needed || []).slice(0, 4);
  const compensation = call.compensation || call.budget_range || "";
  const deadline = call.deadline ? new Date(call.deadline) : null;
  const deadlineText = deadline && !isNaN(deadline.getTime())
    ? `Applications close ${deadline.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`
    : null;

  const baseUrl = (typeof window !== "undefined" && window.location?.origin)
    || "https://getspotd.app";
  const detailUrl = `${baseUrl}/casting/${call.id}`;

  // Resolve absolute URL for company logo (handles /api/static/... uploads)
  const resolvedLogo = logo
    ? (logo.startsWith("http") ? logo : `${baseUrl}${logo}`)
    : null;

  return (
    <div
      data-share-story-root
      style={{
        width: W,
        height: H,
        background: "#0D0D0D",
        position: "relative",
        fontFamily: "'Sora', 'Helvetica Neue', Arial, sans-serif",
        color: "#FFFFFF",
        overflow: "hidden",
        transform: `scale(${previewW / W})`,
        transformOrigin: "top left",
        marginBottom: -(H - previewH),
        marginRight: -(W - previewW),
      }}
    >
      {/* Yellow radial glow top-left (matches landing) */}
      <div style={{
        position: "absolute", top: -300, left: -200,
        width: 1100, height: 1100, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(230,255,0,0.22) 0%, rgba(230,255,0,0) 60%)",
        pointerEvents: "none",
      }} />
      {/* Orange accent glow bottom-right */}
      <div style={{
        position: "absolute", bottom: -300, right: -200,
        width: 900, height: 900, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,92,53,0.13) 0%, rgba(255,92,53,0) 60%)",
        pointerEvents: "none",
      }} />
      {/* Subtle film grain */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
        backgroundSize: "3px 3px",
      }} />

      {/* TOP — wordmark + company logo */}
      <div style={{
        position: "absolute", top: 80, left: 80, right: 80,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{
          fontFamily: "'Sora', 'Helvetica Neue', Arial, sans-serif",
          fontWeight: 800,
          fontSize: 64,
          letterSpacing: -2,
          color: "#FFFFFF",
        }}>
          spot
          <span style={{ color: "#E8FC6C" }}>'</span>
          d
        </div>
        {resolvedLogo && (
          <img
            src={resolvedLogo}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: 110, height: 110, borderRadius: 18,
              objectFit: "cover",
              border: "2px solid rgba(255,255,255,0.12)",
            }}
          />
        )}
      </div>

      {/* "NOW CASTING" chip */}
      <div style={{
        position: "absolute", top: 270, left: 80,
        backgroundColor: "#FF5C35",
        color: "#FFFFFF",
        padding: "16px 32px",
        borderRadius: 999,
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: 4,
        textTransform: "uppercase",
      }}>
        Now Casting
      </div>

      {/* Project title (large, max 2 lines) */}
      <div style={{
        position: "absolute", top: 380, left: 80, right: 80,
        fontSize: 116,
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: -3,
        color: "#FFFFFF",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {call.project_title}
      </div>

      {/* Posted by */}
      {attribution && (
        <div style={{
          position: "absolute", top: 660, left: 80, right: 80,
          fontSize: 28,
          color: "rgba(255,255,255,0.65)",
          letterSpacing: 1,
          textTransform: "uppercase",
          fontWeight: 500,
        }}>
          Posted by {attribution}
        </div>
      )}

      {/* Role pills */}
      {roles.length > 0 && (
        <div style={{
          position: "absolute", top: 760, left: 80, right: 80,
          display: "flex", flexWrap: "wrap", gap: 18,
        }}>
          {roles.map((r) => (
            <div key={r} style={{
              backgroundColor: "#2A2A2A",
              color: "#FFFFFF",
              padding: "20px 36px",
              borderRadius: 999,
              fontSize: 34,
              fontWeight: 600,
            }}>
              {r}
            </div>
          ))}
        </div>
      )}

      {/* Location + Compensation row */}
      <div style={{
        position: "absolute", top: 1040, left: 80, right: 80,
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {call.location && (
          <div style={{ fontSize: 38, color: "#FFFFFF", fontWeight: 500 }}>
            <span style={{ color: "#E8FC6C", marginRight: 14 }}>◆</span>
            {call.location}
          </div>
        )}
        {compensation && (
          <div style={{ fontSize: 38, color: "#FFFFFF", fontWeight: 500 }}>
            <span style={{ color: "#E8FC6C", marginRight: 14 }}>$</span>
            {compensation}
          </div>
        )}
        {call.project_type && (
          <div style={{ fontSize: 32, color: "rgba(255,255,255,0.55)", fontWeight: 500, marginTop: 4 }}>
            {call.project_type}
          </div>
        )}
      </div>

      {/* Deadline */}
      {deadlineText && (
        <div style={{
          position: "absolute", top: 1280, left: 80, right: 80,
          fontSize: 30,
          color: "#FF5C35",
          fontWeight: 600,
          letterSpacing: 0.5,
        }}>
          ⏱ {deadlineText}
        </div>
      )}

      {/* Bottom band: Apply CTA + QR */}
      <div style={{
        position: "absolute", bottom: 80, left: 80, right: 80,
        display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: 4,
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 16,
          }}>
            Apply at
          </div>
          <div style={{
            fontSize: 64,
            color: "#E8FC6C",
            fontWeight: 800,
            letterSpacing: -1,
            lineHeight: 1.1,
          }}>
            getspotd.app
          </div>
          <div style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.45)",
            marginTop: 12,
            wordBreak: "break-all",
          }}>
            /casting/{call.id?.slice(0, 12)}…
          </div>
        </div>
        {qrSrc && (
          <div style={{
            background: "#FFFFFF",
            padding: 16,
            borderRadius: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <img
              src={qrSrc}
              alt=""
              style={{ width: 240, height: 240, display: "block" }}
              crossOrigin="anonymous"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CastingStoryShareCard({ call, trigger }) {
  const wrapRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [qrSrc, setQrSrc] = useState(null);

  const baseUrl = (typeof window !== "undefined" && window.location?.origin) || "https://getspotd.app";
  const detailUrl = `${baseUrl}/casting/${call.id}`;

  const filename = `spotd-${(call.project_title || "casting").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-story.png`;

  // Generate QR once (per call)
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(detailUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 480,
      color: { dark: "#0D0D0D", light: "#FFFFFF" },
    })
      .then((url) => { if (!cancelled) setQrSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [detailUrl]);

  const findCard = () => wrapRef.current?.querySelector("[data-share-story-root]");

  const captureCard = async (root) => {
    // Remove the preview-scale transform so html2canvas captures full 1080×1920.
    const original = root.style.transform;
    root.style.transform = "none";
    root.style.marginBottom = "0";
    root.style.marginRight = "0";
    try {
      return await html2canvas(root, {
        backgroundColor: "#0D0D0D",
        scale: 1,
        useCORS: true,
        logging: false,
        width: 1080,
        height: 1920,
      });
    } finally {
      root.style.transform = original;
      root.style.marginBottom = `-${1920 - 480}px`;
      root.style.marginRight = `-${1080 - 270}px`;
    }
  };

  const handleDownload = async () => {
    const root = findCard();
    if (!root) return;
    setBusy(true);
    try {
      const canvas = await captureCard(root);
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
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
            // Desktop fallback — download.
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
      <DialogContent className="bg-card border-border max-w-md" data-testid="casting-story-share-dialog">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Instagram className="w-5 h-5 text-primary" /> Share to Story
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <div ref={wrapRef} className="rounded-xl overflow-hidden border border-border">
            <StoryArt call={call} qrSrc={qrSrc} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center -mt-2">
          1080 × 1920 PNG · perfect for Instagram / WhatsApp / Snapchat Stories
        </p>
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1 border-border"
            onClick={handleDownload}
            disabled={busy}
            data-testid="story-share-download"
          >
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            Download
          </Button>
          <Button
            className="flex-1 bg-primary text-primary-foreground font-semibold"
            onClick={handleShare}
            disabled={busy}
            data-testid="story-share-share"
          >
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Share2 className="w-4 h-4 mr-1.5" />}
            Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
