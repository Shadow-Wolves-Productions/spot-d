import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Link } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icons broken by webpack/vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom lime marker
const limeIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [20, 32],
  iconAnchor: [10, 32],
  popupAnchor: [0, -32],
});

// Profiles that have lat/lon attached after geocoding
export default function MapView({ profiles, center }) {
  const geoProfiles = profiles.filter((p) => p._lat && p._lon);
  const mapCenter = center ? [center.lat, center.lon] : [-33.87, 151.21]; // Default: Sydney

  return (
    <div className="rounded-xl overflow-hidden border border-border" style={{ height: 520 }}>
      <MapContainer
        center={mapCenter}
        zoom={center ? 10 : 5}
        style={{ height: "100%", width: "100%", background: "#0D0D0D" }}
        className="z-10"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        {geoProfiles.map((p) => (
          <Marker key={p.id} position={[p._lat, p._lon]} icon={limeIcon}>
            <Popup>
              <div className="text-xs space-y-1 min-w-[140px]">
                {p.profile_photo && (
                  <img src={p.profile_photo} alt="" className="w-full h-20 object-cover rounded" />
                )}
                <p className="font-semibold text-sm">{p.preferred_name || p.full_name}</p>
                <p className="text-gray-500">{p.primary_role}</p>
                {p.city && <p className="text-gray-500">{p.city}</p>}
                <Link
                  to={`/profile/${p.profile_slug || p.id}`}
                  className="block mt-1 text-center py-1 px-3 rounded text-xs font-semibold text-black"
                  style={{ background: "#E6FF00" }}
                >
                  View Profile
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}