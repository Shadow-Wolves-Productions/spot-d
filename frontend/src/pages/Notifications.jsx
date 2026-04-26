import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { Bell, BellOff, Check, ChevronRight, Loader2, Award, MessageCircle, Sparkles, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";

const ICONS = {
  role_alert: Briefcase,
  endorsement: Award,
  spot_request: Sparkles,
  spot_accepted: Sparkles,
  spot_declined: BellOff,
  new_application: MessageCircle,
  spotted_with: Sparkles,
  casting_match: Briefcase,
  system: Bell,
};

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        navigate("/login?next=" + encodeURIComponent("/notifications"));
        return;
      }
      const me = await base44.auth.me();
      const list = await base44.entities.Notification.filter({ user_id: me.id }, "-created_date", 50);
      setItems(list);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const markRead = async (n) => {
    if (n.is_read) {
      if (n.action_url || n.link) navigate(n.action_url || n.link);
      return;
    }
    await base44.entities.Notification.update(n.id, { is_read: true });
    setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    if (n.action_url || n.link) navigate(n.action_url || n.link);
  };

  const markAll = async () => {
    setMarking(true);
    await Promise.all(items.filter((n) => !n.is_read).map((n) => base44.entities.Notification.update(n.id, { is_read: true })));
    setItems((arr) => arr.map((x) => ({ ...x, is_read: true })));
    setMarking(false);
  };

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] font-mono text-muted-foreground">Inbox</p>
          <h1 className="font-display text-3xl sm:text-4xl font-500 text-foreground" style={{ letterSpacing: "-0.5px" }}>
            Notifications {unread > 0 && <span className="text-primary text-base align-middle ml-2">({unread})</span>}
          </h1>
        </div>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={markAll} disabled={marking} data-testid="mark-all-read-btn" className="rounded-full">
            {marking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1" /> Mark all read</>}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="w-5 h-5 text-primary" />
          </div>
          <h2 className="font-display text-lg font-semibold text-foreground">You're all caught up</h2>
          <p className="text-sm text-muted-foreground mt-2">New activity will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="notifications-list">
          <AnimatePresence>
            {items.map((n) => {
              const Icon = ICONS[n.type] || Bell;
              return (
                <motion.button
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => markRead(n)}
                  data-testid={`notification-${n.id}`}
                  className={`w-full text-left rounded-xl border p-4 flex items-start gap-3 transition-colors ${
                    n.is_read
                      ? "bg-card border-border hover:border-primary/30"
                      : "bg-primary/[0.04] border-primary/30 hover:border-primary/60"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${n.is_read ? "bg-secondary" : "bg-primary/15"}`}>
                    <Icon className={`w-4 h-4 ${n.is_read ? "text-muted-foreground" : "text-primary"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${n.is_read ? "text-foreground/70" : "text-foreground font-semibold"}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-1 leading-snug">{n.body}</p>}
                    <p className="text-[10px] uppercase tracking-[0.06em] font-mono text-muted-foreground mt-2">{timeAgo(n.created_date)}</p>
                  </div>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 mt-1 flex-shrink-0" />
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
