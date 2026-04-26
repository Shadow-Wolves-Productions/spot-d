import { useLocation, useNavigate } from "react-router-dom";
import { Search, Film, LayoutDashboard } from "lucide-react";
import { useEffect } from "react";

const TABS = [
  { path: "/search", label: "Directory", icon: Search },
  { path: "/casting", label: "Casting", icon: Film },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export default function MobileBottomTabs() {
  const location = useLocation();
  const navigate = useNavigate();

  // Restore scroll position when arriving at a tab route
  useEffect(() => {
    const saved = sessionStorage.getItem(`scroll:${location.pathname}`);
    if (saved !== null) {
      requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
    }
  }, [location.pathname]);

  const handleTabClick = (e, path) => {
    e.preventDefault();
    // Save current scroll position before leaving
    sessionStorage.setItem(`scroll:${location.pathname}`, String(window.scrollY));
    navigate(path);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-border bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {TABS.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <a
              key={path}
              href={path}
              onClick={(e) => handleTabClick(e, path)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 select-none transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
              {active && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-primary" />}
            </a>
          );
        })}
      </div>
    </div>
  );
}