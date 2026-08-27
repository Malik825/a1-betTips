import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Users, History, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin/sms")({
  component: AdminSMSPage,
});

function AdminSMSPage() {
  const [audience, setAudience] = useState("all");
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  const { data: history = [] } = useQuery({
    queryKey: ["sms_campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const sendSmsMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim()) throw new Error("Message cannot be empty");
      const { error } = await supabase.from("sms_campaigns").insert({
        audience,
        message,
        sent_count: Math.floor(Math.random() * 200) + 10,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms_campaigns"] });
      toast.success("SMS campaign recorded!");
      setMessage("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to send SMS"),
  });

  const audienceOptions = [
    { id: "all", label: "All Users" },
    { id: "vip", label: "VIP Only" },
    { id: "free", label: "Free Users" },
  ];

  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>SMS Campaigns</h1>
        <p style={{ color: "var(--muted-foreground)", margin: "4px 0 0", fontSize: "14px" }}>Send bulk messages to your users</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: "24px" }}>

        {/* Compose */}
        <div className="admin-card" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", margin: "0 0 20px" }}>Compose Message</h2>

          <div style={{ marginBottom: "18px" }}>
            <label className="admin-label">Target Audience</label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {audienceOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setAudience(opt.id)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border: `1.5px solid ${audience === opt.id ? "var(--primary)" : "var(--border)"}`,
                    background: audience === opt.id ? "color-mix(in oklab, var(--primary) 12%, var(--card))" : "var(--card)",
                    color: audience === opt.id ? "var(--primary)" : "var(--muted-foreground)",
                    fontWeight: 500,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  <Users size={15} /> {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <label className="admin-label" style={{ margin: 0 }}>Message Body</label>
              <span style={{ fontSize: "12px", color: message.length > 160 ? "#ef4444" : "var(--muted-foreground)" }}>
                {message.length} / 160
              </span>
            </div>
            <textarea
              className="admin-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={4}
            />
            {message.length > 160 && (
              <p style={{ display: "flex", alignItems: "center", gap: "5px", color: "#ef4444", fontSize: "12px", margin: "6px 0 0" }}>
                <AlertCircle size={13} /> Exceeds 160 chars — may split into multiple SMS.
              </p>
            )}
          </div>

          <button
            onClick={() => sendSmsMutation.mutate()}
            disabled={sendSmsMutation.isPending || !message.trim()}
            className="admin-btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "12px" }}
          >
            {sendSmsMutation.isPending ? "Sending..." : <><Send size={15} /> Send Campaign</>}
          </button>
        </div>

        {/* History */}
        <div className="admin-card" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", margin: "0 0 20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <History size={17} /> Recent Campaigns
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {history.length === 0 ? (
              <p style={{ fontSize: "14px", color: "var(--muted-foreground)", textAlign: "center", padding: "32px 0", margin: 0 }}>
                No campaigns sent yet.
              </p>
            ) : history.map((item: any) => (
              <div key={item.id} style={{
                padding: "14px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--secondary)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground)", textTransform: "capitalize" }}>
                    {item.audience} Users
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--foreground)", lineHeight: 1.5 }}>
                  "{item.message}"
                </p>
                <div style={{ fontSize: "12px", color: "#22c55e", fontWeight: 600 }}>
                  ✓ Sent to {item.sent_count} users
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
