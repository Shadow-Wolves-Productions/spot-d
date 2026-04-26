import { useState } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RADIUS_OPTIONS = [
  { label: "25 km", value: 25 },
  { label: "50 km", value: 50 },
  { label: "100 km", value: 100 },
  { label: "250 km", value: 250 },
  { label: "500 km", value: 500 },
];

// Haversine distance in km between two lat/lng pairs
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Geocode a city/postcode string via Nominatim (no API key needed)
export async function geocodePlace(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name.split(",")[0] };
}

export default function ProximityFilter({ proximity, onChange }) {
  const [input, setInput] = useState(proximity?.display || "");
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");

  const applyPlace = async (query) => {
    if (!query.trim()) return;
    setGeocoding(true);
    setError("");
    const result = await geocodePlace(query);
    if (!result) {
      setError("Location not found. Try a city name.");
    } else {
      onChange({ ...result, radius: proximity?.radius || 100 });
      setInput(result.display);
    }
    setGeocoding(false);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation || !window.isSecureContext) {
      setError("Location access requires a secure connection. Try entering your city manually.");
      return;
    }
    setGeocoding(true);
    setError("Waiting for permission…");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { latitude: lat, longitude: lon } = coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const data = await res.json();
          const display = data.address?.city || data.address?.town || data.address?.suburb || "My location";
          onChange({ lat, lon, display, radius: proximity?.radius || 100 });
          setInput(display);
          setError("");
        } catch (e) {
          setError("Couldn't reverse geocode. Try entering your city manually.");
        } finally {
          setGeocoding(false);
        }
      },
      (err) => {
        setGeocoding(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location access denied. Enter city manually.");
        } else if (err.code === err.TIMEOUT) {
          setError("Location timed out. Enter city manually.");
        } else {
          setError("Could not get location. Enter city manually.");
        }
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  };

  const clear = () => {
    onChange(null);
    setInput("");
    setError("");
  };

  return (
    <div className="space-y-2">
      <Label className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground block">
        Proximity search
      </Label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="City or postcode"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyPlace(input)}
            className="pl-8 h-9 text-sm border bg-background border-border"
          />
          {proximity && (
            <button onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => applyPlace(input)}
          disabled={geocoding || !input.trim()}
          className="h-9 px-2 border bg-background border-border"
        >
          {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Go"}
        </Button>
      </div>

      <button
        onClick={useMyLocation}
        disabled={geocoding}
        className="text-[11px] text-primary hover:underline flex items-center gap-1"
      >
        <MapPin className="w-3 h-3" /> Use my location
      </button>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {proximity && (
        <Select
          value={String(proximity.radius)}
          onValueChange={(v) => onChange({ ...proximity, radius: Number(v) })}
        >
          <SelectTrigger className="h-8 text-xs border bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {RADIUS_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={String(r.value)}>{r.label} radius</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {proximity && (
        <p className="text-[11px] text-primary font-mono">
          Showing talent within {proximity.radius} km of {proximity.display}
        </p>
      )}
    </div>
  );
}