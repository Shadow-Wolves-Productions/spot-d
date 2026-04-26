import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const ENDPOINTS = {
  "profile-photo":  "/api/upload/profile-photo",
  headshot:         "/api/upload/headshot",
  "company-logo":   "/api/upload/company-logo",
  "cover-image":    "/api/upload/cover-image",
};

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Reusable image uploader.
 * Props:
 *   value          — current image URL or ""
 *   onChange       — (newUrl: string) => void
 *   onRemove       — optional () => void; shown when value is set
 *   kind           — "profile-photo" | "headshot" | "company-logo" | "cover-image"
 *   shape          — "square" | "circle" | "rect"   (visual only)
 *   testId         — data-testid prefix
 *   label          — small caption shown below
 */
export default function ImageUploader({
  value,
  onChange,
  onRemove,
  kind = "profile-photo",
  shape = "square",
  testId = "image-uploader",
  label,
  className = "",
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endpoint = ENDPOINTS[kind] || ENDPOINTS["profile-photo"];

  const resolved = value && (value.startsWith("/static/") || value.startsWith("/api/static/"))
    ? `${base44.baseURL}${value.startsWith("/static/") ? "/api" + value : value}`
    : value;

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (f) doUpload(f);
    e.target.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) doUpload(f);
  };

  const doUpload = async (file) => {
    setErr("");
    if (!ACCEPT.split(",").includes(file.type)) {
      setErr("Only JPG, PNG, or WEBP images are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr("File too large — max 5MB.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await base44.http.post(endpoint, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(data.url);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const radius = shape === "circle" ? "rounded-full" : shape === "rect" ? "rounded-xl" : "rounded-2xl";
  const dim = shape === "rect" ? "w-full h-32" : "w-28 h-28";

  return (
    <div className={`flex items-start gap-4 ${className}`}>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className={`${dim} ${radius} cursor-pointer overflow-hidden border border-border bg-secondary hover:border-primary/40 transition-colors flex items-center justify-center relative`}
        data-testid={`${testId}-dropzone`}
      >
        {resolved ? (
          <img src={resolved} alt="" className="w-full h-full object-cover" />
        ) : busy ? (
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        ) : (
          <Upload className="w-6 h-6 text-muted-foreground/40" />
        )}
        {busy && resolved && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={onPick}
          className="hidden"
          data-testid={`${testId}-input`}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
          data-testid={`${testId}-pick-btn`}
        >
          {value ? "Replace" : "Upload image"}
        </button>
        {value && (onRemove || onChange) && (
          <button
            type="button"
            onClick={() => (onRemove ? onRemove() : onChange(""))}
            className="block text-xs text-muted-foreground hover:text-destructive mt-1"
            data-testid={`${testId}-remove-btn`}
          >
            <X className="w-3 h-3 inline mr-1" /> Remove
          </button>
        )}
        <p className="text-[11px] text-muted-foreground mt-2 leading-[1.5]">
          {label || "JPG, PNG, or WEBP. Max 5MB."}
        </p>
        {err && (
          <p className="text-xs text-destructive mt-2" data-testid={`${testId}-error`}>{err}</p>
        )}
      </div>
    </div>
  );
}
