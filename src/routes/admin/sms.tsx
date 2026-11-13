import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Send, Users, History, AlertCircle, CheckCircle2,
  MessageSquare, Zap, TestTube,
} from "lucide-react";
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

  // ── Load SMS campaign history ──────────────────────────────────────
  const { data: history = [] } = useQuery({
    queryKey: ["sms_campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // ── Load Moolre config from admin_settings ─────────────────────────
  const { data: adminSettings } = useQuery({
    queryKey: ["admin_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("moolre_api_user, moolre_pub_key, moolre_secret_key, moolre_sender_id, moolre_test_mode")
        .eq("id", 1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const moolreConfigured = !!(adminSettings?.moolre_api_user && adminSettings?.moolre_secret_key);
  const testMode = adminSettings?.moolre_test_mode !== false; // default true until configured

  // ── Dispatch SMS via Moolre Edge Function ──────────────────────────
  const sendSmsMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim()) throw new Error("Message cannot be empty");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/moolre-sms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ audience, message }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to dispatch SMS");
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["sms_campaigns"] });
      if (result.testMode) {
        toast.success(`Test run OK — would reach ${result.dispatched} recipients`);
      } else {
        toast.success(`SMS sent to ${result.dispatched} recipients via Moolre!`);
      }
      setMessage("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to send SMS"),
  });

  const audienceOptions = [
    { id: "all",  label: "All Users",  icon: "👥" },
    { id: "vip",  label: "VIP Only",   icon: "👑" },
    { id: "free", label: "Free Users", icon: "🆓" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
          SMS Campaigns
        </h1>
        <p style={{ color: "var(--muted-foreground)", margin: "4px 0 0", fontSize: "14px" }}>
          Send bulk messages to your users via Moolre SMS
        </p>
      </div>

      {/* Moolre status banner */}
      <div style={{
        marginBottom: "20px",
        padding: "12px 16px",
        borderRadius: "10px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        border: "1px solid",
        ...(moolreConfigured
          ? {
              background: testMode
                ? "rgba(234,179,8,0.08)"
                : "rgba(34,197,94,0.08)",
              borderColor: testMode ? "#ca8a04" : "#16a34a",
            }
          : {
              background: "rgba(239,68,68,0.07)",
              borderColor: "#dc2626",
            }),
      }}>
        {moolreConfigured ? (
          testMode ? (
            <>
              <TestTube size={16} style={{ color: "#ca8a04", flexShrink: 0 }} />
              <span style={{ fontSize: "13px", color: "#ca8a04", fontWeight: 600 }}>
                Moolre SMS — Test Mode
              </span>
              <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                Campaigns will be logged but NOT actually sent. Disable test mode in Settings → Payment Gateways when ready.
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 size={16} style={{ color: "#16a34a", flexShrink: 0 }} />
              <span style={{ fontSize: "13px", color: "#16a34a", fontWeight: 600 }}>
                Moolre SMS — Live
              </span>
              <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                Real SMS will be dispatched. Sender ID: <strong>{adminSettings?.moolre_sender_id || "A1TIPS"}</strong>
              </span>
            </>
          )
        ) : (
          <>
            <AlertCircle size={16} style={{ color: "#dc2626", flexShrink: 0 }} />
            <span style={{ fontSize: "13px", color: "#dc2626", fontWeight: 600 }}>
              Moolre not configured —
            </span>
            <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
              Go to <strong>Settings → Payment Gateways → Moolre</strong> and enter your API credentials.
            </span>
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: "24px" }}>

        {/* Compose panel */}
        <div className="admin-card" style={{ padding: "24px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", margin: "0 0 20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <MessageSquare size={17} /> Compose Message
          </h2>

          {/* Audience */}
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
                    background: audience === opt.id
                      ? "color-mix(in oklab, var(--primary) 12%, var(--card))"
                      : "var(--card)",
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
                  <span>{opt.icon}</span> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message body */}
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
                <AlertCircle size={13} /> Exceeds 160 chars — will be split into multiple SMS parts (additional cost).
              </p>
            )}
          </div>

          <button
            onClick={() => sendSmsMutation.mutate()}
            disabled={sendSmsMutation.isPending || !message.trim() || !moolreConfigured}
            className="admin-btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "12px" }}
          >
            {sendSmsMutation.isPending
              ? "Sending..."
              : testMode
                ? <><TestTube size={15} /> Run Test Send</>
                : <><Zap size={15} /> Send Campaign via Moolre</>
            }
          </button>

          {!moolreConfigured && (
            <p style={{ textAlign: "center", marginTop: "10px", fontSize: "12px", color: "var(--muted-foreground)" }}>
              Configure Moolre credentials in Settings first.
            </p>
          )}
        </div>

        {/* History panel */}
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
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "4px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground)", textTransform: "capitalize" }}>
                    {item.audience} users
                    {item.test_mode && (
                      <span style={{
                        marginLeft: "6px",
                        fontSize: "10px",
                        background: "rgba(234,179,8,0.15)",
                        color: "#ca8a04",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontWeight: 600,
                      }}>TEST</span>
                    )}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--foreground)", lineHeight: 1.5 }}>
                  "{item.message}"
                </p>
                <div style={{ fontSize: "12px", color: "#22c55e", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                  <CheckCircle2 size={12} /> {item.sent_count} recipients
                  {item.gateway && (
                    <span style={{ marginLeft: "8px", color: "var(--muted-foreground)", fontWeight: 400 }}>
                      via {item.gateway}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
