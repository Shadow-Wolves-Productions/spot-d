import { useLocation, useNavigate } from "react-router-dom";
import { Search, Film, LayoutDashboard, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { base44, tokenStore } from "@/api/base44Client";

const TABS = [
  { path: "/search", label: "Directory", icon: Search, testId: "tab-directory" },
  { path: "/casting", label: "Casting", icon: Film, testId: "tab-casting" },
  { path: "/notifications", label: "Inbox", icon: Bell, testId: "tab-notifications", badgeKey: "unread" },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "tab-dashboard" },
];

export default function MobileBottomTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const saved = sessionStorage.getItem(`scroll:${location.pathname}`);
    if (saved !== null) {
      requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
    }
  }, [location.pathname]);

  // Poll unread count every 30s when authenticated
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      if (!tokenStore.get()) return;
      try {
        const me = await base44.auth.me();
        const list = await base44.entities.Notification.filter({ user_id: me.id, is_read: false }, "-created_date", 50);
        if (mounted) setUnread(list.length);
      } catch { /* not signed in */ }
    };
    refresh();
    const id = setInterval(refresh, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, [location.pathname]);

  const handleTabClick = (e, path) => {
    e.preventDefault();
    sessionStorage.setItem(`scroll:${location.pathname}`, String(window.scrollY));
    navigate(path);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-border bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      data-testid="mobile-bottom-tabs"
    >
      <div className="flex">
        {TABS.map(({ path, label, icon: Icon, testId, badgeKey }) => {
          const active = location.pathname === path;
          const showBadge = badgeKey === "unread" && unread > 0;
          return (
            <a
              key={path}
              href={path}
              onClick={(e) => handleTabClick(e, path)}
              data-testid={testId}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 select-none transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {showBadge && (
                  <span
                    data-testid="tab-notifications-badge"
                    className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{ background: "#FF5C35", color: "#fff" }}
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
              {active && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-primary" />}
            </a>
          );
        })}
      </div>
    </div>
  );
}
