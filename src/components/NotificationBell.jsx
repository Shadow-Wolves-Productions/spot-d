import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!userId) return;
    const load = () =>
      base44.entities.Notification.filter({ user_id: userId }, "-created_date", 20)
        .then(setNotifications);
    load();
    // Poll every 30s for new notifications
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notifications.filter((n) => !n.is_read);

  const markAllRead = async () => {
    const unreadIds = unread.map((n) => n.id);
    await Promise.all(unreadIds.map((id) => base44.entities.Notification.update(id, { is_read: true })));
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markRead = async (id) => {
    await base44.entities.Notification.update(id, { is_read: true });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-foreground" />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-black"
            style={{ background: "#FF5C35" }}>
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-80 z-50 rounded-xl border border-border shadow-2xl shadow-black/40 overflow-hidden"
            style={{ background: "#161616" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-display text-sm font-semibold text-foreground">Notifications</span>
              {unread.length > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-border/60">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer ${!n.is_read ? "border-l-2 border-primary" : "border-l-2 border-transparent"}`}
                    onClick={() => markRead(n.id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${!n.is_read ? "bg-primary" : "bg-transparent"}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold leading-snug ${n.is_read ? "text-muted-foreground" : "text-foreground"}`}>
                          {n.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                          {n.body}
                        </p>
                        {n.link && (
                          <Link
                            to={n.link}
                            onClick={() => setOpen(false)}
                            className="text-[11px] text-primary hover:underline mt-1 inline-block"
                          >
                            View →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}