import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { 
  Search, Check, X, Clock, RefreshCw, CreditCard, 
  Smartphone, AlertCircle, ArrowUpRight, CheckCircle2, 
  XCircle, Filter, ChevronDown 
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/payments")({
  component: AdminPaymentsPage,
});

export function AdminPaymentsPage() {
  const { user: currentAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModalPayment, setRejectModalPayment] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // 1. Fetch manual payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["admin_manual_payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_payments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching manual_payments:", error);
        return [];
      }
      return data || [];
    },
  });

  // 2. Fetch VIP packages (for name & booking code)
  const { data: vipPackages = [] } = useQuery({
    queryKey: ["admin_vip_packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vip_packages").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Fetch VIP selections & fixtures (to create snapshot on approval)
  const { data: vipSelections = [] } = useQuery({
    queryKey: ["admin_vip_fixtures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_package_fixtures")
        .select(`
          id, package_id, fixture_id, prediction, odds, result_status,
          fixtures (id, home_team, away_team, competition, match_time, match_date_iso)
        `);
      if (error) throw error;
      return data || [];
    },
  });

  // 4. Fetch profiles for user emails
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin_user_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, username");
      if (error) return [];
      return data || [];
    },
  });

  // Approve Payment Mutation
  const approveMutation = useMutation({
    mutationFn: async (payment: any) => {
      setProcessingId(payment.id);

      // 1. Find package and package selections
      const pkg = vipPackages.find((p: any) => p.id === payment.package_id);
      const pkgSels = vipSelections.filter((s: any) => s.package_id === payment.package_id);

      const snapshot = pkgSels.map((sel: any) => {
        const fix = sel.fixtures || null;
        return {
          id: sel.id,
          fixture_id: sel.fixture_id,
          match: fix ? `${fix.home_team} vs ${fix.away_team}` : sel.fixture_id,
          competition: fix?.competition || "",
          match_time: fix?.match_time || "",
          match_date: fix?.match_date_iso || "",
          prediction: sel.prediction,
        };
      });

      // 2. Insert into user_tickets
      const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const ticketPayload: any = {
        id: ticketId,
        user_id: payment.user_id,
        package_id: payment.package_id,
        payment_ref: payment.reference_code,
        booking_code: pkg?.booking_code || null,
        snapshot: snapshot.length > 0 ? snapshot : null,
        amount_paid: Number(payment.amount || pkg?.price || 0),
        purchased_at: new Date().toISOString(),
      };

      const { error: ticketError } = await supabase.from("user_tickets").insert(ticketPayload);
      if (ticketError) {
        console.warn("Standard user_tickets insert failed, attempting fallback:", ticketError);
        const { error: fallbackError } = await supabase.from("user_tickets").insert({
          id: ticketPayload.id,
          user_id: payment.user_id,
          package_id: payment.package_id,
          payment_ref: payment.reference_code,
        });
        if (fallbackError) throw fallbackError;
      }

      // 3. Mark manual payment as approved
      const { error: updateError } = await supabase
        .from("manual_payments")
        .update({
          status: "approved",
          reviewed_by: currentAdmin?.id || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] });
      queryClient.invalidateQueries({ queryKey: ["all_user_tickets"] });
      queryClient.invalidateQueries({ queryKey: ["user_tickets"] });
      toast.success("Payment approved! VIP access successfully activated for customer.");
      setProcessingId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve payment");
      setProcessingId(null);
    },
  });

  // Reject Payment Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      setProcessingId(paymentId);
      const { error } = await supabase
        .from("manual_payments")
        .update({
          status: "rejected",
          rejection_reason: reason.trim() || "Payment verification failed or not received.",
          reviewed_by: currentAdmin?.id || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] });
      toast.success("Payment marked as rejected.");
      setRejectModalPayment(null);
      setRejectReason("");
      setProcessingId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject payment");
      setProcessingId(null);
    },
  });

  // Stats
  const totalCount = payments.length;
  const pendingCount = payments.filter((p: any) => p.status === "pending").length;
  const approvedCount = payments.filter((p: any) => p.status === "approved").length;
  const rejectedCount = payments.filter((p: any) => p.status === "rejected").length;
  const totalApprovedAmount = payments
    .filter((p: any) => p.status === "approved")
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  // Filtering
  const filteredPayments = payments.filter((p: any) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!search.trim()) return true;

    const term = search.toLowerCase();
    const pkg = vipPackages.find((pkgItem: any) => pkgItem.id === p.package_id);
    const userProfile = profiles.find((prof: any) => prof.id === p.user_id);

    return (
      (p.reference_code || "").toLowerCase().includes(term) ||
      (p.sender_phone || "").toLowerCase().includes(term) ||
      (p.sender_name || "").toLowerCase().includes(term) ||
      (p.transaction_id || "").toLowerCase().includes(term) ||
      (pkg?.name || "").toLowerCase().includes(term) ||
      (userProfile?.email || "").toLowerCase().includes(term) ||
      (userProfile?.username || "").toLowerCase().includes(term)
    );
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <CreditCard className="text-green-500" size={24} />
            Mobile Money Direct Payments
          </h1>
          <p style={{ color: "var(--muted-foreground)", margin: "4px 0 0", fontSize: "14px" }}>
            Review incoming MoMo transfers and instantly activate VIP package access
          </p>
        </div>

        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] })}
          className="admin-btn-ghost"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        
        {/* Pending Card */}
        <div 
          onClick={() => setStatusFilter("pending")}
          style={{
            cursor: "pointer",
            background: "var(--card)",
            border: statusFilter === "pending" ? "2px solid #f59e0b" : "1px solid var(--border)",
            padding: "18px",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ color: "var(--muted-foreground)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
              Pending Review
            </p>
            <h3 style={{ fontSize: "24px", fontWeight: 800, color: "#f59e0b", margin: "4px 0 0" }}>
              {pendingCount}
            </h3>
          </div>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#f59e0b18", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={20} />
          </div>
        </div>

        {/* Approved Card */}
        <div 
          onClick={() => setStatusFilter("approved")}
          style={{
            cursor: "pointer",
            background: "var(--card)",
            border: statusFilter === "approved" ? "2px solid #10b981" : "1px solid var(--border)",
            padding: "18px",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ color: "var(--muted-foreground)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
              Approved
            </p>
            <h3 style={{ fontSize: "24px", fontWeight: 800, color: "#10b981", margin: "4px 0 0" }}>
              {approvedCount}
            </h3>
          </div>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#10b98118", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Total Revenue Card */}
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          padding: "18px",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <p style={{ color: "var(--muted-foreground)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
              Verified MoMo Revenue
            </p>
            <h3 style={{ fontSize: "24px", fontWeight: 800, color: "var(--foreground)", margin: "4px 0 0" }}>
              GHS {totalApprovedAmount.toFixed(2)}
            </h3>
          </div>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#3b82f618", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CreditCard size={20} />
          </div>
        </div>

        {/* Rejected Card */}
        <div 
          onClick={() => setStatusFilter("rejected")}
          style={{
            cursor: "pointer",
            background: "var(--card)",
            border: statusFilter === "rejected" ? "2px solid #ef4444" : "1px solid var(--border)",
            padding: "18px",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ color: "var(--muted-foreground)", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", margin: 0 }}>
              Rejected
            </p>
            <h3 style={{ fontSize: "24px", fontWeight: 800, color: "#ef4444", margin: "4px 0 0" }}>
              {rejectedCount}
            </h3>
          </div>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#ef444418", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <XCircle size={20} />
          </div>
        </div>

      </div>

      {/* Main Filter & Table Card */}
      <div className="admin-card">
        <div className="admin-card-header">
          {/* Status Tabs */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(["pending", "all", "approved", "rejected"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  textTransform: "capitalize",
                  background: statusFilter === tab ? "var(--foreground)" : "transparent",
                  color: statusFilter === tab ? "var(--background)" : "var(--muted-foreground)",
                  transition: "all 0.15s ease",
                }}
              >
                {tab}
                {tab === "pending" && pendingCount > 0 && (
                  <span style={{ marginLeft: "6px", padding: "1px 6px", borderRadius: "999px", background: "#f59e0b", color: "#000", fontSize: "11px", fontWeight: 800 }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)" }} />
            <input
              className="admin-input"
              type="text"
              placeholder="Search phone, ref, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "34px", width: "240px", fontSize: "13px" }}
            />
          </div>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>User / Customer</th>
                <th>Package & Amount</th>
                <th>Sender Details</th>
                <th>Reference & TxID</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paymentsLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--muted-foreground)", padding: "40px" }}>
                    Loading manual payments...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--muted-foreground)", padding: "40px" }}>
                    No payment requests found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment: any) => {
                  const pkg = vipPackages.find((p: any) => p.id === payment.package_id);
                  const userProfile = profiles.find((prof: any) => prof.id === payment.user_id);
                  const userDisplay = userProfile?.email || userProfile?.username || `ID: ${payment.user_id.substring(0, 8)}...`;
                  const isProcessing = processingId === payment.id;

                  return (
                    <tr key={payment.id}>
                      {/* Date */}
                      <td style={{ color: "var(--muted-foreground)", fontSize: "12px", whiteSpace: "nowrap" }}>
                        {new Date(payment.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                        <div style={{ fontSize: "11px", opacity: 0.7 }}>
                          {new Date(payment.created_at).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>

                      {/* User */}
                      <td>
                        <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--foreground)" }}>
                          {userDisplay}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
                          UID: {payment.user_id.substring(0, 8)}
                        </div>
                      </td>

                      {/* Package */}
                      <td>
                        <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--foreground)" }}>
                          {pkg?.name || payment.package_id}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: "12px", color: "#10b981" }}>
                          GHS {Number(payment.amount).toFixed(2)}
                        </div>
                      </td>

                      {/* Sender MoMo details */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Smartphone size={13} style={{ color: "var(--muted-foreground)" }} />
                          <span style={{ fontWeight: 700, fontSize: "13px" }}>{payment.sender_phone}</span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                          {payment.sender_name} ({payment.network || "MTN"})
                        </div>
                      </td>

                      {/* Reference code & MoMo transaction ID */}
                      <td>
                        <div style={{ display: "inline-block", background: "var(--secondary)", padding: "2px 8px", borderRadius: "6px", fontFamily: "monospace", fontWeight: 700, fontSize: "12px" }}>
                          {payment.reference_code}
                        </div>
                        {payment.transaction_id && (
                          <div style={{ fontSize: "11px", color: "var(--muted-foreground)", marginTop: "2px" }}>
                            TxID: <span style={{ fontFamily: "monospace" }}>{payment.transaction_id}</span>
                          </div>
                        )}
                      </td>

                      {/* Status badge */}
                      <td>
                        {payment.status === "pending" && (
                          <span className="admin-badge" style={{ background: "#fef3c7", color: "#92400e", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={11} /> Pending
                          </span>
                        )}
                        {payment.status === "approved" && (
                          <span className="admin-badge" style={{ background: "#dcfce7", color: "#166534", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Check size={11} /> Approved
                          </span>
                        )}
                        {payment.status === "rejected" && (
                          <div>
                            <span className="admin-badge" style={{ background: "#fee2e2", color: "#991b1b", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <X size={11} /> Rejected
                            </span>
                            {payment.rejection_reason && (
                              <div style={{ fontSize: "10px", color: "#ef4444", marginTop: "2px", maxWidth: "160px" }}>
                                {payment.rejection_reason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {payment.status === "pending" ? (
                          <div style={{ display: "inline-flex", gap: "8px" }}>
                            <button
                              disabled={isProcessing}
                              onClick={() => {
                                if (confirm(`Approve GHS ${payment.amount} for ${userDisplay}? This will activate VIP access immediately.`)) {
                                  approveMutation.mutate(payment);
                                }
                              }}
                              className="admin-btn-green"
                              style={{ padding: "6px 12px", fontSize: "12px", cursor: isProcessing ? "wait" : "pointer" }}
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button
                              disabled={isProcessing}
                              onClick={() => setRejectModalPayment(payment)}
                              style={{
                                padding: "6px 10px",
                                background: "#fee2e2",
                                color: "#dc2626",
                                border: "1px solid #fecaca",
                                borderRadius: "8px",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <X size={14} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                            Processed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Reason Modal */}
      {rejectModalPayment && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        }}>
          <div style={{
            background: "var(--card)", borderRadius: "14px", border: "1px solid var(--border)",
            padding: "24px", maxWidth: "440px", width: "100%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 8px", color: "var(--foreground)" }}>
              Reject Payment Request
            </h3>
            <p style={{ fontSize: "13px", color: "var(--muted-foreground)", margin: "0 0 16px" }}>
              Enter the reason for rejecting this payment (e.g., funds not received, wrong amount).
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label className="admin-label">Rejection Reason</label>
              <textarea
                className="admin-input"
                rows={3}
                placeholder="e.g. Payment not received on our MoMo statement"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{ width: "100%", resize: "none" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  setRejectModalPayment(null);
                  setRejectReason("");
                }}
                className="admin-btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending}
                onClick={() => {
                  rejectMutation.mutate({
                    paymentId: rejectModalPayment.id,
                    reason: rejectReason,
                  });
                }}
                style={{
                  padding: "8px 16px",
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
