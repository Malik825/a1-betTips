import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  Search, Check, X, Clock, RefreshCw, CreditCard, 
  Smartphone, AlertCircle, ArrowUpRight, CheckCircle2, 
  XCircle, Filter, ChevronDown, MoreVertical, Eye,
  ExternalLink, Calendar, User, Hash, FileText, Image as ImageIcon,
  RotateCcw, Bell, Copy, Crown
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

function ProofImage({
  url,
  alt = "Payment proof",
  className = "",
  onSignedUrl,
}: {
  url: string;
  alt?: string;
  className?: string;
  onSignedUrl?: (signedUrl: string) => void;
}) {
  const [src, setSrc] = useState(url);

  useEffect(() => {
    setSrc(url);
  }, [url]);

  const handleError = async () => {
    try {
      const parts = url.split("/payment-proofs/");
      const storagePath = parts.length > 1 ? decodeURIComponent(parts[1].split("?")[0]) : url;
      const { data, error } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(storagePath, 7200);
      if (data?.signedUrl && !error) {
        setSrc(data.signedUrl);
        onSignedUrl?.(data.signedUrl);
      }
    } catch (err) {
      console.warn("Could not sign URL for proof:", err);
    }
  };

  return <img src={src} alt={alt} className={className} onError={handleError} />;
}

function AdminPaymentsPage() {
  const { user: currentAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeMainTab, setActiveMainTab] = useState<"payments" | "recovery" | "subscriptions">("payments");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [recoverySearch, setRecoverySearch] = useState("");
  const [recoveryStatusFilter, setRecoveryStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [subSearch, setSubSearch] = useState("");
  const [subStatusFilter, setSubStatusFilter] = useState<"all" | "pending" | "active" | "cancelled" | "expired">("all");
  const [approvingSubId, setApprovingSubId] = useState<string | null>(null);
  const [rejectingSubId, setRejectingSubId] = useState<string | null>(null);
  const [notifyingSubId, setNotifyingSubId] = useState<string | null>(null);
  const [notifyingAll, setNotifyingAll] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModalPayment, setRejectModalPayment] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveModalPayment, setApproveModalPayment] = useState<any | null>(null);
  const [viewModalPayment, setViewModalPayment] = useState<any | null>(null);
  const [approveModalRecovery, setApproveModalRecovery] = useState<any | null>(null);
  const [rejectModalRecovery, setRejectModalRecovery] = useState<any | null>(null);
  const [recoveryRejectReason, setRecoveryRejectReason] = useState("");
  const [viewModalRecovery, setViewModalRecovery] = useState<any | null>(null);
  const [modalProofSrc, setModalProofSrc] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewModalSub, setViewModalSub] = useState<any | null>(null);
  const [approveModalSub, setApproveModalSub] = useState<any | null>(null);
  const [rejectModalSub, setRejectModalSub] = useState<any | null>(null);
  const [subRejectReason, setSubRejectReason] = useState("");

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

  // 5. Fetch recovery requests
  const { data: recoveryRequests = [], isLoading: recoveryLoading } = useQuery({
    queryKey: ["admin_recovery_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recovery_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("Error fetching recovery_requests:", error);
        return [];
      }
      return data || [];
    },
  });

  // 6. Fetch subscriptions
  const { data: allSubscriptions = [], isLoading: subsLoading } = useQuery({
    queryKey: ["admin_subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("Error fetching subscriptions:", error);
        return [];
      }
      return data || [];
    },
  });

  // 7. Fetch subscription plans
  const { data: subscriptionPlans = [] } = useQuery({
    queryKey: ["admin_subscription_plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_plans").select("*");
      if (error) return [];
      return data || [];
    },
  });

  const pendingSubsCount = allSubscriptions.filter((s: any) => s.status === "pending").length;

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

      // 2. Insert into user_tickets OR activate subscription
      if (payment.package_id?.startsWith("sub_")) {
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + 30);

        const { error: subError } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            starts_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
            approved_by: currentAdmin?.id || null,
            updated_at: now.toISOString(),
          })
          .match({ user_id: payment.user_id, status: "pending" });
        if (subError) console.warn("Could not activate subscription:", subError);
      } else {
        const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const fallbackRef = payment.reference_code || payment.transaction_id || `MOMO-${payment.sender_name?.replace(/\s+/g, '_') || payment.id.substring(0, 8)}`;
        const ticketPayload: any = {
          id: ticketId,
          user_id: payment.user_id,
          package_id: payment.package_id,
          payment_ref: fallbackRef,
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
            payment_ref: fallbackRef,
          });
          if (fallbackError) throw fallbackError;
        }
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
      queryClient.invalidateQueries({ queryKey: ["admin_subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["user_subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["all_user_tickets"] });
      queryClient.invalidateQueries({ queryKey: ["user_tickets"] });
      toast.success("Payment approved! Access successfully activated for customer.");
      setProcessingId(null);
      setApproveModalPayment(null);
      if (viewModalPayment) setViewModalPayment(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve payment");
      setProcessingId(null);
      setApproveModalPayment(null);
    },
  });

  // Reject Payment Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      setProcessingId(paymentId);
      const payment = payments.find((p: any) => p.id === paymentId);

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

      if (payment) {
        if (payment.package_id?.startsWith("sub_")) {
          await supabase
            .from("subscriptions")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .match({ user_id: payment.user_id, status: "pending" });

          await supabase
            .from("user_tickets")
            .delete()
            .eq("user_id", payment.user_id)
            .eq("package_id", payment.package_id);
        }

        if (payment.reference_code) {
          await supabase
            .from("user_tickets")
            .delete()
            .eq("payment_ref", payment.reference_code);

          await supabase
            .from("subscriptions")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("payment_ref", payment.reference_code);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin_subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["user_subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["all_user_tickets"] });
      queryClient.invalidateQueries({ queryKey: ["user_tickets"] });
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

  // Approve Recovery Mutation
  const approveRecoveryMutation = useMutation({
    mutationFn: async (req: any) => {
      setProcessingId(req.id);
      const recPkg = vipPackages.find((p: any) => p.id === "recovery");
      const recSels = vipSelections.filter((s: any) => s.package_id === "recovery");

      const snapshot = recSels.map((sel: any) => {
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

      // 1. Insert into user_tickets for this user
      const ticketId = `ticket_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const { error: ticketError } = await supabase.from("user_tickets").insert({
        id: ticketId,
        user_id: req.user_id,
        package_id: "recovery",
        payment_ref: `RECOVERY-${req.id.substring(0, 8)}`,
        booking_code: recPkg?.booking_code || null,
        snapshot: snapshot.length > 0 ? snapshot : null,
        amount_paid: 0,
        purchased_at: new Date().toISOString(),
      });

      if (ticketError) {
        console.warn("Standard user_tickets insert failed for recovery, attempting fallback:", ticketError);
        await supabase.from("user_tickets").insert({
          id: ticketId,
          user_id: req.user_id,
          package_id: "recovery",
          purchased_at: new Date().toISOString(),
        });
      }

      // 2. Update recovery_requests status to approved
      const { error: reqError } = await supabase
        .from("recovery_requests")
        .update({
          status: "approved",
          reviewed_by: currentAdmin?.id || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.id);
      if (reqError) throw reqError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_recovery_requests"] });
      queryClient.invalidateQueries({ queryKey: ["all_user_tickets"] });
      queryClient.invalidateQueries({ queryKey: ["user_tickets"] });
      toast.success("Recovery claim approved! Package opened for user.");
      setApproveModalRecovery(null);
      setProcessingId(null);
      if (viewModalRecovery) setViewModalRecovery(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to approve recovery");
      setProcessingId(null);
    },
  });

  // Reject Recovery Mutation
  const rejectRecoveryMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      setProcessingId(id);
      const { error } = await supabase
        .from("recovery_requests")
        .update({
          status: "rejected",
          rejection_reason: reason || null,
          reviewed_by: currentAdmin?.id || null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_recovery_requests"] });
      toast.success("Recovery request declined.");
      setRejectModalRecovery(null);
      setProcessingId(null);
      if (viewModalRecovery) setViewModalRecovery(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject recovery");
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

  // Recovery Stats
  const totalRecoveryCount = recoveryRequests.length;
  const pendingRecoveryCount = recoveryRequests.filter((r: any) => r.status === "pending").length;
  const approvedRecoveryCount = recoveryRequests.filter((r: any) => r.status === "approved").length;
  const rejectedRecoveryCount = recoveryRequests.filter((r: any) => r.status === "rejected").length;

  // Recovery Filtering
  const filteredRecoveryRequests = recoveryRequests.filter((r: any) => {
    if (recoveryStatusFilter !== "all" && r.status !== recoveryStatusFilter) return false;
    if (!recoverySearch.trim()) return true;

    const term = recoverySearch.toLowerCase();
    const pkg = vipPackages.find((pkgItem: any) => pkgItem.id === r.original_package_id);
    const userProfile = profiles.find((prof: any) => prof.id === r.user_id);

    return (
      (r.sender_phone || "").toLowerCase().includes(term) ||
      (r.sender_name || "").toLowerCase().includes(term) ||
      (pkg?.name || "").toLowerCase().includes(term) ||
      (userProfile?.email || "").toLowerCase().includes(term) ||
      (userProfile?.username || "").toLowerCase().includes(term)
    );
  });

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
            Direct Payments & Recovery Control
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review incoming mobile transfers, inspect payment & recovery proof screenshots, and manage VIP customer activations.
          </p>
        </div>

        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] });
            queryClient.invalidateQueries({ queryKey: ["admin_recovery_requests"] });
          }}
          className="flex items-center gap-2 text-xs py-2 px-3.5 rounded-lg border border-border bg-card text-foreground hover:bg-section transition-colors cursor-pointer"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveMainTab("payments")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer border-none ${
            activeMainTab === "payments"
              ? "bg-foreground text-background shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card bg-transparent"
          }`}
        >
          <span>VIP Payments</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-warning text-black font-extrabold">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("recovery")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer border-none ${
            activeMainTab === "recovery"
              ? "bg-foreground text-background shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card bg-transparent"
          }`}
        >
          <RotateCcw size={13} />
          <span>Recovery Claims</span>
          {pendingRecoveryCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500 text-black font-extrabold animate-pulse">
              {pendingRecoveryCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("subscriptions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer border-none ${
            activeMainTab === "subscriptions"
              ? "bg-foreground text-background shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card bg-transparent"
          }`}
        >
          <span>Subscriptions</span>
          {pendingSubsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500 text-white font-extrabold animate-pulse">
              {pendingSubsCount}
            </span>
          )}
        </button>
      </div>

      {activeMainTab === "payments" && (
        <>
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
              GH₵ {totalApprovedAmount.toFixed(0)}
            </h3>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              ≈ ₦{Math.ceil(totalApprovedAmount * 115).toLocaleString()}
            </p>
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

                  {/* Middle row: amount + date + proof */}
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Amount</span>
                      <span className="font-black text-foreground">GH₵ {Number(payment.amount || pkg?.price || 0).toFixed(0)}</span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                        ≈ ₦{Math.ceil(Number(payment.amount || pkg?.price || 0) * 115).toLocaleString()}
                      </span>
                      <span className="text-warning font-semibold text-[11px]">{payment.network || "MTN"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Date</span>
                      <span className="font-bold text-foreground">{dateInfo.top}</span>
                      <span className="text-muted-foreground ml-1">{dateInfo.bottom}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Proof</span>
                      {payment.proof_url ? (
                        <button
                          type="button"
                          onClick={() => {
                            setModalProofSrc(payment.proof_url);
                            setViewModalPayment(payment);
                          }}
                          className="flex items-center gap-1.5 font-bold text-primary text-[11px] mt-0.5 hover:underline cursor-pointer"
                        >
                          <ProofImage
                            url={payment.proof_url}
                            alt="Proof"
                            className="w-7 h-7 object-cover rounded border border-border"
                          />
                          <span>View</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">None</span>
                      )}
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
                        onClick={() => setApproveModalPayment(payment)}
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
                <th className="py-3.5 px-4">PROOF</th>
                <th className="py-3.5 px-4">DATE</th>
                <th className="py-3.5 px-4">TXN REF</th>
                <th className="py-3.5 px-4">STATUS</th>
                <th className="py-3.5 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paymentsLoading ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-16 text-sm">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                    Loading payments...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-16 text-sm">
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
                          GH₵ {Number(payment.amount || pkg?.price || 0).toFixed(0)}
                        </div>
                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          ≈ ₦{Math.ceil(Number(payment.amount || pkg?.price || 0) * 115).toLocaleString()}
                        </div>
                        <div className="text-xs font-semibold text-warning mt-0.5">
                          {payment.network || "MTN"} • {payment.sender_name || userDisplay}
                        </div>
                      </td>

                      {/* PROOF */}
                      <td className="py-4 px-4">
                        {payment.proof_url ? (
                          <button
                            type="button"
                            onClick={() => {
                              setModalProofSrc(payment.proof_url);
                              setViewModalPayment(payment);
                            }}
                            className="flex items-center gap-2 group cursor-pointer focus:outline-none"
                            title="Click to view full payment screenshot"
                          >
                            <ProofImage
                              url={payment.proof_url}
                              alt="Proof"
                              className="w-9 h-9 object-cover rounded-lg border border-border group-hover:border-primary group-hover:scale-105 transition-all shadow-sm"
                            />
                            <span className="text-xs font-semibold text-primary group-hover:underline flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5" /> View
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 opacity-50" /> No proof
                          </span>
                        )}
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
                              onClick={() => setApproveModalPayment(payment)}
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
                              onClick={() => setApproveModalPayment(payment)}
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
    </>
  )}

  {/* ───────────────────────────────────────────────────────────── 
      RECOVERY CLAIMS VIEW
  ───────────────────────────────────────────────────────────── */}
  {activeMainTab === "recovery" && (
    <>
      {/* Recovery Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Recovery Card */}
        <div 
          onClick={() => setRecoveryStatusFilter("pending")}
          className={`cursor-pointer bg-card p-4 rounded-xl border transition-all flex items-center justify-between ${
            recoveryStatusFilter === "pending"
              ? "border-warning shadow-md shadow-warning/10 ring-2 ring-warning/30"
              : "border-border hover:border-border/80"
          }`}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Pending Review
            </p>
            <h3 className="text-2xl font-black text-warning mt-1">
              {pendingRecoveryCount}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
            <Clock size={18} />
          </div>
        </div>

        {/* Approved Recovery Card */}
        <div 
          onClick={() => setRecoveryStatusFilter("approved")}
          className={`cursor-pointer bg-card p-4 rounded-xl border transition-all flex items-center justify-between ${
            recoveryStatusFilter === "approved"
              ? "border-success shadow-md shadow-success/10 ring-2 ring-success/30"
              : "border-border hover:border-border/80"
          }`}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Approved & Opened
            </p>
            <h3 className="text-2xl font-black text-success mt-1">
              {approvedRecoveryCount}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>

        {/* Rejected Recovery Card */}
        <div 
          onClick={() => setRecoveryStatusFilter("rejected")}
          className={`cursor-pointer bg-card p-4 rounded-xl border transition-all flex items-center justify-between ${
            recoveryStatusFilter === "rejected"
              ? "border-destructive shadow-md shadow-destructive/10 ring-2 ring-destructive/30"
              : "border-border hover:border-border/80"
          }`}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Declined Claims
            </p>
            <h3 className="text-2xl font-black text-destructive mt-1">
              {rejectedRecoveryCount}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
            <XCircle size={18} />
          </div>
        </div>

        {/* Total Claims Card */}
        <div 
          onClick={() => setRecoveryStatusFilter("all")}
          className={`cursor-pointer bg-card p-4 rounded-xl border transition-all flex items-center justify-between ${
            recoveryStatusFilter === "all"
              ? "border-primary shadow-md shadow-primary/10 ring-2 ring-primary/30"
              : "border-border hover:border-border/80"
          }`}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Claims
            </p>
            <h3 className="text-2xl font-black text-foreground mt-1">
              {totalRecoveryCount}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <RotateCcw size={18} />
          </div>
        </div>
      </div>

      {/* Recovery Filter Tabs & Search */}
      <div className="bg-card p-3 rounded-xl border border-border flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(["pending", "approved", "rejected", "all"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setRecoveryStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap capitalize ${
                recoveryStatusFilter === tab
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-section"
              }`}
            >
              {tab === "all" ? "All Claims" : tab}
              <span className="ml-1.5 opacity-70">
                ({tab === "pending" ? pendingRecoveryCount : tab === "approved" ? approvedRecoveryCount : tab === "rejected" ? rejectedRecoveryCount : totalRecoveryCount})
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by customer, phone, package..."
            value={recoverySearch}
            onChange={(e) => setRecoverySearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Recovery Claims Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-section/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Spoilt VIP Game</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Proof Screenshot</th>
                <th className="py-3 px-4">Claim Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRecoveryRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <RotateCcw className="w-8 h-8 opacity-40 mx-auto mb-2" />
                    <p className="font-semibold text-xs">No recovery claims found</p>
                  </td>
                </tr>
              ) : (
                filteredRecoveryRequests.map((req: any) => {
                  const userProfile = profiles.find((prof: any) => prof.id === req.user_id);
                  const userDisplay = req.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "User";
                  const origPkg = vipPackages.find((p: any) => p.id === req.original_package_id);
                  const isProcessing = processingId === req.id;

                  return (
                    <tr key={req.id} className="hover:bg-section/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-foreground block">{userDisplay}</span>
                        <span className="text-[11px] text-muted-foreground font-mono block">{userProfile?.email || "No email"}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-foreground">
                        {origPkg?.name || req.original_package_id}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-muted-foreground">
                        {req.sender_phone || "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        {req.proof_url ? (
                          <button
                            type="button"
                            onClick={() => setViewModalRecovery(req)}
                            className="group flex items-center gap-2 p-1 rounded-lg border border-border hover:border-primary/50 bg-section/30 transition-all cursor-pointer"
                          >
                            <ProofImage
                              url={req.proof_url}
                              alt="Recovery proof"
                              className="w-8 h-8 object-cover rounded shrink-0"
                            />
                            <span className="text-[11px] font-semibold text-primary group-hover:underline flex items-center gap-1">
                              <Eye size={12} /> View Slip
                            </span>
                          </button>
                        ) : (
                          <span className="text-muted-foreground italic">No image</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {new Date(req.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-3.5 px-4">
                        {req.status === "pending" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-warning/15 text-warning border border-warning/30">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                        {req.status === "approved" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-success/15 text-success border border-success/30">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        )}
                        {req.status === "rejected" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-destructive/15 text-destructive border border-destructive/30">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {req.status === "pending" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => setApproveModalRecovery(req)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => setRejectModalRecovery(req)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-destructive hover:opacity-90 text-destructive-foreground flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setViewModalRecovery(req)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-section transition-colors cursor-pointer"
                          >
                            View Details
                          </button>
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
    </>
  )}

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
                    {p.reference_code ? `Ref: ${p.reference_code}` : `Sender: ${p.sender_name || userDisplay}`}
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
                  <span className="text-xs text-muted-foreground block">Amount</span>
                  <span className="font-black text-sm text-primary">GH₵ {Number(p.amount || pkg?.price || 0).toFixed(2)}</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                    ≈ ₦{Math.ceil(Number(p.amount || pkg?.price || 0) * 115).toLocaleString()}
                  </span>
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
                  <p className="font-semibold text-foreground">Sender: {p.sender_name || userDisplay}</p>
                  {p.sender_phone && <p className="text-muted-foreground font-mono">Phone: {p.sender_phone}</p>}
                </div>

                <div className="p-3 rounded-xl bg-section/40 border border-border/60 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Transaction Data</span>
                  {p.transaction_id && <p className="font-mono text-foreground truncate">TxID: {p.transaction_id}</p>}
                  {p.reference_code && <p className="font-mono text-primary font-bold">Ref: {p.reference_code}</p>}
                  <p className="text-muted-foreground text-[10px]">
                    {new Date(p.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
              </div>

              {/* Screenshot Proof */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider block">
                    Payment Proof Screenshot
                  </span>
                  {p.proof_url && (
                    <a
                      href={modalProofSrc || p.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Full Resolution
                    </a>
                  )}
                </div>
                {p.proof_url ? (
                  <div className="relative rounded-xl overflow-hidden border border-border group bg-section/30 p-2">
                    <a href={modalProofSrc || p.proof_url} target="_blank" rel="noopener noreferrer" className="block cursor-zoom-in">
                      <ProofImage
                        url={p.proof_url}
                        alt="Payment proof"
                        className="w-full max-h-72 object-contain rounded-lg hover:opacity-95 transition-opacity"
                        onSignedUrl={(signed) => setModalProofSrc(signed)}
                      />
                    </a>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-border bg-section/20 text-center text-muted-foreground text-xs">
                    <ImageIcon className="w-8 h-8 opacity-40 mx-auto mb-1.5" />
                    No screenshot uploaded
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
                    onClick={() => setApproveModalPayment(p)}
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

      {/* ── Approve Payment Modal ── */}
      {approveModalPayment && (() => {
        const p = approveModalPayment;
        const pkg = vipPackages.find((item: any) => item.id === p.package_id);
        const userProfile = profiles.find((prof: any) => prof.id === p.user_id);
        const userDisplay = p.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "Customer";
        const isProcessing = processingId === p.id;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl text-foreground space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Approve VIP Payment
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Activate VIP access immediately for this customer.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-section/50 border border-border/70 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-bold text-foreground">{userDisplay}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Package</span>
                  <span className="font-bold text-foreground">{pkg?.name || p.package_id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Amount</span>
                  <div className="text-right">
                    <span className="font-black text-success block">GH₵ {Number(p.amount || pkg?.price || 0).toFixed(2)}</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                      ≈ ₦{Math.ceil(Number(p.amount || pkg?.price || 0) * 115).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Network / Method</span>
                  <span className="font-semibold text-warning">{p.network || "Mobile Money"}</span>
                </div>
                {p.proof_url && (
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                    <span className="text-muted-foreground">Proof Screenshot</span>
                    <a
                      href={modalProofSrc || p.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Inspect Image
                    </a>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setApproveModalPayment(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-section transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => approveMutation.mutate(p)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-success hover:bg-success/90 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isProcessing ? "Activating VIP..." : "Confirm & Activate"}
                </button>
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

      {/* ── Approve Recovery Modal ── */}
      {approveModalRecovery && (() => {
        const req = approveModalRecovery;
        const origPkg = vipPackages.find((p: any) => p.id === req.original_package_id);
        const userProfile = profiles.find((prof: any) => prof.id === req.user_id);
        const userDisplay = req.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "Customer";
        const isProcessing = processingId === req.id;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl text-foreground space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Approve Recovery Claim
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Unlock the recovery VIP package immediately for this customer.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-section/50 border border-border/70 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-bold text-foreground">{userDisplay}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Spoilt Package</span>
                  <span className="font-bold text-destructive">{origPkg?.name || req.original_package_id}</span>
                </div>
                {req.sender_phone && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Sender Phone</span>
                    <span className="font-mono font-semibold text-foreground">{req.sender_phone}</span>
                  </div>
                )}
                {req.proof_url && (
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                    <span className="text-muted-foreground">Proof Image</span>
                    <a
                      href={req.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> View Screenshot
                    </a>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Confirming will issue a free Recovery ticket to this user. The recovery package booking code and tips will open for them automatically.
              </p>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setApproveModalRecovery(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-section transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => approveRecoveryMutation.mutate(req)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isProcessing ? "Unlocking Recovery..." : "Confirm & Unlock Package"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Reject Recovery Modal ── */}
      {rejectModalRecovery && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl text-foreground space-y-4">
            <h3 className="text-base font-bold text-foreground">
              Reject Recovery Claim
            </h3>
            <p className="text-xs text-muted-foreground">
              Provide a reason for rejecting this recovery claim (e.g. invalid slip, ticket already claimed, payment not found).
            </p>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">Rejection Reason</label>
              <textarea
                rows={3}
                placeholder="e.g. Invalid slip or previous game does not match records."
                value={recoveryRejectReason}
                onChange={(e) => setRecoveryRejectReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-destructive resize-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectModalRecovery(null);
                  setRecoveryRejectReason("");
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-section transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectRecoveryMutation.isPending}
                onClick={() => {
                  rejectRecoveryMutation.mutate({
                    id: rejectModalRecovery.id,
                    reason: recoveryRejectReason,
                  });
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-destructive hover:opacity-90 text-destructive-foreground transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {rejectRecoveryMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Recovery Modal ── */}
      {viewModalRecovery && (() => {
        const req = viewModalRecovery;
        const origPkg = vipPackages.find((p: any) => p.id === req.original_package_id);
        const userProfile = profiles.find((prof: any) => prof.id === req.user_id);
        const userDisplay = req.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "Customer";

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-foreground space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-emerald-500" />
                  Recovery Claim Details
                </h3>
                <button
                  type="button"
                  onClick={() => setViewModalRecovery(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-section transition-colors cursor-pointer border-none bg-transparent"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-section/40 border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Customer</span>
                  <p className="font-bold text-foreground m-0">{userDisplay}</p>
                  <p className="font-mono text-[11px] text-muted-foreground truncate m-0">{userProfile?.email || "No email"}</p>
                </div>
                <div className="p-3 rounded-xl bg-section/40 border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Spoilt Package</span>
                  <p className="font-bold text-foreground m-0">{origPkg?.name || req.original_package_id}</p>
                  <p className="font-mono text-[11px] text-muted-foreground m-0">{req.sender_phone ? `Phone: ${req.sender_phone}` : `Ticket: ${req.ticket_id?.slice(0, 8)}...`}</p>
                </div>
              </div>

              {req.proof_url && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground">Proof Screenshot</span>
                    <a
                      href={req.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Full Resolution
                    </a>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-border bg-section/30 p-2">
                    <ProofImage
                      url={req.proof_url}
                      alt="Recovery proof"
                      className="w-full max-h-72 object-contain rounded-lg"
                    />
                  </div>
                </div>
              )}

              {req.status === "rejected" && req.rejection_reason && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                  <strong className="block font-bold mb-0.5">Rejection Reason:</strong>
                  {req.rejection_reason}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setViewModalRecovery(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-section transition-colors cursor-pointer"
                >
                  Close
                </button>
                {req.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setViewModalRecovery(null);
                        setRejectModalRecovery(req);
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-destructive hover:opacity-90 text-destructive-foreground transition-colors cursor-pointer shadow-sm"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewModalRecovery(null);
                        setApproveModalRecovery(req);
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-sm"
                    >
                      Approve & Open Package
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── SUBSCRIPTIONS TAB ──────────────────────────────────────────── */}
      {activeMainTab === "subscriptions" && (() => {
        const SUB_TYPE_LABELS: Record<string, string> = {
          all_access: "All-Access VIP Master Pass",
          supreme_vvip: "Supreme VVIP Monthly 👑",
          supreme: "Supreme VVIP Monthly 👑",
          vvip_combo: "VVIP Combo (VVIP 1 & 2)",
          vip_combo: "VIP Combo (VIP 1 & 2)",
          vip_1: "VIP 1 Monthly Pass",
          vip_2: "VIP 2 Monthly Pass",
          vvip_1: "VVIP 1 Monthly Pass",
          vvip_2: "VVIP 2 Monthly Pass",
          silver: "Silver VIP",
          gold: "Gold VIP",
          platinum: "Platinum VIP",
          vip1: "VIP 1 Monthly Pass",
          vip2: "VIP 2 Monthly Pass",
          vip3: "VIP 3 Monthly Pass",
        };

        // Stats calculations
        const totalSubs = allSubscriptions.length;
        const pendingSubs = allSubscriptions.filter((s: any) => s.status === "pending").length;
        const activeSubs = allSubscriptions.filter((s: any) => s.status === "active").length;
        const cancelledSubs = allSubscriptions.filter((s: any) => s.status === "cancelled" || s.status === "rejected").length;
        const totalSubsRevenue = allSubscriptions
          .filter((s: any) => s.status === "active")
          .reduce((sum: number, s: any) => sum + Number(s.amount_paid || 0), 0);

        const filteredSubs = allSubscriptions
          .filter((s: any) => subStatusFilter === "all" || s.status === subStatusFilter)
          .filter((s: any) => {
            if (!subSearch.trim()) return true;
            const profile = profiles.find((p: any) => p.id === s.user_id);
            const linkedPayment = payments.find((p: any) =>
              (p.reference_code && p.reference_code === s.payment_ref) ||
              (p.user_id === s.user_id && p.package_id?.includes(s.subscription_type))
            );
            const needle = subSearch.toLowerCase();
            return (
              (profile?.email || "").toLowerCase().includes(needle) ||
              (profile?.username || "").toLowerCase().includes(needle) ||
              (linkedPayment?.sender_name || "").toLowerCase().includes(needle) ||
              (linkedPayment?.sender_phone || "").toLowerCase().includes(needle) ||
              (s.subscription_type || "").toLowerCase().includes(needle) ||
              (SUB_TYPE_LABELS[s.subscription_type] || "").toLowerCase().includes(needle) ||
              (s.payment_ref || "").toLowerCase().includes(needle)
            );
          });

        const approveSubscription = async (sub: any) => {
          setApprovingSubId(sub.id);
          try {
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + 30);
            const { error } = await supabase
              .from("subscriptions")
              .update({
                status: "active",
                starts_at: now.toISOString(),
                expires_at: expiresAt.toISOString(),
                approved_by: currentAdmin?.id || null,
                updated_at: now.toISOString(),
              })
              .eq("id", sub.id);
            if (error) throw error;

            if (sub.payment_ref) {
              await supabase
                .from("manual_payments")
                .update({
                  status: "approved",
                  reviewed_by: currentAdmin?.id || null,
                  reviewed_at: now.toISOString(),
                  updated_at: now.toISOString(),
                })
                .eq("reference_code", sub.payment_ref);
            }

            // Send in-app notification
            await supabase.from("app_notifications").insert({
              user_id: sub.user_id,
              type: "subscription_active",
              title: "🎉 Subscription Activated!",
              body: `Your ${SUB_TYPE_LABELS[sub.subscription_type] || sub.subscription_type} is now active and expires on ${expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`,
              is_read: false,
            });

            queryClient.invalidateQueries({ queryKey: ["admin_subscriptions"] });
            queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] });
            queryClient.invalidateQueries({ queryKey: ["user_subscriptions"] });
            toast.success("Subscription activated — 30 days access granted!");
            setApproveModalSub(null);
          } catch (err: any) {
            toast.error(err.message || "Failed to approve subscription");
          } finally {
            setApprovingSubId(null);
          }
        };

        const rejectSubscription = async (subId: string, reason?: string) => {
          setRejectingSubId(subId);
          try {
            const sub = allSubscriptions.find((s: any) => s.id === subId);
            const rejectionReason = reason || subRejectReason || "Subscription request rejected by administrator.";
            const { error } = await supabase
              .from("subscriptions")
              .update({ status: "cancelled", updated_at: new Date().toISOString() })
              .eq("id", subId);
            if (error) throw error;

            if (sub?.payment_ref) {
              await supabase
                .from("manual_payments")
                .update({
                  status: "rejected",
                  rejection_reason: rejectionReason,
                  reviewed_by: currentAdmin?.id || null,
                  reviewed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("reference_code", sub.payment_ref);
            }

            if (sub) {
              await supabase
                .from("user_tickets")
                .delete()
                .eq("user_id", sub.user_id)
                .like("package_id", "sub_%");
            }

            // Notify user
            if (sub?.user_id) {
              await supabase.from("app_notifications").insert({
                user_id: sub.user_id,
                type: "subscription_rejected",
                title: "⚠️ Subscription Request Rejected",
                body: `Your request for ${SUB_TYPE_LABELS[sub.subscription_type] || sub.subscription_type} was rejected: ${rejectionReason}`,
                is_read: false,
              });
            }

            queryClient.invalidateQueries({ queryKey: ["admin_subscriptions"] });
            queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] });
            queryClient.invalidateQueries({ queryKey: ["user_subscriptions"] });
            queryClient.invalidateQueries({ queryKey: ["user_tickets"] });
            queryClient.invalidateQueries({ queryKey: ["all_user_tickets"] });
            toast.success("Subscription request rejected.");
            setRejectModalSub(null);
            setSubRejectReason("");
          } catch (err: any) {
            toast.error(err.message || "Failed to reject subscription");
          } finally {
            setRejectingSubId(null);
          }
        };

        const resetSubPending = async (subId: string) => {
          try {
            const sub = allSubscriptions.find((s: any) => s.id === subId);
            await supabase
              .from("subscriptions")
              .update({ status: "pending", updated_at: new Date().toISOString() })
              .eq("id", subId);

            if (sub?.payment_ref) {
              await supabase
                .from("manual_payments")
                .update({ status: "pending", rejection_reason: null, updated_at: new Date().toISOString() })
                .eq("reference_code", sub.payment_ref);
            }

            queryClient.invalidateQueries({ queryKey: ["admin_subscriptions"] });
            queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] });
            queryClient.invalidateQueries({ queryKey: ["user_subscriptions"] });
            toast.success("Subscription reset to pending.");
          } catch (err: any) {
            toast.error(err.message || "Failed to reset subscription");
          }
        };

        const notifyUserProof = async (sub: any) => {
          setNotifyingSubId(sub.id);
          try {
            const planName = SUB_TYPE_LABELS[sub.subscription_type] || sub.subscription_type;
            const { error } = await supabase.from("app_notifications").insert({
              user_id: sub.user_id,
              type: "subscription_proof_required",
              title: "📸 Payment Proof Screenshot Required",
              body: `Please upload your payment screenshot for ${planName} on your dashboard so our team can verify and activate your 30-day VIP pass.`,
              is_read: false,
            });
            if (error) throw error;
            toast.success("Notification sent! User prompted to upload payment proof.");
          } catch (err: any) {
            toast.error(err.message || "Failed to send notification.");
          } finally {
            setNotifyingSubId(null);
          }
        };

        const notifyAllMissingProof = async () => {
          const targetSubs = allSubscriptions.filter(
            (s: any) => (!s.proof_url || s.status === "cancelled" || s.status === "pending")
          );
          if (targetSubs.length === 0) {
            toast.info("No subscriptions currently missing proof.");
            return;
          }

          setNotifyingAll(true);
          try {
            const notifications = targetSubs.map((sub: any) => ({
              user_id: sub.user_id,
              type: "subscription_proof_required",
              title: "📸 Payment Proof Screenshot Required",
              body: `Please upload your payment screenshot for ${SUB_TYPE_LABELS[sub.subscription_type] || sub.subscription_type} on your dashboard so our team can verify and activate your 30-day VIP pass.`,
              is_read: false,
            }));

            const { error } = await supabase.from("app_notifications").insert(notifications);
            if (error) throw error;
            toast.success(`Notifications sent to ${targetSubs.length} user(s) to upload payment proof!`);
          } catch (err: any) {
            toast.error(err.message || "Failed to broadcast notifications.");
          } finally {
            setNotifyingAll(false);
          }
        };

        return (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* ── Subscriptions Stats Cards (Inferred from VIP payments) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Pending Card */}
              <div 
                onClick={() => setSubStatusFilter("pending")}
                className={`cursor-pointer bg-card p-4 rounded-xl border transition-all flex items-center justify-between ${
                  subStatusFilter === "pending"
                    ? "border-warning shadow-md shadow-warning/10 ring-2 ring-warning/30"
                    : "border-border hover:border-border/80"
                }`}
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Pending Review
                  </p>
                  <h3 className="text-2xl font-black text-warning mt-1">
                    {pendingSubs}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
                  <Clock size={18} />
                </div>
              </div>

              {/* Active Card */}
              <div 
                onClick={() => setSubStatusFilter("active")}
                className={`cursor-pointer bg-card p-4 rounded-xl border transition-all flex items-center justify-between ${
                  subStatusFilter === "active"
                    ? "border-success shadow-md shadow-success/10 ring-2 ring-success/30"
                    : "border-border hover:border-border/80"
                }`}
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Active Passes
                  </p>
                  <h3 className="text-2xl font-black text-success mt-1">
                    {activeSubs}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
              </div>

              {/* Verified Sub Revenue */}
              <div className="bg-card p-4 rounded-xl border border-border flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Verified Revenue
                  </p>
                  <h3 className="text-2xl font-black text-foreground mt-1">
                    GH₵ {totalSubsRevenue.toFixed(0)}
                  </h3>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    ≈ ₦{Math.ceil(totalSubsRevenue * 115).toLocaleString()}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <CreditCard size={18} />
                </div>
              </div>

              {/* Cancelled / Expired Card */}
              <div 
                onClick={() => setSubStatusFilter("cancelled")}
                className={`cursor-pointer bg-card p-4 rounded-xl border transition-all flex items-center justify-between ${
                  subStatusFilter === "cancelled"
                    ? "border-destructive shadow-md shadow-destructive/10 ring-2 ring-destructive/30"
                    : "border-border hover:border-border/80"
                }`}
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Cancelled / Expired
                  </p>
                  <h3 className="text-2xl font-black text-destructive mt-1">
                    {cancelledSubs}
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
                  <XCircle size={18} />
                </div>
              </div>
            </div>

            {/* ── Subscriptions Filter Bar ── */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by customer, email, plan, ref, phone..."
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-card text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              {(["all", "pending", "active", "cancelled", "expired"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSubStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer capitalize ${
                    subStatusFilter === s
                      ? "bg-foreground text-background border-foreground shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "all"
                    ? `All (${allSubscriptions.length})`
                    : `${s} (${allSubscriptions.filter((x: any) => x.status === s).length})`}
                </button>
              ))}

              <button
                type="button"
                onClick={notifyAllMissingProof}
                disabled={notifyingAll || allSubscriptions.length === 0}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black border border-amber-400 transition-all cursor-pointer disabled:opacity-60 flex items-center gap-1.5 shadow-sm ml-auto"
              >
                <Bell className="w-3.5 h-3.5" />
                {notifyingAll ? "Notifying Users..." : "Notify Missing Proof"}
              </button>
            </div>

            {/* ── Subscriptions Content (Mobile Cards & Desktop Table) ── */}
            {subsLoading ? (
              <div className="text-center py-16 text-muted-foreground text-sm border border-border rounded-xl bg-card">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                Loading subscriptions...
              </div>
            ) : filteredSubs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm border border-border rounded-xl bg-card">
                No subscription records found matching your filter.
              </div>
            ) : (
              <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
                {/* ── Mobile Cards (hidden on sm screens) ── */}
                <div className="sm:hidden divide-y divide-border">
                  {filteredSubs.map((sub: any) => {
                    const profile = profiles.find((p: any) => p.id === sub.user_id);
                    const linkedPayment = payments.find((p: any) =>
                      (p.reference_code && p.reference_code === sub.payment_ref) ||
                      (p.user_id === sub.user_id && p.package_id?.includes(sub.subscription_type))
                    );
                    const plan = subscriptionPlans.find((pl: any) => pl.id === `sub_${sub.subscription_type}` || pl.id === sub.subscription_type);
                    const planName = plan?.name || SUB_TYPE_LABELS[sub.subscription_type] || sub.subscription_type;
                    const userDisplay = linkedPayment?.sender_name || profile?.username || profile?.email?.split("@")[0] || "Subscriber";
                    const userEmail = profile?.email || `ID: ${sub.user_id.slice(0, 8)}...`;
                    const amount = Number(sub.amount_paid || linkedPayment?.amount || plan?.price || 0);
                    const proofUrl = sub.proof_url || linkedPayment?.proof_url;
                    const isProcessing = approvingSubId === sub.id || rejectingSubId === sub.id;
                    const dateInfo = formatPaymentDate(sub.created_at);
                    const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date();
                    const expiresDate = sub.expires_at
                      ? new Date(sub.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
                      : null;
                    const txnRef = sub.payment_ref || linkedPayment?.reference_code || "—";

                    return (
                      <div key={sub.id} className="p-4 space-y-3">
                        {/* Top row: user info + status badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-foreground truncate block">{userDisplay}</span>
                            <span className="text-xs text-muted-foreground truncate block">{userEmail}</span>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                              👑 {planName}
                            </span>
                          </div>
                          <div>
                            {sub.status === "pending" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-warning/15 border border-warning/30 text-warning">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            )}
                            {sub.status === "active" && !isExpired && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success/15 border border-success/30 text-success">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </span>
                            )}
                            {sub.status === "active" && isExpired && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted border border-border text-muted-foreground">
                                <Clock className="w-3 h-3" /> Expired
                              </span>
                            )}
                            {(sub.status === "cancelled" || sub.status === "rejected") && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 border border-destructive/30 text-destructive">
                                <XCircle className="w-3 h-3" /> Cancelled
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle row: amount + dates + proof */}
                        <div className="flex items-center justify-between gap-3 text-xs pt-1 border-t border-border/60">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Amount</span>
                            <span className="font-black text-foreground">GH₵ {amount.toFixed(0)}</span>
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                              ≈ ₦{Math.ceil(amount * 115).toLocaleString()}
                            </span>
                            <span className="text-warning font-semibold text-[11px]">{linkedPayment?.network || "Mobile Money"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Created / Expires</span>
                            <span className="font-bold text-foreground">{dateInfo.top}</span>
                            <span className="text-muted-foreground ml-1">{dateInfo.bottom}</span>
                            <span className="text-[11px] text-muted-foreground block">
                              {expiresDate ? `Exp: ${expiresDate}` : "30 days"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Proof</span>
                            {proofUrl ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setModalProofSrc(proofUrl);
                                  setViewModalSub(sub);
                                }}
                                className="flex items-center gap-1.5 font-bold text-primary text-[11px] mt-0.5 hover:underline cursor-pointer"
                              >
                                <ProofImage
                                  url={proofUrl}
                                  alt="Proof"
                                  className="w-7 h-7 object-cover rounded border border-border"
                                />
                                <span>View</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">None</span>
                            )}
                          </div>
                        </div>

                        {/* Txn reference */}
                        <div className="text-xs flex items-center justify-between bg-section/40 p-2 rounded-lg">
                          <span className="text-muted-foreground text-[11px]">Ref:</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(txnRef);
                              toast.success("Reference copied!");
                            }}
                            className="font-mono font-bold text-[11px] text-foreground flex items-center gap-1 hover:text-primary"
                          >
                            <span>{txnRef}</span>
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setViewModalSub(sub)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-section transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" /> View
                          </button>
                          {sub.status !== "active" && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => setApproveModalSub(sub)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-success/15 border border-success/30 text-xs font-bold text-success hover:bg-success/25 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}
                          {sub.status !== "cancelled" && sub.status !== "rejected" && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => setRejectModalSub(sub)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-destructive/15 border border-destructive/30 text-xs font-bold text-destructive hover:bg-destructive/25 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ── Desktop Table (Inferred from VIP payments table structure) ── */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border bg-section/70 text-[11px] font-bold tracking-wider text-muted-foreground uppercase select-none">
                        <th className="py-3.5 px-4">USER</th>
                        <th className="py-3.5 px-4">PLAN & AMOUNT</th>
                        <th className="py-3.5 px-4">PROOF</th>
                        <th className="py-3.5 px-4">DATE & VALIDITY</th>
                        <th className="py-3.5 px-4">TXN REF</th>
                        <th className="py-3.5 px-4">STATUS</th>
                        <th className="py-3.5 px-4 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredSubs.map((sub: any) => {
                        const profile = profiles.find((p: any) => p.id === sub.user_id);
                        const linkedPayment = payments.find((p: any) =>
                          (p.reference_code && p.reference_code === sub.payment_ref) ||
                          (p.user_id === sub.user_id && p.package_id?.includes(sub.subscription_type))
                        );
                        const plan = subscriptionPlans.find((pl: any) => pl.id === `sub_${sub.subscription_type}` || pl.id === sub.subscription_type);
                        const planName = plan?.name || SUB_TYPE_LABELS[sub.subscription_type] || sub.subscription_type;
                        const userDisplay = linkedPayment?.sender_name || profile?.username || profile?.email?.split("@")[0] || "Subscriber";
                        const userEmail = profile?.email || `ID: ${sub.user_id.slice(0, 8)}...`;
                        const amount = Number(sub.amount_paid || linkedPayment?.amount || plan?.price || 0);
                        const proofUrl = sub.proof_url || linkedPayment?.proof_url;
                        const isProcessing = approvingSubId === sub.id || rejectingSubId === sub.id;
                        const dateInfo = formatPaymentDate(sub.created_at);
                        const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date();
                        const expiresDate = sub.expires_at
                          ? new Date(sub.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
                          : null;
                        const txnRef = sub.payment_ref || linkedPayment?.reference_code || "—";

                        return (
                          <tr key={sub.id} className="hover:bg-section/40 transition-colors">
                            {/* USER */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                  {userDisplay.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-xs text-foreground truncate max-w-[170px]">
                                    {userDisplay}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground truncate max-w-[170px]">
                                    {userEmail}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground/70 font-mono">
                                    ID: {sub.user_id.slice(0, 8)}...
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* PLAN & AMOUNT */}
                            <td className="py-4 px-4">
                              <div className="space-y-0.5">
                                <div className="font-extrabold text-xs text-foreground">
                                  GH₵ {amount.toFixed(0)}
                                </div>
                                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  ≈ ₦{Math.ceil(amount * 115).toLocaleString()}
                                </div>
                                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  👑 {planName}
                                </div>
                                {linkedPayment?.network && (
                                  <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                    {linkedPayment.network}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* PROOF */}
                            <td className="py-4 px-4">
                              {proofUrl ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModalProofSrc(proofUrl);
                                    setViewModalSub(sub);
                                  }}
                                  className="flex items-center gap-2 group cursor-pointer focus:outline-none"
                                  title="Click to view full payment screenshot"
                                >
                                  <ProofImage
                                    url={proofUrl}
                                    alt="Proof"
                                    className="w-9 h-9 object-cover rounded-lg border border-border group-hover:border-primary group-hover:scale-105 transition-all shadow-sm"
                                  />
                                  <span className="text-xs font-semibold text-primary group-hover:underline flex items-center gap-1">
                                    <ImageIcon className="w-3.5 h-3.5" /> View
                                  </span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 opacity-50" /> No proof
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => notifyUserProof(sub)}
                                    disabled={notifyingSubId === sub.id}
                                    className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
                                  >
                                    Request
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* DATE & VALIDITY */}
                            <td className="py-4 px-4">
                              <div className="text-xs font-bold text-foreground">
                                {dateInfo.top}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-medium">
                                {dateInfo.bottom}
                              </div>
                              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                {sub.status === "active"
                                  ? (isExpired ? "Expired" : `Valid: ${expiresDate}`)
                                  : "30-day VIP pass"}
                              </div>
                            </td>

                            {/* TXN REF */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5">
                                <span 
                                  className="font-mono text-xs font-bold text-foreground tracking-wider"
                                  title={txnRef}
                                >
                                  {truncateRef(txnRef, 12)}
                                </span>
                                {txnRef !== "—" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(txnRef);
                                      toast.success("Reference copied!");
                                    }}
                                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-section cursor-pointer"
                                    title="Copy reference"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              {linkedPayment?.sender_phone && linkedPayment.sender_phone !== "N/A" && (
                                <div className="text-[11px] text-muted-foreground">
                                  📱 {linkedPayment.sender_phone}
                                </div>
                              )}
                            </td>

                            {/* STATUS */}
                            <td className="py-4 px-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="cursor-pointer focus:outline-none transition-transform active:scale-95 group text-left">
                                    {sub.status === "pending" && (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning/15 border border-warning/30 text-warning hover:bg-warning/25 transition-colors">
                                        <Clock className="w-3.5 h-3.5 text-warning" /> Pending
                                      </span>
                                    )}
                                    {sub.status === "active" && !isExpired && (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success/15 border border-success/30 text-success hover:bg-success/25 transition-colors">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Active
                                      </span>
                                    )}
                                    {sub.status === "active" && isExpired && (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted border border-border text-muted-foreground hover:bg-muted/80 transition-colors">
                                        <Clock className="w-3.5 h-3.5" /> Expired
                                      </span>
                                    )}
                                    {(sub.status === "cancelled" || sub.status === "rejected") && (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-destructive/15 border border-destructive/30 text-destructive hover:bg-destructive/25 transition-colors">
                                        <XCircle className="w-3.5 h-3.5 text-destructive" /> Cancelled
                                      </span>
                                    )}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="bg-card-elevated border border-border text-foreground min-w-[190px] p-1.5 shadow-xl rounded-xl z-50">
                                  <DropdownMenuItem
                                    onClick={() => setViewModalSub(sub)}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-section rounded-lg cursor-pointer"
                                  >
                                    <Eye className="w-4 h-4 text-muted-foreground" /> View Subscription
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    onClick={() => setApproveModalSub(sub)}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-success hover:bg-success/10 rounded-lg cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-4 h-4 text-success" /> Activate 30 Days Pass
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    onClick={() => setRejectModalSub(sub)}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                  >
                                    <XCircle className="w-4 h-4 text-destructive" /> Reject Subscription
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-border my-1" />
                                  <DropdownMenuItem
                                    onClick={() => notifyUserProof(sub)}
                                    disabled={notifyingSubId === sub.id}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg cursor-pointer"
                                  >
                                    <Bell className="w-4 h-4 text-amber-500" /> Request Payment Proof
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => resetSubPending(sub.id)}
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
                                <DropdownMenuContent align="end" className="bg-card-elevated border border-border text-foreground min-w-[190px] p-1.5 shadow-xl rounded-xl z-50">
                                  <DropdownMenuItem
                                    onClick={() => setViewModalSub(sub)}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-foreground hover:bg-section rounded-lg cursor-pointer"
                                  >
                                    <Eye className="w-4 h-4 text-muted-foreground" /> View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    onClick={() => setApproveModalSub(sub)}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-success hover:bg-success/10 rounded-lg cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-4 h-4 text-success" /> Approve (30 Days)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={isProcessing}
                                    onClick={() => setRejectModalSub(sub)}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                  >
                                    <XCircle className="w-4 h-4 text-destructive" /> Reject Request
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-border my-1" />
                                  <DropdownMenuItem
                                    onClick={() => notifyUserProof(sub)}
                                    disabled={notifyingSubId === sub.id}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg cursor-pointer"
                                  >
                                    <Bell className="w-4 h-4 text-amber-500" /> Request Payment Proof
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => resetSubPending(sub.id)}
                                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-warning hover:bg-warning/10 rounded-lg cursor-pointer"
                                  >
                                    <Clock className="w-4 h-4 text-warning" /> Mark as Pending
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── View Subscription Modal ── */}
            {viewModalSub && (() => {
              const sub = viewModalSub;
              const profile = profiles.find((p: any) => p.id === sub.user_id);
              const linkedPayment = payments.find((p: any) =>
                (p.reference_code && p.reference_code === sub.payment_ref) ||
                (p.user_id === sub.user_id && p.package_id?.includes(sub.subscription_type))
              );
              const plan = subscriptionPlans.find((pl: any) => pl.id === `sub_${sub.subscription_type}` || pl.id === sub.subscription_type);
              const planName = plan?.name || SUB_TYPE_LABELS[sub.subscription_type] || sub.subscription_type;
              const userDisplay = linkedPayment?.sender_name || profile?.username || profile?.email?.split("@")[0] || "Subscriber";
              const userEmail = profile?.email || `ID: ${sub.user_id}`;
              const amount = Number(sub.amount_paid || linkedPayment?.amount || plan?.price || 0);
              const proofUrl = sub.proof_url || linkedPayment?.proof_url;
              const isProcessing = approvingSubId === sub.id || rejectingSubId === sub.id;
              const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date();
              const expiresDate = sub.expires_at
                ? new Date(sub.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : null;
              const txnRef = sub.payment_ref || linkedPayment?.reference_code || "—";

              return (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-card rounded-2xl border border-border p-6 max-w-lg w-full shadow-2xl text-foreground space-y-5 max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                          <Crown className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-foreground">
                            Subscription Pass Details
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Inspect 30-day VIP pass request and payment proof.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewModalSub(null)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-section cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Details Grid */}
                    <div className="p-4 rounded-xl bg-section/50 border border-border/70 space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Customer</span>
                        <span className="font-bold text-foreground">{userDisplay}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-mono text-foreground">{userEmail}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Plan</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">👑 {planName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Pass Duration</span>
                        <span className="font-bold text-foreground">30 Full Days</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Amount</span>
                        <div className="text-right">
                          <span className="font-black text-foreground block">GH₵ {amount.toFixed(2)}</span>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                            ≈ ₦{Math.ceil(amount * 115).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Payment Method</span>
                        <span className="font-semibold text-warning">{linkedPayment?.network || "Mobile Money"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Transaction Reference</span>
                        <span className="font-mono font-bold text-foreground">{txnRef}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Submitted At</span>
                        <span className="font-medium text-foreground">
                          {new Date(sub.created_at).toLocaleString("en-GB")}
                        </span>
                      </div>
                      {sub.expires_at && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Expiry Date</span>
                          <span className={`font-bold ${isExpired ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {expiresDate} {isExpired ? "(Expired)" : ""}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-border/60">
                        <span className="text-muted-foreground">Status</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                          sub.status === "active"
                            ? "bg-success/15 text-success border border-success/30"
                            : sub.status === "pending"
                            ? "bg-warning/15 text-warning border border-warning/30"
                            : "bg-destructive/15 text-destructive border border-destructive/30"
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                    </div>

                    {/* Proof Screenshot */}
                    {proofUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-foreground">
                          <span>Payment Screenshot</span>
                          <a
                            href={proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 font-semibold"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Full Size
                          </a>
                        </div>
                        <div 
                          onClick={() => setModalProofSrc(proofUrl)}
                          className="relative rounded-xl overflow-hidden border border-border bg-black/40 cursor-pointer max-h-56 flex items-center justify-center group"
                        >
                          <ProofImage
                            url={proofUrl}
                            alt="Payment Proof"
                            className="max-h-56 w-auto object-contain transition-transform group-hover:scale-102"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">
                            <Eye className="w-4 h-4" /> Click to enlarge
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground space-y-2">
                        <AlertCircle className="w-5 h-5 mx-auto opacity-50 text-warning" />
                        <p>No payment proof screenshot attached to this subscription.</p>
                        <button
                          type="button"
                          onClick={() => notifyUserProof(sub)}
                          disabled={notifyingSubId === sub.id}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold hover:bg-amber-500/20 transition-colors cursor-pointer border border-amber-500/30"
                        >
                          Send Notification Requesting Proof
                        </button>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setViewModalSub(null)}
                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-section transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                      {sub.status !== "cancelled" && sub.status !== "rejected" && (
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => {
                            setViewModalSub(null);
                            setRejectModalSub(sub);
                          }}
                          className="px-4 py-2 text-xs font-bold rounded-lg bg-destructive/15 border border-destructive/30 text-destructive hover:bg-destructive/25 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5 inline mr-1" /> Reject
                        </button>
                      )}
                      {sub.status !== "active" && (
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => {
                            setViewModalSub(null);
                            approveSubscription(sub);
                          }}
                          className="px-4 py-2 text-xs font-bold rounded-lg bg-success hover:bg-success/90 text-success-foreground transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> Approve & Activate Pass
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Approve Subscription Modal ── */}
            {approveModalSub && (() => {
              const sub = approveModalSub;
              const profile = profiles.find((p: any) => p.id === sub.user_id);
              const plan = subscriptionPlans.find((pl: any) => pl.id === `sub_${sub.subscription_type}` || pl.id === sub.subscription_type);
              const planName = plan?.name || SUB_TYPE_LABELS[sub.subscription_type] || sub.subscription_type;
              const userDisplay = profile?.username || profile?.email?.split("@")[0] || "Subscriber";
              const isProcessing = approvingSubId === sub.id;

              return (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl text-foreground space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-success/15 text-success flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">
                          Activate 30-Day Pass
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Grant 30 full days of VIP access for this user.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-section/50 border border-border/70 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Customer</span>
                        <span className="font-bold text-foreground">{userDisplay}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Plan</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{planName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Pass Validity</span>
                        <span className="font-bold text-foreground">30 Days (Starting now)</span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => setApproveModalSub(null)}
                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-section transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => approveSubscription(sub)}
                        className="px-4 py-2 text-xs font-bold rounded-lg bg-success hover:bg-success/90 text-success-foreground transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        {isProcessing ? "Activating..." : "Confirm & Activate"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Reject Subscription Modal ── */}
            {rejectModalSub && (() => {
              const sub = rejectModalSub;
              const profile = profiles.find((p: any) => p.id === sub.user_id);
              const plan = subscriptionPlans.find((pl: any) => pl.id === `sub_${sub.subscription_type}` || pl.id === sub.subscription_type);
              const planName = plan?.name || SUB_TYPE_LABELS[sub.subscription_type] || sub.subscription_type;
              const isProcessing = rejectingSubId === sub.id;

              return (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl text-foreground space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                        <XCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground">
                          Reject Subscription Request
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Cancel this pass request and notify the user.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-foreground">
                        Rejection Reason (Sent to User)
                      </label>
                      <textarea
                        rows={3}
                        value={subRejectReason}
                        onChange={(e) => setSubRejectReason(e.target.value)}
                        placeholder="e.g. Payment proof unreadable, incorrect amount, or invalid transaction..."
                        className="w-full p-2.5 text-xs rounded-lg border border-border bg-card text-foreground outline-none focus:ring-1 focus:ring-destructive resize-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => {
                          setRejectModalSub(null);
                          setSubRejectReason("");
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-section transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => rejectSubscription(sub.id, subRejectReason)}
                        className="px-4 py-2 text-xs font-bold rounded-lg bg-destructive hover:opacity-90 text-destructive-foreground transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        {isProcessing ? "Rejecting..." : "Confirm Rejection"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

    </div>
  );
}
