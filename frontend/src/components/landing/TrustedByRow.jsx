import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Trusted-by row — only renders if 3 or more verified CompanyProfiles exist.
 * Logos render in grayscale, full colour on hover.
 */
export default function TrustedByRow() {
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    base44.http.get("/api/public-verified-companies")
      .then(({ data }) => setCompanies(Array.isArray(data) ? data : []))
      .catch(() => setCompanies([]));
  }, []);

  if (companies.length < 3) return null;

  return (
    <section className="py-12 px-4 border-t border-border" data-testid="trusted-by-row">
      <div className="max-w-7xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground text-center mb-6">
          Trusted by indie filmmakers at
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {companies.slice(0, 8).map((c) => (
            <a
              key={c.id}
              href={`/c/${c.company_slug || c.id}`}
              data-testid={`trusted-logo-${c.company_slug || c.id}`}
              className="flex items-center gap-2.5 transition-all duration-300"
              style={{ filter: "grayscale(100%)", opacity: 0.6 }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = "grayscale(0%)"; e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "grayscale(100%)"; e.currentTarget.style.opacity = "0.6"; }}
            >
              {c.logo ? (
                <img src={c.logo.startsWith("/api/static/") ? c.logo : c.logo} alt={c.company_name} className="h-7 w-auto object-contain" />
              ) : (
                <span className="text-base font-display font-medium text-foreground">{c.company_name}</span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
