import { Link, useLocation } from "react-router-dom";
import { Search, Film, LayoutDashboard } from "lucide-react";

const TABS = [
  { path: "/search", label: "Directory", icon: Search },
  { path: "/casting", label: "Casting", icon: Film },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export default function MobileBottomTabs() {
  const location = useLocation();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {TABS.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 select-none transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
              {active && <div className="absolute bottom-0 w-8 h-[2px] bg-primary" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}