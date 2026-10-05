import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { 
  Search, Check, X, Clock, RefreshCw, CreditCard, 
  Smartphone, AlertCircle, ArrowUpRight, CheckCircle2, 
  XCircle, Filter, ChevronDown, MoreVertical, Eye,
  ExternalLink, Calendar, User, Hash, FileText, Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/payments")({
  component: AdminPaymentsPage,
});

function formatPaymentDate(dateStr: string) {
  if (!dateStr) return { top: "—", bottom: "" };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { top: "—", bottom: "" };
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const year = d.toLocaleDateString("en-GB", { year: "2-digit" });
  return { top: `${day} ${month}`, bottom: year };
}

function truncateRef(ref: string | null | undefined, max = 12) {
  if (!ref) return "—";
  if (ref.length <= max) return ref;
  return `${ref.slice(0, 10)}...`;
}

function AdminPaymentsPage() {
  const { user: currentAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModalPayment, setRejectModalPayment] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [viewModalPayment, setViewModalPayment] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
      if (viewModalPayment) setViewModalPayment(null);
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
      if (viewModalPayment) setViewModalPayment(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject payment");
      setProcessingId(null);
    },
  });

  // Set Pending Mutation
  const setPendingMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      setProcessingId(paymentId);
      const { error } = await supabase
        .from("manual_payments")
        .update({
          status: "pending",
          rejection_reason: null,
          reviewed_by: currentAdmin?.id || null,
          reviewed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] });
      toast.success("Payment reset to pending.");
      setProcessingId(null);
      if (viewModalPayment) setViewModalPayment(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reset payment status");
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

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredPayments.map((p: any) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2.5">
            <CreditCard className="text-primary w-5 h-5" />
            Direct Payments Management
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review incoming mobile transfers, inspect proof screenshots, and manage VIP customer activations.
          </p>
        </div>

        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] })}
          className="flex items-center gap-2 text-xs py-2 px-3.5 rounded-lg border border-border bg-card text-foreground hover:bg-section transition-colors cursor-pointer"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Pending Card */}
        <div 
          onClick={() => setStatusFilter("pending")}
          className={`cursor-pointer bg-card p-4 rounded-xl border transition-all flex items-center justify-between ${
            statusFilter === "pending"
              ? "border-warning shadow-md shadow-warning/10 ring-2 ring-warning/30"
              : "border-border hover:border-border/80"
          }`}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Pending Review
            </p>
            <h3 className="text-2xl font-black text-warning mt-1">
              {pendingCount}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
            <Clock size={18} />
          </div>
        </div>

        {/* Approved Card */}
        <div 
          onClick={() => setStatusFilter("approved")}
          className={`cursor-pointer bg-card p-4 rounded-xl border transition-all flex items-center justify-between ${
            statusFilter === "approved"
              ? "border-success shadow-md shadow-success/10 ring-2 ring-success/30"
              : "border-border hover:border-border/80"
          }`}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Approved
            </p>
            <h3 className="text-2xl font-black text-success mt-1">
              {approvedCount}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>

        {/* Total Revenue Card */}
        <div className="bg-card p-4 rounded-xl border border-border flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Verified Revenue
            </p>
            <h3 className="text-2xl font-black text-foreground mt-1">
              GHS {totalApprovedAmount.toFixed(0)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <CreditCard size={18} />
          </div>
        </div>

        {/* Rejected Card */}
        <div 
          onClick={() => setStatusFilter("rejected")}
          className={`cursor-pointer bg-card p-4 rounded-xl border transition-all flex items-center justify-between ${
            statusFilter === "rejected"
              ? "border-destructive shadow-md shadow-destructive/10 ring-2 ring-destructive/30"
              : "border-border hover:border-border/80"
          }`}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Rejected
            </p>
            <h3 className="text-2xl font-black text-destructive mt-1">
              {rejectedCount}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
            <XCircle size={18} />
          </div>
        </div>

      </div>

      {/* Main Filter & Table Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Filter bar */}
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-section/40">
          {/* Status Tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {(["pending", "all", "approved", "rejected"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  statusFilter === tab
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-section"
                }`}
              >
                {tab}
                {tab === "pending" && pendingCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 bg-warning text-black text-[10px] font-black rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search user, ref, txid..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* ── Mobile Card List (hidden on sm+) ── */}
        <div className="sm:hidden divide-y divide-border/60">
          {paymentsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm gap-2">
              <RefreshCw className="w-5 h-5 animate-spin opacity-50" />
              Loading payments...
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center text-muted-foreground py-16 text-sm">
              No payment records found matching your filter.
            </div>
          ) : (
            filteredPayments.map((payment: any) => {
              const pkg = vipPackages.find((p: any) => p.id === payment.package_id);
              const userProfile = profiles.find((prof: any) => prof.id === payment.user_id);
              const userDisplay = payment.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "Customer";
              const isProcessing = processingId === payment.id;
              const dateInfo = formatPaymentDate(payment.created_at);

              return (
                <div key={payment.id} className="p-4 space-y-3 hover:bg-section/30 transition-colors">
                  {/* Top row: user + status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground truncate leading-tight">{userDisplay}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                        {userProfile?.email || `ID: ${payment.user_id.substring(0, 10)}...`}
                      </p>
                    </div>
                    {payment.status === "pending" && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-warning/15 border border-warning/30 text-warning">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                    {payment.status === "approved" && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-success/15 border border-success/30 text-success">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                      </span>
                    )}
                    {payment.status === "rejected" && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-destructive/15 border border-destructive/30 text-destructive">
                        <XCircle className="w-3 h-3" /> Rejected
                      </span>
                    )}
                  </div>

                  {/* Middle row: amount + date + ref */}
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Amount</span>
                      <span className="font-black text-foreground">GHS {Number(payment.amount || pkg?.price || 0).toFixed(0)}</span>
                      <span className="text-warning font-semibold ml-1 text-[11px]">{payment.network || "MTN"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Date</span>
                      <span className="font-bold text-foreground">{dateInfo.top}</span>
                      <span className="text-muted-foreground ml-1">{dateInfo.bottom}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Ref</span>
                      <span
                        className="font-mono font-bold text-foreground tracking-wider truncate"
                        title={payment.transaction_id || payment.reference_code}
                      >
                        {truncateRef(payment.transaction_id || payment.reference_code, 12)}
                      </span>
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setViewModalPayment(payment)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-section transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" /> View
                    </button>
                    {payment.status !== "approved" && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => {
                          if (confirm(`Approve GHS ${payment.amount} for ${userDisplay}?`)) {
                            approveMutation.mutate(payment);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-success/15 border border-success/30 text-xs font-bold text-success hover:bg-success/25 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    {payment.status !== "rejected" && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => setRejectModalPayment(payment)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-destructive/15 border border-destructive/30 text-xs font-bold text-destructive hover:bg-destructive/25 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-section border border-border transition-colors focus:outline-none cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card-elevated border border-border text-foreground min-w-[180px] p-1.5 shadow-xl rounded-xl z-50">
                        <DropdownMenuItem
                          disabled={isProcessing}
                          onClick={() => setPendingMutation.mutate(payment.id)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-warning hover:bg-warning/10 rounded-lg cursor-pointer"
                        >
                          <Clock className="w-4 h-4 text-warning" /> Mark as Pending
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Desktop Table (hidden on mobile) ── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-section/70 text-[11px] font-bold tracking-wider text-muted-foreground uppercase select-none">
                <th className="py-3.5 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredPayments.length > 0 && selectedIds.length === filteredPayments.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">USER</th>
                <th className="py-3.5 px-4">AMOUNT</th>
                <th className="py-3.5 px-4">DATE</th>
                <th className="py-3.5 px-4">TXN REF</th>
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paymentsLoading ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-16 text-sm">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                    Loading payments...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-16 text-sm">
                    No payment records found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment: any) => {
                  const pkg = vipPackages.find((p: any) => p.id === payment.package_id);
                  const userProfile = profiles.find((prof: any) => prof.id === payment.user_id);
                  const userDisplay = payment.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "Customer";
                  const userEmail = userProfile?.email || `ID: ${payment.user_id.substring(0, 8)}...`;
                  const isProcessing = processingId === payment.id;
                  const dateInfo = formatPaymentDate(payment.created_at);

                  return (
                    <tr 
                      key={payment.id}
                      className="hover:bg-section/40 transition-colors"
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(payment.id)}
                          onChange={() => handleSelectRow(payment.id)}
                          className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* USER */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-sm text-foreground leading-tight">
                          {userDisplay}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {userEmail}
                        </div>
                      </td>

                      {/* AMOUNT */}
                      <td className="py-4 px-4">
                        <div className="font-black text-sm text-foreground">
                          GHS {Number(payment.amount || pkg?.price || 0).toFixed(0)}
                        </div>
                        <div className="text-xs font-semibold text-warning mt-0.5">
                          {payment.network || "MTN"} • {payment.sender_name || userDisplay}
                        </div>
                      </td>

                      {/* DATE */}
                      <td className="py-4 px-4">
                        <div className="text-xs font-bold text-foreground">
                          {dateInfo.top}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-medium">
                          {dateInfo.bottom}
                        </div>
                      </td>

                      {/* TXN REF */}
                      <td className="py-4 px-4">
                        <span 
                          className="font-mono text-xs font-bold text-foreground tracking-wider"
                          title={payment.transaction_id || payment.reference_code}
                        >
                          {truncateRef(payment.transaction_id || payment.reference_code, 12)}
                        </span>
                      </td>

                      {/* STATUS (Dropdown Trigger) */}
                      <td className="py-4 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="cursor-pointer focus:outline-none transition-transform active:scale-95 group text-left">
                              {payment.status === "pending" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning/15 border border-warning/30 text-warning hover:bg-warning/25 transition-colors">
                                  <Clock className="w-3.5 h-3.5 text-warning" /> Pending
                                </span>
                              )}
                              {payment.status === "approved" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success/15 border border-success/30 text-success hover:bg-success/25 transition-colors">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Approved
                                </span>
                              )}
                              {payment.status === "rejected" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-destructive/15 border border-destructive/30 text-destructive hover:bg-destructive/25 transition-colors">
                                  <XCircle className="w-3.5 h-3.5 text-destructive" /> Rejected
                                </span>
                              )}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="bg-card-elevated border border-border text-foreground min-w-[180px] p-1.5 shadow-xl rounded-xl z-50">
                            <DropdownMenuItem
                              onClick={() => setViewModalPayment(payment)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-section rounded-lg cursor-pointer"
                            >
                              <Eye className="w-4 h-4 text-muted-foreground" /> View Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isProcessing}
                              onClick={() => {
                                if (confirm(`Approve GHS ${payment.amount} for ${userDisplay}? VIP access will activate immediately.`)) {
                                  approveMutation.mutate(payment);
                                }
                              }}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-success hover:bg-success/10 rounded-lg cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4 text-success" /> Approve Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isProcessing}
                              onClick={() => setRejectModalPayment(payment)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                            >
                              <XCircle className="w-4 h-4 text-destructive" /> Reject Payment
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border my-1" />
                            <DropdownMenuItem
                              disabled={isProcessing}
                              onClick={() => setPendingMutation.mutate(payment.id)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-warning hover:bg-warning/10 rounded-lg cursor-pointer"
                            >
                              <Clock className="w-4 h-4 text-warning" /> Mark as Pending
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>

                      {/* ACTIONS (3-Dots Menu) */}
                      <td className="py-4 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-section transition-colors focus:outline-none cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card-elevated border border-border text-foreground min-w-[180px] p-1.5 shadow-xl rounded-xl z-50">
                            <DropdownMenuItem
                              onClick={() => setViewModalPayment(payment)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-section rounded-lg cursor-pointer"
                            >
                              <Eye className="w-4 h-4 text-muted-foreground" /> View Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isProcessing}
                              onClick={() => {
                                if (confirm(`Approve GHS ${payment.amount} for ${userDisplay}? VIP access will activate immediately.`)) {
                                  approveMutation.mutate(payment);
                                }
                              }}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-success hover:bg-success/10 rounded-lg cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4 text-success" /> Approve Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={isProcessing}
                              onClick={() => setRejectModalPayment(payment)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                            >
                              <XCircle className="w-4 h-4 text-destructive" /> Reject Payment
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border my-1" />
                            <DropdownMenuItem
                              disabled={isProcessing}
                              onClick={() => setPendingMutation.mutate(payment.id)}
                              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-warning hover:bg-warning/10 rounded-lg cursor-pointer"
                            >
                              <Clock className="w-4 h-4 text-warning" /> Mark as Pending
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── View Payment Modal ── */}
      {viewModalPayment && (() => {
        const p = viewModalPayment;
        const pkg = vipPackages.find((item: any) => item.id === p.package_id);
        const userProfile = profiles.find((prof: any) => prof.id === p.user_id);
        const userDisplay = p.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "Customer";
        const isProcessing = processingId === p.id;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-foreground space-y-5">
              
              {/* Modal Top */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Payment Details
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    Ref: {p.reference_code}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewModalPayment(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-section transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Header Banner */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-section/60 border border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Current Status:</span>
                  {p.status === "pending" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-warning/15 text-warning border border-warning/30">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}
                  {p.status === "approved" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success/15 text-success border border-success/30">
                      <CheckCircle2 className="w-3 h-3" /> Approved
                    </span>
                  )}
                  {p.status === "rejected" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-destructive/15 text-destructive border border-destructive/30">
                      <XCircle className="w-3 h-3" /> Rejected
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">Amount: </span>
                  <span className="font-black text-sm text-primary">GHS {Number(p.amount || pkg?.price || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Rejection Reason Notice (if rejected) */}
              {p.status === "rejected" && p.rejection_reason && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                  <strong className="block font-bold mb-0.5">Rejection Reason:</strong>
                  {p.rejection_reason}
                </div>
              )}

              {/* Customer & Transaction Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-section/40 border border-border/60 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Customer</span>
                  <p className="font-bold text-foreground">{userDisplay}</p>
                  <p className="font-mono text-[11px] text-muted-foreground truncate">{userProfile?.email || "No email"}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">UID: {p.user_id.substring(0, 12)}...</p>
                </div>

                <div className="p-3 rounded-xl bg-section/40 border border-border/60 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Package</span>
                  <p className="font-bold text-foreground">{pkg?.name || p.package_id}</p>
                  <p className="text-muted-foreground">Odds: {pkg?.combined_odds ? Number(pkg.combined_odds).toFixed(2) : "—"}</p>
                  <p className="text-muted-foreground">Booking Code: {pkg?.booking_code || "None"}</p>
                </div>

                <div className="p-3 rounded-xl bg-section/40 border border-border/60 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Payment Method</span>
                  <p className="font-bold text-warning">{p.network || "Mobile Money"}</p>
                  <p className="text-muted-foreground font-mono">Phone: {p.sender_phone || "—"}</p>
                  <p className="text-foreground">Sender: {p.sender_name}</p>
                </div>

                <div className="p-3 rounded-xl bg-section/40 border border-border/60 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Transaction Data</span>
                  <p className="font-mono text-foreground truncate">TxID: {p.transaction_id || "None"}</p>
                  <p className="font-mono text-primary font-bold">Ref: {p.reference_code}</p>
                  <p className="text-muted-foreground text-[10px]">
                    {new Date(p.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
              </div>

              {/* Screenshot Proof */}
              <div>
                <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider block mb-2">
                  Payment Proof Screenshot
                </span>
                {p.proof_url ? (
                  <div className="relative rounded-xl overflow-hidden border border-border group bg-section/30">
                    <img
                      src={p.proof_url}
                      alt="Payment proof"
                      className="w-full max-h-64 object-contain rounded-xl"
                    />
                    <a
                      href={p.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-3 right-3 bg-background/90 hover:bg-background text-foreground text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-border shadow-md"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Full Resolution
                    </a>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-border bg-section/20 text-center text-muted-foreground text-xs">
                    <ImageIcon className="w-8 h-8 opacity-40 mx-auto mb-1.5" />
                    No screenshot uploaded (User verified via Transaction ID)
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setViewModalPayment(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-section transition-colors cursor-pointer"
                >
                  Close
                </button>

                {p.status !== "approved" && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      if (confirm(`Approve payment for ${userDisplay}? VIP ticket will be activated.`)) {
                        approveMutation.mutate(p);
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                )}

                {p.status !== "rejected" && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      setRejectModalPayment(p);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-destructive hover:opacity-90 text-destructive-foreground flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                )}

                {p.status !== "pending" && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setPendingMutation.mutate(p.id)}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-warning hover:opacity-90 text-black flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    <Clock className="w-3.5 h-3.5" /> Set Pending
                  </button>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {/* ── Reject Reason Modal ── */}
      {rejectModalPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl text-foreground space-y-4">
            <h3 className="text-base font-bold text-foreground">
              Reject Payment Request
            </h3>
            <p className="text-xs text-muted-foreground">
              Provide a reason for rejecting this payment (e.g., funds not received on MoMo statement, incorrect amount).
            </p>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Rejection Reason</label>
              <textarea
                rows={3}
                placeholder="e.g. Payment not received on our statement."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-destructive resize-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectModalPayment(null);
                  setRejectReason("");
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-section transition-colors cursor-pointer"
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
                className="px-4 py-2 text-xs font-bold rounded-lg bg-destructive hover:opacity-90 text-destructive-foreground transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
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
