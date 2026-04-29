import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2, BadgeCheck } from "lucide-react";
import html2canvas from "html2canvas";
import QRCode from "qrcode";

/**
 * 1080×1920 vertical "Download my poster" card for a Profile.
 * Owner-only — renders nothing useful for other viewers; gating is handled
 * by the parent (ProfilePage only mounts this when myProfile.id === profile.id).
 */
function PosterArt({ profile, qrSrc }) {
  const W = 1080, H = 1920;
  const previewW = 270;
  const previewH = 480;

  const baseUrl = (typeof window !== "undefined" && window.location?.origin) || "https://getspotd.app";

  const photoUrl = profile.profile_photo
    ? (profile.profile_photo.startsWith("http") ? profile.profile_photo : `${baseUrl}${profile.profile_photo}`)
    : null;

  const score = Number(profile.spot_score || 0);
  const percentile = profile.spot_score_percentile || profile.percentile || null;
  const percentileText = (() => {
    if (percentile == null) return null;
    if (percentile <= 1) return "TOP 1%";
    if (percentile <= 5) return "TOP 5%";
    if (percentile <= 10) return "TOP 10%";
    if (percentile <= 25) return "TOP 25%";
    return null;
  })();

  const verified = !!(profile.email_verified);
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const role = profile.primary_role || "";

  return (
    <div
      data-share-poster-root
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
      {/* Yellow radial glow top-right (matches landing) */}
      <div style={{
        position: "absolute", top: -250, right: -200,
        width: 1000, height: 1000, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(230,255,0,0.22) 0%, rgba(230,255,0,0) 60%)",
        pointerEvents: "none",
      }} />
      {/* Subtle film grain */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
        backgroundSize: "3px 3px",
      }} />

      {/* TOP — wordmark */}
      <div style={{
        position: "absolute", top: 80, left: 80, right: 80,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{
          fontFamily: "'Sora', 'Helvetica Neue', Arial, sans-serif",
          fontWeight: 800,
          fontSize: 56,
          letterSpacing: -2,
          color: "#FFFFFF",
        }}>
          spot
          <span style={{ color: "#E8FC6C" }}>'</span>
          d
        </div>
        {percentileText && (
          <div style={{
            backgroundColor: "#E8FC6C",
            color: "#0D0D0D",
            padding: "12px 24px",
            borderRadius: 999,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 2,
          }}>
            {percentileText}
          </div>
        )}
      </div>

      {/* HEADSHOT (top half) — large rounded box */}
      <div style={{
        position: "absolute",
        top: 200,
        left: 80,
        right: 80,
        height: 920,
        borderRadius: 36,
        overflow: "hidden",
        background: "#1A1A1A",
        border: "2px solid rgba(230,255,0,0.18)",
      }}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          // Branded apostrophe placeholder
          <div style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at 50% 35%, rgba(230,255,0,0.18) 0%, rgba(13,13,13,1) 70%)",
          }}>
            <div style={{
              fontFamily: "'Sora', 'Helvetica Neue', Arial, sans-serif",
              fontSize: 520,
              fontWeight: 900,
              color: "#E8FC6C",
              lineHeight: 1,
              letterSpacing: -20,
              transform: "translateY(-30px)",
            }}>
              '
            </div>
          </div>
        )}
      </div>

      {/* Name */}
      <div style={{
        position: "absolute",
        top: 1170,
        left: 80,
        right: 80,
        display: "flex",
        alignItems: "center",
        gap: 22,
        flexWrap: "nowrap",
      }}>
        <div style={{
          fontSize: 92,
          fontWeight: 800,
          letterSpacing: -3,
          color: "#FFFFFF",
          lineHeight: 1.05,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          flex: 1,
        }}>
          {profile.preferred_name || profile.full_name || ""}
        </div>
        {verified && (
          <div style={{
            color: "#E8FC6C",
            fontSize: 60,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
          }}>
            ✓
          </div>
        )}
      </div>

      {/* Primary role */}
      {role && (
        <div style={{
          position: "absolute", top: 1320, left: 80, right: 80,
          fontSize: 42,
          color: "#E8FC6C",
          fontWeight: 600,
          letterSpacing: -0.5,
        }}>
          {role}
        </div>
      )}

      {/* Location */}
      {location && (
        <div style={{
          position: "absolute", top: 1390, left: 80, right: 80,
          fontSize: 32,
          color: "rgba(255,255,255,0.55)",
          fontWeight: 400,
        }}>
          {location}
        </div>
      )}

      {/* SpotScore badge */}
      <div style={{
        position: "absolute", top: 1480, left: 80,
        display: "flex", alignItems: "center", gap: 14,
        padding: "16px 28px",
        borderRadius: 999,
        background: "rgba(230,255,0,0.12)",
        border: "1px solid rgba(230,255,0,0.30)",
      }}>
        <div style={{
          fontSize: 34,
          fontWeight: 800,
          color: "#E8FC6C",
          letterSpacing: -0.5,
        }}>
          SpotScore {score}
          <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}> / 100</span>
        </div>
      </div>

      {/* IMDb */}
      {profile.imdb_link && (
        <div style={{
          position: "absolute", top: 1580, left: 80,
          fontSize: 24,
          color: "rgba(255,255,255,0.45)",
          letterSpacing: 1,
          textTransform: "uppercase",
          fontWeight: 600,
        }}>
          IMDb verified
        </div>
      )}

      {/* Bottom band: getspotd.app + QR */}
      <div style={{
        position: "absolute", bottom: 80, left: 80, right: 80,
        display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: 4,
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 14,
          }}>
            Find me on
          </div>
          <div style={{
            fontSize: 62,
            color: "#E8FC6C",
            fontWeight: 800,
            letterSpacing: -1,
            lineHeight: 1.1,
          }}>
            getspotd.app
          </div>
          {profile.profile_slug && (
            <div style={{
              fontSize: 24,
              color: "rgba(255,255,255,0.45)",
              marginTop: 10,
              fontWeight: 500,
            }}>
              /u/{profile.profile_slug}
            </div>
          )}
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

export default function ProfilePosterCard({ profile, trigger }) {
  const wrapRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [qrSrc, setQrSrc] = useState(null);

  const baseUrl = (typeof window !== "undefined" && window.location?.origin) || "https://getspotd.app";
  const slug = profile?.profile_slug;
  const profileUrl = slug ? `${baseUrl}/u/${slug}` : `${baseUrl}/profile/${profile?.id}`;

  const filename = `spotd-${(profile.preferred_name || profile.full_name || "profile").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-poster.png`;

  // Generate QR on mount / when slug changes
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(profileUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 480,
      color: { dark: "#0D0D0D", light: "#FFFFFF" },
    })
      .then((url) => { if (!cancelled) setQrSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profileUrl]);

  const findCard = () => wrapRef.current?.querySelector("[data-share-poster-root]");

  const captureCard = async (root) => {
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
              title: `${profile.preferred_name || profile.full_name} on Spot'd`,
              text: `${profile.primary_role || "Cast & crew"} on Spot'd · getspotd.app`,
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
      <DialogContent className="bg-card border-border max-w-md" data-testid="profile-poster-dialog">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-primary" /> Download my poster
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            1080 × 1920 PNG with a QR code linking back to your profile. Print it, share it, stick it on your festival lanyard.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-2">
          <div ref={wrapRef} className="rounded-xl overflow-hidden border border-border">
            <PosterArt profile={profile} qrSrc={qrSrc} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1 border-border"
            onClick={handleDownload}
            disabled={busy}
            data-testid="profile-poster-download"
          >
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            Download PNG
          </Button>
          <Button
            className="flex-1 bg-primary text-primary-foreground font-semibold"
            onClick={handleShare}
            disabled={busy}
            data-testid="profile-poster-share"
          >
            {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Share2 className="w-4 h-4 mr-1.5" />}
            Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
