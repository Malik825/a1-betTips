import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Trash2, PlusCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotificationsPage,
});

type NotificationType = "info" | "success" | "warning";

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  created_at: string;
}

const TYPE_CONFIG: Record<NotificationType, { icon: React.ReactNode; color: string; bg: string }> = {
  info:    { icon: <Info size={17} />,          color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  success: { icon: <CheckCircle2 size={17} />,  color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  warning: { icon: <AlertTriangle size={17} />, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
};

function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotificationType>("info");
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["push_notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("push_notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AppNotification[] || [];
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !message.trim()) throw new Error("Please fill in all fields");
      const { error } = await supabase.from("push_notifications").insert({ title, message, type });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["push_notifications"] });
      toast.success("Notification published");
      setTitle(""); setMessage("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("push_notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["push_notifications"] });
      toast.success("Notification removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>Push Notifications</h1>
        <p style={{ color: "var(--muted-foreground)", margin: "4px 0 0", fontSize: "14px" }}>Manage alerts shown to users inside the app</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.5fr)", gap: "24px" }}>

        {/* Create Form */}
        <div className="admin-card" style={{ padding: "24px", alignSelf: "start" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", margin: "0 0 20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <PlusCircle size={17} /> Create Notification
          </h2>

          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
            <div style={{ marginBottom: "16px" }}>
              <label className="admin-label">Title</label>
              <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Server Maintenance" />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label className="admin-label">Message</label>
              <textarea className="admin-textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Notification body..." />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label className="admin-label">Type</label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(Object.entries(TYPE_CONFIG) as [NotificationType, typeof TYPE_CONFIG[NotificationType]][]).map(([key, cfg]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setType(key)}
                    style={{
                      flex: 1,
                      padding: "9px 8px",
                      borderRadius: "8px",
                      border: `1.5px solid ${type === key ? cfg.color : "var(--border)"}`,
                      background: type === key ? cfg.bg : "var(--card)",
                      color: type === key ? cfg.color : "var(--muted-foreground)",
                      fontWeight: 600,
                      fontSize: "12px",
                      cursor: "pointer",
                      textTransform: "capitalize",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "5px",
                      fontFamily: "inherit",
                      transition: "all 0.15s",
                    }}
                  >
                    {cfg.icon} {key}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="admin-btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "12px" }}
            >
              <Bell size={15} /> {createMutation.isPending ? "Publishing..." : "Publish Notification"}
            </button>
          </form>
        </div>

        {/* Active Notifications */}
        <div className="admin-card" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", margin: "0 0 20px" }}>
            Active Notifications
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {isLoading ? (
              <p style={{ textAlign: "center", color: "var(--muted-foreground)", padding: "40px 0", margin: 0 }}>Loading...</p>
            ) : notifications.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--muted-foreground)", padding: "40px 0", margin: 0 }}>No active notifications</p>
            ) : notifications.map((notif) => {
              const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
              return (
                <div key={notif.id} style={{
                  display: "flex",
                  gap: "14px",
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "var(--secondary)",
                }}>
                  <div style={{ color: cfg.color, marginTop: "1px", flexShrink: 0 }}>{cfg.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px", gap: "8px" }}>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>{notif.title}</h4>
                      <span style={{ fontSize: "11px", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                        {new Date(notif.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                      {notif.message}
                    </p>
                    <button
                      onClick={() => deleteMutation.mutate(notif.id)}
                      disabled={deleteMutation.isPending}
                      style={{
                        background: "transparent", border: "none",
                        color: "#ef4444", fontSize: "12px", fontWeight: 600,
                        cursor: deleteMutation.isPending ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", gap: "4px",
                        padding: 0, fontFamily: "inherit",
                        opacity: deleteMutation.isPending ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
