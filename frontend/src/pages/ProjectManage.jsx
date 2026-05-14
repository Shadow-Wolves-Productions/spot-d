import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Mail, Users, CheckCircle, XCircle,
  Clock, Eye, EyeOff, ExternalLink, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const INQUIRY_TYPE_COLORS = {
  "Investment":    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Collaboration": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Distribution":  "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "Casting":       "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "General":       "bg-white/[0.05] text-muted-foreground border-white/[0.06]",
};

function InquiryCard({ inquiry, onMarkRead }) {
  const [marking, setMarking] = useState(false);
  const isUnread = inquiry.status === "unread";
  const typeStyle = INQUIRY_TYPE_COLORS[inquiry.inquiry_type] || INQUIRY_TYPE_COLORS["General"];

  const markRead = async () => {
    if (!isUnread) return;
    setMarking(true);
    try {
      await base44.entities.ProjectInquiry.update(inquiry.id, { status: "read" });
      onMarkRead(inquiry.id);
    } catch {
      toast.error("Failed to mark as read");
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className={`rounded-xl border p-5 transition-all ${isUnread ? "border-primary/20 bg-primary/5" : "border-white/[0.06] bg-card"}`}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {inquiry.sender_photo ? (
            <img src={inquiry.sender_photo} alt="" className="w-10 h-10 rounded-full object-cover border border-white/[0.08]" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-secondary border border-white/[0.06] flex items-center justify-center text-foreground font-semibold text-sm">
              {(inquiry.sender_name || "?")[0].toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {inquiry.sender_profile_id ? (
              <Link
                to={`/profiles/${inquiry.sender_profile_id}`}
                className="font-semibold text-foreground hover:text-primary transition-colors"
              >
                {inquiry.sender_name || "Anonymous"}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{inquiry.sender_name || "Anonymous"}</span>
            )}
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${typeStyle}`}>
              {inquiry.inquiry_type || "General"}
            </span>
            {isUnread && (
              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" title="Unread" />
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{inquiry.message}</p>

          <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
            <span>{inquiry.created_date ? new Date(inquiry.created_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : ""}</span>
            {isUnread && (
              <button
                onClick={markRead}
                disabled={marking}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {marking
                  ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  : <EyeOff className="w-3 h-3" />}
                Mark read
              </button>
            )}
            {!isUnread && (
              <span className="flex items-center gap-1 text-muted-foreground/40">
                <Eye className="w-3 h-3" /> Read
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AttachmentCard({ attachment, onAction }) {
  const [acting, setActing] = useState(null);

  const handleAction = async (newStatus) => {
    setActing(newStatus);
    try {
      await base44.http.patch(`/api/projects/${attachment.project_id}/attachment/${attachment.id}`, { status: newStatus });
      toast.success(newStatus === "approved" ? "Request approved" : "Request declined");
      onAction(attachment.id, newStatus);
    } catch {
      toast.error("Action failed");
    } finally {
      setActing(null);
    }
  };

  const isPending = attachment.status === "pending";

  return (
    <div className={`rounded-xl border p-5 transition-all ${isPending ? "border-amber-500/20 bg-amber-500/5" : attachment.status === "approved" ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/[0.06] bg-card opacity-60"}`}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {attachment.display_photo ? (
            <img src={attachment.display_photo} alt="" className="w-10 h-10 rounded-full object-cover border border-white/[0.08]" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-secondary border border-white/[0.06] flex items-center justify-center text-foreground font-semibold text-sm">
              {(attachment.display_name || "?")[0].toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {attachment.profile_id ? (
              <Link
                to={`/profiles/${attachment.profile_id}`}
                className="font-semibold text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
              >
                {attachment.display_name || "Unknown"}
                <ExternalLink className="w-3 h-3" />
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{attachment.display_name || "Unknown"}</span>
            )}
            {attachment.role_on_project && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/[0.06] bg-white/[0.04] text-muted-foreground">
                {attachment.role_on_project}
              </span>
            )}
          </div>

          {attachment.note && (
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed italic">"{attachment.note}"</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {isPending ? (
              <>
                <Button
                  size="sm"
                  className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold gap-1"
                  onClick={() => handleAction("approved")}
                  disabled={!!acting}
                >
                  {acting === "approved"
                    ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    : <CheckCircle className="w-3.5 h-3.5" />}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold gap-1"
                  onClick={() => handleAction("rejected")}
                  disabled={!!acting}
                >
                  {acting === "rejected"
                    ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    : <XCircle className="w-3.5 h-3.5" />}
                  Decline
                </Button>
              </>
            ) : (
              <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
                attachment.status === "approved"
                  ? "border-emerald-500/20 text-emerald-400"
                  : "border-destructive/20 text-destructive/70"
              }`}>
                {attachment.status === "approved" ? "Approved" : "Declined"}
              </span>
            )}
            <span className="text-xs text-muted-foreground/40">
              {attachment.created_date ? new Date(attachment.created_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectManage() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [inquiries, setInquiries] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inquiries");

  const load = useCallback(async () => {
    try {
      const me = await base44.auth.me();
      const proj = await base44.entities.Project.get(projectId);
      if (!proj) { navigate("/projects"); return; }
      if (proj.creator_user_id !== me.id && me.role !== "admin") {
        toast.error("Access denied");
        navigate(`/projects/${projectId}`);
        return;
      }
      setProject(proj);

      const [inqs, atts] = await Promise.all([
        base44.entities.ProjectInquiry.filter({ project_id: projectId }),
        base44.entities.ProjectAttachment.filter({ project_id: projectId }),
      ]);
      setInquiries((inqs || []).sort((a, b) => {
        if (a.status === "unread" && b.status !== "unread") return -1;
        if (b.status === "unread" && a.status !== "unread") return 1;
        return new Date(b.created_date) - new Date(a.created_date);
      }));
      setAttachments((atts || []).sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        return new Date(b.created_date) - new Date(a.created_date);
      }));
    } catch (err) {
      // 401 = not logged in → redirect to login preserving return URL
      if (err?.response?.status === 401) {
        base44.auth.redirectToLogin(window.location.pathname);
      } else {
        toast.error("Failed to load project");
        navigate("/projects");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = (inquiryId) => {
    setInquiries((prev) => prev.map((i) => i.id === inquiryId ? { ...i, status: "read" } : i));
  };

  const handleAttachmentAction = (attachmentId, newStatus) => {
    setAttachments((prev) => prev.map((a) => a.id === attachmentId ? { ...a, status: newStatus } : a));
  };

  const unreadCount = inquiries.filter((i) => i.status === "unread").length;
  const pendingCount = attachments.filter((a) => a.status === "pending").length;

  if (loading) {
    return (
      <div className="pt-24 flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="pt-24 pb-20 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <Link
          to={`/projects/${projectId}`}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to project
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold text-foreground">{project.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage inquiries and team attachment requests.</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-secondary/60 rounded-xl border border-white/[0.06] mb-6 w-fit">
          {[
            { id: "inquiries", label: "Inquiries", icon: Mail, count: unreadCount },
            { id: "team",      label: "Team Requests", icon: Users, count: pendingCount },
          ].map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-card text-foreground shadow-sm border border-white/[0.06]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Inquiries tab */}
        {activeTab === "inquiries" && (
          <div className="space-y-4">
            {inquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-white/[0.06]">
                <Mail className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">No inquiries yet.</p>
                <p className="text-muted-foreground/60 text-xs mt-1">When someone contacts your project, it'll appear here.</p>
              </div>
            ) : (
              <>
                {unreadCount > 0 && (
                  <div className="flex items-center gap-2 text-xs text-primary mb-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {unreadCount} unread {unreadCount === 1 ? "inquiry" : "inquiries"}
                  </div>
                )}
                {inquiries.map((inq) => (
                  <InquiryCard key={inq.id} inquiry={inq} onMarkRead={handleMarkRead} />
                ))}
              </>
            )}
          </div>
        )}

        {/* Team requests tab */}
        {activeTab === "team" && (
          <div className="space-y-4">
            {attachments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-white/[0.06]">
                <Users className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">No team attachment requests yet.</p>
                <p className="text-muted-foreground/60 text-xs mt-1">When someone requests to join your team, it'll appear here.</p>
              </div>
            ) : (
              <>
                {pendingCount > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 mb-2">
                    <Clock className="w-3.5 h-3.5" />
                    {pendingCount} pending {pendingCount === 1 ? "request" : "requests"}
                  </div>
                )}
                {attachments.map((att) => (
                  <AttachmentCard key={att.id} attachment={att} onAction={handleAttachmentAction} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
