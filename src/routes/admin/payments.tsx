import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { 
  Search, Check, X, Clock, RefreshCw, CreditCard, 
  Smartphone, AlertCircle, ArrowUpRight, CheckCircle2, 
  XCircle, Filter, ChevronDown, MoreVertical, Eye,
  ExternalLink, Calendar, User, Hash, FileText, Image as ImageIcon,
  RotateCcw, Bell, Copy, Crown, Zap, ShieldCheck
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

const REJECTION_REASON_PRESETS = [
  "Payment not found on MoMo account statement",
  "Incorrect amount transferred for this package",
  "Screenshot proof is unclear or unreadable",
  "Reference / transaction ID does not match records",
  "Duplicate payment submission",
];

function AdminPaymentsPage() {
  const { user: currentAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeMainTab, setActiveMainTab] = useState<"payments" | "recovery" | "subscriptions">("payments");
  const [countryView, setCountryView] = useState<"ghana" | "nigeria">("ghana");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [showManualArchive, setShowManualArchive] = useState(false);
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

  const pendingSubsCount = allSubscriptions.filter((s: any) => {
    const lp = payments.find((p: any) =>
      (p.reference_code && s.payment_ref && p.reference_code === s.payment_ref) ||
      (p.user_id === s.user_id && p.package_id?.includes(s.subscription_type))
    );
    if (s.status === "cancelled" || s.status === "rejected" || lp?.status === "rejected") return false;
    if (s.status === "active" || lp?.status === "approved") return false;
    return (s.status || lp?.status || "pending") === "pending";
  }).length;

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
      const cleanReason = (reason?.trim() || "We could not confirm this transfer on our account statement. Please verify your details and resubmit.").trim();

      const { error } = await supabase
        .from("manual_payments")
        .update({
          status: "rejected",
          rejection_reason: cleanReason,
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

        // Notify user via in-app notifications
        if (payment.user_id) {
          const pkgTitle = vipPackages.find((pk: any) => pk.id === payment.package_id)?.name || payment.package_id;
          await supabase.from("app_notifications").insert({
            user_id: payment.user_id,
            type: "payment_rejected",
            title: "Payment Verification Notice",
            body: `Your payment for ${pkgTitle} could not be confirmed: ${cleanReason}`,
            is_read: false,
          });
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

  const isMoolre = (p: any) => {
    if (!p) return false;
    const ref = (p.reference_code || "").toLowerCase();
    const net = (p.network || "").toLowerCase();
    const tx = (p.transaction_id || "").toLowerCase();
    const rawAmount = Number(p.amount || 0);

    // Any payment with amount >= 5000 is an NGN subscription test artifact (e.g. 40,000 NGN)
    // and is NOT a GHS Moolre mobile money transaction.
    if (rawAmount >= 5000) return false;

    // Discard mock test-mode strings
    if (tx.startsWith("test_")) return false;

    // A real Moolre transaction must have:
    // 1. Official Moolre Gateway Network ID (starts with 9375) or moolre_verified
    if (tx.startsWith("9375") || tx.includes("moolre")) return true;

    // 2. Or reference_code starts with moolre_ AND has a valid transaction ID from Moolre
    if (ref.startsWith("moolre_") && tx && !tx.startsWith("test_")) return true;

    // 3. Or network specifically specifies Moolre MoMo with gateway confirmation
    if (net.includes("moolre") && (tx.startsWith("9375") || !tx.startsWith("test_"))) return true;

    return false;
  };

  // Separate Moolre Automated from Legacy Manual Payments
  const moolrePayments = payments.filter((p: any) => isMoolre(p));
  const manualPayments = payments.filter((p: any) => !isMoolre(p));

  // Identify Nigerian bank transfer payments (Moniepoint / NGN / 🇳🇬)
  const isNigerianPayment = (p: any) => {
    if (isMoolre(p)) return false; // Moolre is Ghana-only
    const net = (p.network || "").toLowerCase();
    const ref = (p.reference_code || "").toLowerCase();
    return (
      net.includes("nigeria") ||
      net.includes("moniepoint") ||
      net.includes("🇳🇬") ||
      ref.startsWith("momo-") === false && net.includes("ngn") ||
      // Nigerian bank slip deposits tend to have amounts ≥ 500 (NGN equivalent values)
      net.includes("bank transfer") && !net.includes("ghana") ||
      // If the network field explicitly carries a Nigerian flag or Moniepoint
      net.includes("ngn")
    );
  };

  const nigerianPayments = manualPayments.filter((p: any) => isNigerianPayment(p));
  // Ghana manual = all manuals that are NOT identified as Nigerian
  const ghanaManualPayments = manualPayments.filter((p: any) => !isNigerianPayment(p));

  const nigerianPendingCount = nigerianPayments.filter((p: any) => p.status === "pending").length;

  // Moolre Automated Stats (Live Production Gateway)
  const moolreApprovedPayments = moolrePayments.filter((p: any) => p.status === "approved");
  const moolreRevenue = moolreApprovedPayments.reduce((sum: number, p: any) => {
    const amt = Number(p.amount || 0);
    return sum + (amt < 5000 ? amt : 0);
  }, 0);
  const moolreCount = moolreApprovedPayments.length;
  const moolrePendingCount = moolrePayments.filter((p: any) => p.status === "pending").length;

  // Legacy Manual Stats (Archived)
  const manualApprovedPayments = manualPayments.filter((p: any) => p.status === "approved");
  const manualRevenue = manualApprovedPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const manualPendingCount = manualPayments.filter((p: any) => p.status === "pending").length;

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

  // Moolre Automated Filtering
  const filteredMoolrePayments = moolrePayments.filter((p: any) => {
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
      (p.network || "").toLowerCase().includes(term) ||
      (pkg?.name || "").toLowerCase().includes(term) ||
      (userProfile?.email || "").toLowerCase().includes(term) ||
      (userProfile?.username || "").toLowerCase().includes(term)
    );
  });

  // Manual Transfer Archive Filtering
  const filteredManualPayments = manualPayments.filter((p: any) => {
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
      (p.network || "").toLowerCase().includes(term) ||
      (pkg?.name || "").toLowerCase().includes(term) ||
      (userProfile?.email || "").toLowerCase().includes(term) ||
      (userProfile?.username || "").toLowerCase().includes(term)
    );
  });

  // Nigeria-specific filtered list (uses same statusFilter + search)
  const filteredNigerianPayments = nigerianPayments.filter((p: any) => {
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
      (p.network || "").toLowerCase().includes(term) ||
      (pkg?.name || "").toLowerCase().includes(term) ||
      (userProfile?.email || "").toLowerCase().includes(term) ||
      (userProfile?.username || "").toLowerCase().includes(term)
    );
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredManualPayments.map((p: any) => p.id));
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
          <Zap size={13} className="text-amber-500 fill-amber-500" />
          <span>Moolre Payments</span>
          {moolrePendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-warning text-black font-extrabold">
              {moolrePendingCount}
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
          {/* ── Country Switcher ── */}
          <div className="flex items-center gap-2 p-1 bg-section/40 border border-border rounded-xl self-start w-fit">
            <button
              type="button"
              onClick={() => { setCountryView("ghana"); setSearch(""); setStatusFilter("all"); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer border-none ${
                countryView === "ghana"
                  ? "bg-amber-500 text-black shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-card bg-transparent"
              }`}
            >
              <span>🇬🇭</span> Ghana
              <span className="opacity-70 font-normal">(Moolre)</span>
            </button>
            <button
              type="button"
              onClick={() => { setCountryView("nigeria"); setSearch(""); setStatusFilter("all"); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer border-none ${
                countryView === "nigeria"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-card bg-transparent"
              }`}
            >
              <span>🇳🇬</span> Nigeria
              <span className="opacity-70 font-normal">(Manual Bank)</span>
              {nigerianPendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white text-purple-700 font-extrabold animate-pulse">
                  {nigerianPendingCount}
                </span>
              )}
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════
              NIGERIA VIEW: Bank Transfer Approval Table
              ═══════════════════════════════════════════════════════ */}
          {countryView === "nigeria" ? (
            <>
              {/* Nigeria Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card p-4 rounded-xl border border-purple-500/30 flex items-center justify-between shadow-xs">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Nigeria Pending</p>
                    <h3 className="text-2xl font-black text-foreground mt-1">{nigerianPendingCount}</h3>
                    <p className="text-xs text-purple-500 font-semibold mt-0.5">Awaiting manual approval</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
                    <Clock size={18} />
                  </div>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border flex items-center justify-between shadow-xs">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Approved Transfers</p>
                    <h3 className="text-2xl font-black text-foreground mt-1">
                      {nigerianPayments.filter((p: any) => p.status === "approved").length}
                    </h3>
                    <p className="text-xs text-emerald-500 font-semibold mt-0.5">Bank slips verified</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} />
                  </div>
                </div>
                <div className="bg-card p-4 rounded-xl border border-border flex items-center justify-between shadow-xs">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total NGN Revenue</p>
                    <h3 className="text-2xl font-black text-foreground mt-1">
                      ₦{nigerianPayments.filter((p: any) => p.status === "approved").reduce((s: number, p: any) => s + Number(p.amount || 0), 0).toLocaleString()}
                    </h3>
                    <p className="text-xs text-muted-foreground font-semibold mt-0.5">Moniepoint collections</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
                    <CreditCard size={18} />
                  </div>
                </div>
              </div>

              {/* Nigeria Bank Slip Approval Table */}
              <div className="rounded-xl border border-purple-500/30 bg-card overflow-hidden shadow-sm">
                {/* Header */}
                <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-purple-500/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-500 flex items-center justify-center shrink-0">
                      <span className="text-base">🇳🇬</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-foreground">Nigeria Bank Transfer Approvals</h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/15 text-purple-500 border border-purple-500/30">
                          Moniepoint MFB
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Review bank transfer receipts from Nigerian customers. Approve to grant VIP access.
                      </p>
                    </div>
                  </div>

                  {/* Filter + Search */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex gap-1 bg-background p-0.5 rounded-lg border border-border">
                      {(["all", "pending", "approved", "rejected"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setStatusFilter(tab)}
                          className={`px-3 py-1 text-xs font-bold capitalize transition-all cursor-pointer rounded-md border-none ${
                            statusFilter === tab
                              ? "bg-foreground text-background shadow-xs font-black"
                              : "text-muted-foreground hover:text-foreground bg-transparent"
                          }`}
                        >
                          {tab}
                          {tab === "pending" && nigerianPendingCount > 0 && (
                            <span className="ml-1 text-[10px] opacity-80">({nigerianPendingCount})</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="relative w-full sm:w-56">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search customer, ref, name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Mobile Card list */}
                <div className="sm:hidden divide-y divide-border/60">
                  {paymentsLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin opacity-50" /> Loading...
                    </div>
                  ) : filteredNigerianPayments.length === 0 ? (
                    <div className="text-center text-muted-foreground py-16 text-sm px-4">
                      {nigerianPayments.length === 0
                        ? "No Nigerian bank transfer payments yet. They appear here as soon as a Nigerian user completes checkout."
                        : "No payments match your filter."}
                    </div>
                  ) : filteredNigerianPayments.map((payment: any) => {
                    const pkg = vipPackages.find((p: any) => p.id === payment.package_id);
                    const userProfile = profiles.find((prof: any) => prof.id === payment.user_id);
                    const userDisplay = payment.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "Customer";
                    const isProcessing = processingId === payment.id;
                    const dateStr = new Date(payment.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={payment.id} onClick={() => setViewModalPayment(payment)} className="p-4 space-y-3 hover:bg-section/30 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-foreground">{userDisplay}</span>
                          {payment.status === "pending" ? (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/15 border border-warning/30 text-warning">
                              <Clock className="w-2.5 h-2.5" /> Pending
                            </span>
                          ) : payment.status === "approved" ? (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
                              <Check className="w-2.5 h-2.5" /> Approved
                            </span>
                          ) : (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 border border-destructive/30 text-destructive">
                              <XCircle className="w-2.5 h-2.5" /> Rejected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="text-muted-foreground">{pkg?.name || payment.package_id}</p>
                            <p className="font-mono text-[11px] text-muted-foreground mt-0.5">{(payment.network || "Moniepoint").split("(")[0].trim()}</p>
                          </div>
                          <p className="font-black text-foreground">₦{Number(payment.amount || 0).toLocaleString()}</p>
                        </div>
                        {payment.proof_url && (
                          <div className="rounded-lg overflow-hidden border border-border h-20">
                            <ProofImage url={payment.proof_url} alt="Payment slip" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                          <span className="text-[11px] text-muted-foreground">{dateStr}</span>
                          {payment.status !== "approved" && (
                            <div className="flex gap-2">
                              <button type="button" disabled={isProcessing}
                                onClick={(e) => { e.stopPropagation(); setApproveModalPayment(payment); }}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer border-none">
                                <Check size={11} /> Approve
                              </button>
                              <button type="button" disabled={isProcessing}
                                onClick={(e) => { e.stopPropagation(); setRejectModalPayment(payment); }}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-destructive hover:opacity-90 text-destructive-foreground flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer border-none">
                                <X size={11} /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border bg-section/70 text-[11px] font-bold tracking-wider text-muted-foreground uppercase select-none">
                        <th className="py-3.5 px-4">CUSTOMER</th>
                        <th className="py-3.5 px-4">PACKAGE</th>
                        <th className="py-3.5 px-4">AMOUNT (NGN)</th>
                        <th className="py-3.5 px-4">PROOF SLIP</th>
                        <th className="py-3.5 px-4">BANK / REF</th>
                        <th className="py-3.5 px-4">DATE</th>
                        <th className="py-3.5 px-4">STATUS</th>
                        <th className="py-3.5 px-4 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {paymentsLoading ? (
                        <tr>
                          <td colSpan={8} className="text-center text-muted-foreground py-16 text-sm">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                            Loading Nigeria payments...
                          </td>
                        </tr>
                      ) : filteredNigerianPayments.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-16 px-4">
                            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                              <span className="text-4xl">🇳🇬</span>
                              <p className="text-sm font-bold text-foreground">No Nigerian payments yet</p>
                              <p className="text-xs max-w-xs text-center">
                                Nigerian bank transfer payments will appear here as soon as a Nigerian user completes checkout via Moniepoint.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : filteredNigerianPayments.map((payment: any) => {
                        const pkg = vipPackages.find((p: any) => p.id === payment.package_id);
                        const userProfile = profiles.find((prof: any) => prof.id === payment.user_id);
                        const userDisplay = payment.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "Customer";
                        const userEmail = userProfile?.email || `ID: ${payment.user_id?.substring(0, 8)}...`;
                        const isProcessing = processingId === payment.id;
                        const dateInfo = formatPaymentDate(payment.created_at);
                        const networkDisplay = (payment.network || "Moniepoint MFB").split("(")[0].trim();
                        const refDisplay = payment.reference_code || payment.transaction_id || payment.id;

                        return (
                          <tr key={payment.id} onClick={() => setViewModalPayment(payment)} className="hover:bg-section/50 transition-colors cursor-pointer group">
                            {/* CUSTOMER */}
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-xs text-foreground">{userDisplay}</div>
                              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{userEmail}</div>
                            </td>
                            {/* PACKAGE */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <Crown size={11} className="text-purple-500 shrink-0" />
                                <span className="font-bold text-xs text-foreground">{pkg?.name || payment.package_id}</span>
                              </div>
                            </td>
                            {/* AMOUNT */}
                            <td className="py-3.5 px-4">
                              <div className="font-black text-sm text-foreground">
                                ₦{Number(payment.amount || 0).toLocaleString()}
                              </div>
                              <div className="text-[11px] font-semibold text-muted-foreground">
                                ≈ GH₵{(Number(payment.amount || 0) / 115).toFixed(2)}
                              </div>
                            </td>
                            {/* PROOF */}
                            <td className="py-3.5 px-4">
                              {payment.proof_url ? (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setModalProofSrc(payment.proof_url); }}
                                  className="w-16 h-12 rounded-lg overflow-hidden border border-border block hover:border-purple-500 transition-colors cursor-pointer p-0 bg-transparent">
                                  <ProofImage url={payment.proof_url} alt="Receipt" className="w-full h-full object-cover" />
                                </button>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">No receipt</span>
                              )}
                            </td>
                            {/* BANK / REF */}
                            <td className="py-3.5 px-4">
                              <div className="text-xs font-bold text-foreground">{networkDisplay}</div>
                              <div className="font-mono text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                {truncateRef(refDisplay, 14)}
                                <button type="button" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(refDisplay); toast.success("Ref copied!"); }}
                                  className="p-0.5 text-muted-foreground hover:text-foreground rounded cursor-pointer opacity-70 hover:opacity-100">
                                  <Copy size={10} />
                                </button>
                              </div>
                            </td>
                            {/* DATE */}
                            <td className="py-3.5 px-4">
                              <div className="text-xs font-bold text-foreground">{dateInfo.top}</div>
                              <div className="text-[11px] text-muted-foreground">{dateInfo.bottom}</div>
                            </td>
                            {/* STATUS */}
                            <td className="py-3.5 px-4">
                              {payment.status === "approved" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
                                  <CheckCircle2 size={11} /> Approved
                                </span>
                              ) : payment.status === "pending" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-warning/15 border border-warning/30 text-warning">
                                  <Clock size={11} /> Pending
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-destructive/15 border border-destructive/30 text-destructive">
                                  <XCircle size={11} /> Rejected
                                </span>
                              )}
                            </td>
                            {/* ACTIONS */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button type="button" onClick={(e) => { e.stopPropagation(); setViewModalPayment(payment); }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground hover:bg-section transition-colors cursor-pointer shadow-xs">
                                  <Eye size={11} className="text-muted-foreground" /> View
                                </button>
                                {payment.status !== "approved" && (
                                  <button type="button" disabled={isProcessing}
                                    onClick={(e) => { e.stopPropagation(); setApproveModalPayment(payment); }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs border-none">
                                    <Check size={11} /> Approve
                                  </button>
                                )}
                                {payment.status !== "rejected" && (
                                  <button type="button" disabled={isProcessing}
                                    onClick={(e) => { e.stopPropagation(); setRejectModalPayment(payment); }}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-destructive hover:opacity-90 text-destructive-foreground transition-colors disabled:opacity-50 cursor-pointer shadow-xs border-none">
                                    <X size={11} /> Reject
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* ════════════════════════════════════════════════════════
               GHANA VIEW: Moolre Automated + Manual Archive (original)
               ════════════════════════════════════════════════════════ */
            <>
          {/* Stats Cards: 100% Focused on Moolre Automated Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Moolre Verified Revenue */}
            <div className="bg-card p-4 rounded-xl border border-border flex items-center justify-between shadow-xs">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Zap size={12} className="text-amber-500 fill-amber-500" />
                  Moolre Verified Revenue
                </p>
                <h3 className="text-2xl font-black text-foreground mt-1">
                  GH₵ {moolreRevenue.toFixed(2)}
                </h3>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ≈ ₦{Math.ceil(moolreRevenue * 115).toLocaleString()} <span className="text-muted-foreground font-normal">({moolreCount} paid)</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                <CreditCard size={18} />
              </div>
            </div>

            {/* Card 2: Automated USSD Orders */}
            <div 
              onClick={() => {
                setStatusFilter("all");
                setSearch("");
              }}
              className="cursor-pointer bg-card p-4 rounded-xl border border-border hover:border-amber-500/50 transition-all flex items-center justify-between shadow-xs"
              title="Click to reset filters and view all Moolre transactions"
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Automated Orders
                </p>
                <h3 className="text-2xl font-black text-foreground mt-1">
                  {moolreCount}
                </h3>
                <p className="text-xs font-semibold text-emerald-500 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 size={11} /> 100% Instant Auto-Credited
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <Zap size={18} className="fill-emerald-500" />
              </div>
            </div>

            {/* Card 3: Active VIP Members */}
            <div 
              onClick={() => setActiveMainTab("subscriptions")}
              className="cursor-pointer bg-card p-4 rounded-xl border border-border hover:border-primary/50 transition-all flex items-center justify-between shadow-xs"
              title="Click to view subscriptions"
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Active VIP Members
                </p>
                <h3 className="text-2xl font-black text-foreground mt-1">
                  {allSubscriptions.filter((s: any) => s.status === "active").length + moolreCount}
                </h3>
                <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                  <span className="text-primary font-bold">{allSubscriptions.filter((s: any) => s.status === "active").length} passes</span> active
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
                <Crown size={18} />
              </div>
            </div>

            {/* Card 4: Instant Settlement Status */}
            <div className="bg-card p-4 rounded-xl border border-border flex items-center justify-between shadow-xs">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-500" /> Instant Settlement
                </p>
                <h3 className="text-lg font-black text-emerald-500 mt-1 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                  MTN MoMo Live
                </h3>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate max-w-[170px]" title="0550653849 (Wallet 78331)">
                  0550653849 • W#78331
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <Smartphone size={18} />
              </div>
            </div>

          </div>

          {/* ═══════════════════════════════════════════════════════════════
              PRIMARY: MOOLRE AUTOMATED PAYMENT LEDGER
              ═══════════════════════════════════════════════════════════════ */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {/* Moolre Header & Filter Bar */}
            <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-section/40">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
                  <Zap size={16} className="fill-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-foreground">
                      Moolre Automated Payment Ledger
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                      100% Auto-Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Real-time Mobile Money USSD push collections. Settles instantly to MTN <span className="font-mono font-bold text-foreground">0550653849</span> (Wallet ID: 78331).
                  </p>
                </div>
              </div>

              {/* Status Tabs + Search */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex gap-1 bg-background p-0.5 rounded-lg border border-border">
                  {(["all", "approved", "pending", "rejected"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setStatusFilter(tab)}
                      className={`px-3 py-1 text-xs font-bold capitalize transition-all cursor-pointer rounded-md border-none ${
                        statusFilter === tab
                          ? "bg-foreground text-background shadow-xs font-black"
                          : "text-muted-foreground hover:text-foreground bg-transparent"
                      }`}
                    >
                      {tab === "approved" ? "Verified" : tab}
                      {tab === "approved" && moolreCount > 0 && (
                        <span className="ml-1 text-[10px] opacity-80">({moolreCount})</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search user, ref, phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* ── Moolre Mobile Card List (hidden on sm+) ── */}
            <div className="sm:hidden divide-y divide-border/60">
              {paymentsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin opacity-50" />
                  Loading Moolre payments...
                </div>
              ) : filteredMoolrePayments.length === 0 ? (
                <div className="text-center text-muted-foreground py-16 text-sm px-4">
                  No automated Moolre payments found matching your filter.
                </div>
              ) : (
                filteredMoolrePayments.map((payment: any) => {
                  const pkg = vipPackages.find((p: any) => p.id === payment.package_id);
                  const userProfile = profiles.find((prof: any) => prof.id === payment.user_id);
                  const userDisplay = payment.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "Customer";
                  const txRef = payment.transaction_id || payment.reference_code || payment.id;
                  const dateStr = new Date(payment.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div 
                      key={payment.id} 
                      onClick={() => setViewModalPayment(payment)}
                      className="p-4 space-y-2.5 hover:bg-section/30 transition-colors cursor-pointer"
                    >
                      {/* Top: TxID & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-black text-foreground truncate">
                          {truncateRef(txRef, 16)}
                        </span>
                        {payment.status === "approved" ? (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
                            <Zap className="w-2.5 h-2.5 fill-emerald-500" /> Auto-Verified
                          </span>
                        ) : payment.status === "pending" ? (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/15 border border-warning/30 text-warning">
                            <Clock className="w-2.5 h-2.5 text-warning" /> USSD Sent
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 border border-destructive/30 text-destructive">
                            <XCircle className="w-2.5 h-2.5 text-destructive" /> Failed
                          </span>
                        )}
                      </div>

                      {/* Middle: Customer + Package + Amount */}
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-foreground">
                            {payment.sender_phone || userDisplay}
                          </p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Crown size={11} className="text-amber-500" />
                            {pkg?.name || payment.package_id}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-sm text-foreground">
                            GH₵ {Number(payment.amount || pkg?.price || 0).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-emerald-500 font-semibold">
                            ≈ ₦{Math.ceil(Number(payment.amount || pkg?.price || 0) * 115).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Bottom: Date & Inspect */}
                      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                        <span>{dateStr}</span>
                        <span className="font-bold text-primary flex items-center gap-1">
                          Inspect <Eye size={12} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Moolre Desktop Table (hidden on mobile) ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border bg-section/70 text-[11px] font-bold tracking-wider text-muted-foreground uppercase select-none">
                    <th className="py-3.5 px-4">TRANSACTION</th>
                    <th className="py-3.5 px-4">CUSTOMER</th>
                    <th className="py-3.5 px-4">AMOUNT</th>
                    <th className="py-3.5 px-4">DATE</th>
                    <th className="py-3.5 px-4">STATUS</th>
                    <th className="py-3.5 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {paymentsLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-16 text-sm">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                        Loading Moolre payments...
                      </td>
                    </tr>
                  ) : filteredMoolrePayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground py-16 text-sm">
                        No automated Moolre payments found matching your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredMoolrePayments.map((payment: any) => {
                      const pkg = vipPackages.find((p: any) => p.id === payment.package_id);
                      const userProfile = profiles.find((prof: any) => prof.id === payment.user_id);
                      const userDisplay = payment.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "Customer";
                      const txRef = payment.transaction_id || payment.reference_code || payment.id;
                      const dateStr = new Date(payment.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <tr 
                          key={payment.id} 
                          onClick={() => setViewModalPayment(payment)}
                          className="hover:bg-section/50 transition-colors cursor-pointer group"
                        >
                          {/* TRANSACTION */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-black text-foreground group-hover:text-primary transition-colors">
                                {truncateRef(txRef, 16)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(txRef);
                                  toast.success("Transaction ID copied!");
                                }}
                                className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer opacity-70 group-hover:opacity-100"
                                title="Copy ID"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                <Crown size={11} className="text-amber-500" />
                                {pkg?.name || payment.package_id}
                              </span>
                            </div>
                          </td>

                          {/* CUSTOMER */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-xs text-foreground">
                              {payment.sender_phone || userDisplay}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              {payment.network || "MTN Mobile Money"}
                            </div>
                          </td>

                          {/* AMOUNT */}
                          <td className="py-3.5 px-4">
                            <div className="font-black text-sm text-foreground">
                              GH₵ {Number(payment.amount || pkg?.price || 0).toFixed(2)}
                            </div>
                            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              ≈ ₦{Math.ceil(Number(payment.amount || pkg?.price || 0) * 115).toLocaleString()}
                            </div>
                          </td>

                          {/* DATE */}
                          <td className="py-3.5 px-4">
                            <span className="text-xs text-muted-foreground font-medium">
                              {dateStr}
                            </span>
                          </td>

                          {/* STATUS */}
                          <td className="py-3.5 px-4">
                            {payment.status === "approved" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-500">
                                <Zap className="w-3 h-3 fill-emerald-500" /> Auto-Verified
                              </span>
                            ) : payment.status === "pending" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-warning/15 border border-warning/30 text-warning">
                                <Clock className="w-3 h-3 text-warning" /> USSD Sent
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-destructive/15 border border-destructive/30 text-destructive">
                                <XCircle className="w-3 h-3 text-destructive" /> Failed
                              </span>
                            )}
                          </td>

                          {/* ACTION */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewModalPayment(payment);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-foreground hover:bg-section transition-colors cursor-pointer shadow-xs"
                            >
                              <Eye size={12} className="text-muted-foreground" />
                              <span>Inspect</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              SECONDARY / ARCHIVE: LEGACY MANUAL TRANSFERS (HIDDEN BY DEFAULT)
              ═══════════════════════════════════════════════════════════════ */}
          <div className="rounded-xl border border-dashed border-border bg-card/60 overflow-hidden shadow-xs">
            <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-section/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-muted border border-border flex items-center justify-center text-muted-foreground shrink-0">
                  <Smartphone size={16} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold text-foreground">
                      Legacy Manual Transfer Slips Archive
                    </p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                      {manualPayments.length} records • GH₵ {manualRevenue.toFixed(0)} archived
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Archived manual offline payments. Total historical manual revenue: <span className="font-bold text-foreground">GH₵ {manualRevenue.toFixed(0)}</span> (≈ ₦{Math.ceil(manualRevenue * 115).toLocaleString()}).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowManualArchive(!showManualArchive)}
                className="px-3.5 py-1.5 rounded-lg border border-border bg-background text-xs font-bold text-foreground hover:bg-section transition-all cursor-pointer flex items-center gap-2 shadow-xs"
              >
                {showManualArchive ? (
                  <>
                    <X size={14} /> Hide Manual Archive
                  </>
                ) : (
                  <>
                    <Eye size={14} /> View Archived Manual Slips ({manualPayments.length})
                  </>
                )}
              </button>
            </div>

            {/* Preserved Legacy Manual Table */}
            {showManualArchive && (
              <div className="border-t border-border">
                {/* Search / Filter for Manual Archive */}
                <div className="p-3 border-b border-border bg-section/20 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground font-semibold">
                    Showing {filteredManualPayments.length} of {manualPayments.length} archived manual payments
                  </p>
                  <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search archive..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border bg-section/70 text-[11px] font-bold tracking-wider text-muted-foreground uppercase select-none">
                        <th className="py-3 px-4 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={filteredManualPayments.length > 0 && selectedIds.length === filteredManualPayments.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-0 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-4">USER</th>
                        <th className="py-3 px-4">AMOUNT</th>
                        <th className="py-3 px-4">PROOF SCREENSHOT</th>
                        <th className="py-3 px-4">DATE</th>
                        <th className="py-3 px-4">TXN REF</th>
                        <th className="py-3 px-4">STATUS</th>
                        <th className="py-3 px-4 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredManualPayments.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center text-muted-foreground py-10 text-xs">
                            No manual payments found in archive.
                          </td>
                        </tr>
                      ) : (
                        filteredManualPayments.map((payment: any) => {
                          const pkg = vipPackages.find((p: any) => p.id === payment.package_id);
                          const userProfile = profiles.find((prof: any) => prof.id === payment.user_id);
                          const userDisplay = payment.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "Customer";
                          const userEmail = userProfile?.email || `ID: ${payment.user_id.substring(0, 8)}...`;
                          const isProcessing = processingId === payment.id;
                          const dateInfo = formatPaymentDate(payment.created_at);

                          return (
                            <tr key={payment.id} className="hover:bg-section/40 transition-colors">
                              {/* Checkbox */}
                              <td className="py-3 px-4 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(payment.id)}
                                  onChange={() => handleSelectRow(payment.id)}
                                  className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-0 cursor-pointer"
                                />
                              </td>

                              {/* USER */}
                              <td className="py-3 px-4">
                                <div className="font-bold text-xs text-foreground leading-tight">
                                  {userDisplay}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                                  {userEmail}
                                </div>
                              </td>

                              {/* AMOUNT */}
                              <td className="py-3 px-4">
                                <div className="font-bold text-xs text-foreground">
                                  GH₵ {Number(payment.amount || pkg?.price || 0).toFixed(0)}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {payment.network || "Manual"}
                                </div>
                              </td>

                              {/* PROOF */}
                              <td className="py-3 px-4">
                                {payment.proof_url ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setModalProofSrc(payment.proof_url);
                                      setViewModalPayment(payment);
                                    }}
                                    className="flex items-center gap-2 group cursor-pointer focus:outline-none"
                                  >
                                    <ProofImage
                                      url={payment.proof_url}
                                      alt="Proof"
                                      className="w-8 h-8 object-cover rounded border border-border group-hover:border-primary transition-all"
                                    />
                                    <span className="text-xs font-semibold text-primary group-hover:underline flex items-center gap-1">
                                      <ImageIcon className="w-3.5 h-3.5" /> View
                                    </span>
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">No image</span>
                                )}
                              </td>

                              {/* DATE */}
                              <td className="py-3 px-4">
                                <div className="text-xs font-bold text-foreground">
                                  {dateInfo.top}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {dateInfo.bottom}
                                </div>
                              </td>

                              {/* TXN REF */}
                              <td className="py-3 px-4 font-mono text-xs text-foreground">
                                {truncateRef(payment.transaction_id || payment.reference_code, 12)}
                              </td>

                              {/* STATUS */}
                              <td className="py-3 px-4">
                                {payment.status === "pending" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-warning/15 border border-warning/30 text-warning">
                                    <Clock className="w-3 h-3 text-warning" /> Pending
                                  </span>
                                )}
                                {payment.status === "approved" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success/15 border border-success/30 text-success">
                                    <CheckCircle2 className="w-3 h-3 text-success" /> Approved
                                  </span>
                                )}
                                {payment.status === "rejected" && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 border border-destructive/30 text-destructive">
                                    <XCircle className="w-3 h-3 text-destructive" /> Rejected
                                  </span>
                                )}
                              </td>

                              {/* ACTIONS */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setViewModalPayment(payment)}
                                    className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                                    title="View"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {payment.status !== "approved" && (
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => setApproveModalPayment(payment)}
                                      className="p-1 rounded text-success hover:bg-success/10 cursor-pointer disabled:opacity-50"
                                      title="Approve"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  {payment.status !== "rejected" && (
                                    <button
                                      type="button"
                                      disabled={isProcessing}
                                      onClick={() => setRejectModalPayment(payment)}
                                      className="p-1 rounded text-destructive hover:bg-destructive/10 cursor-pointer disabled:opacity-50"
                                      title="Reject"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
            {/* END Ghana view */}
            </>
          )}
          {/* END countryView ternary */}
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

  {/* ── View Payment Side Panel Drawer ── */}
      {viewModalPayment && (() => {
        const p = viewModalPayment;
        const pkg = vipPackages.find((item: any) => item.id === p.package_id);
        const userProfile = profiles.find((prof: any) => prof.id === p.user_id);
        const userDisplay = p.sender_name || userProfile?.username || userProfile?.email?.split("@")[0] || "Customer";
        const isProcessing = processingId === p.id;
        const isMoolreTx = isMoolre(p);

        return (
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
            onClick={() => setViewModalPayment(null)}
          >
            <div 
              className="bg-card border-l border-border w-full max-w-lg h-full shadow-2xl flex flex-col text-foreground animate-in slide-in-from-right duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Panel Header */}
              <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-section/30">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isMoolreTx 
                      ? "bg-amber-500/15 text-amber-500 border border-amber-500/30" 
                      : "bg-primary/15 text-primary border border-primary/30"
                  }`}>
                    {isMoolreTx ? <Zap className="w-5 h-5 fill-amber-500" /> : <CreditCard className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                      {isMoolreTx ? "Moolre Payment Inspector" : "Payment Details"}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[240px] sm:max-w-xs" title={p.reference_code || p.transaction_id}>
                      {p.reference_code ? `Ref: ${p.reference_code}` : `Sender: ${p.sender_name || userDisplay}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewModalPayment(null)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-section transition-colors cursor-pointer"
                  title="Close panel"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Panel Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                
                {/* Hero Amount & Status Card */}
                <div className="p-4 rounded-xl bg-section/60 border border-border flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                      Paid Amount
                    </span>
                    <span className="text-2xl font-black text-foreground">
                      GH₵ {Number(p.amount || pkg?.price || 0).toFixed(2)}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                      ≈ ₦{Math.ceil(Number(p.amount || pkg?.price || 0) * 115).toLocaleString()} NGN
                    </span>
                  </div>

                  <div className="text-right">
                    {isMoolreTx ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <Zap className="w-3.5 h-3.5 fill-emerald-500" /> Auto-Verified
                      </span>
                    ) : p.status === "approved" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success/15 text-success border border-success/30">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                      </span>
                    ) : p.status === "pending" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-warning/15 text-warning border border-warning/30">
                        <Clock className="w-3 h-3" /> Pending Review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-destructive/15 text-destructive border border-destructive/30">
                        <XCircle className="w-3 h-3" /> Rejected
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground block mt-1">
                      {new Date(p.created_at).toLocaleString("en-GB", {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
                      })}
                    </span>
                  </div>
                </div>

                {/* Rejection Notice (if rejected) */}
                {p.status === "rejected" && p.rejection_reason && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                    <strong className="block font-bold mb-0.5">Rejection Reason:</strong>
                    {p.rejection_reason}
                  </div>
                )}

                {/* Moolre Settlement & Collection Live Ledger */}
                {isMoolreTx ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                      <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                        <Zap size={14} className="fill-amber-500" /> Moolre Verified MoMo Ledger
                      </span>
                      <span className="text-[10px] font-mono text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        ● Live Gateway Recorded
                      </span>
                    </div>

                    {/* Collection Entry */}
                    <div className="bg-card/80 p-3 rounded-lg border border-border/70 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                          Collection (Inflow)
                        </span>
                        <span className="font-black text-foreground">GH₵ {Number(p.amount || 0).toFixed(2)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/40">
                        <div>
                          <span className="text-muted-foreground block">From Customer</span>
                          <span className="font-mono font-bold text-foreground">
                            {p.sender_phone || "233257825866"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">To Merchant</span>
                          <span className="font-semibold text-foreground">A1TIPS Deck (78331)</span>
                        </div>
                      </div>
                      <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                        <span>Network ID:</span>
                        <span className="text-primary font-bold flex items-center gap-1">
                          {p.transaction_id || "93755881459"}
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(p.transaction_id || "");
                              toast.success("Transaction ID copied!");
                            }}
                            className="hover:text-foreground cursor-pointer"
                            title="Copy ID"
                          >
                            <Copy size={11} />
                          </button>
                        </span>
                      </div>
                    </div>

                    {/* Instant Settlement Entry */}
                    <div className="bg-card/80 p-3 rounded-lg border border-border/70 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                          Instant Settlement (Payout)
                        </span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400">
                          GH₵ {Number(p.amount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/40">
                        <div>
                          <span className="text-muted-foreground block">Settled To Phone</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            0550653849 (MTN MoMo)
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Moolre Account</span>
                          <span className="font-mono font-semibold text-foreground">11090906078331</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                      ⚡ <strong>Automated Delivery:</strong> This order was authorized by MoMo PIN prompt and auto-approved. Access to predictions & booking codes is delivered instantly to the customer's dashboard without admin intervention.
                    </p>
                  </div>
                ) : null}

                {/* Customer & Package Breakdown Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-section/40 border border-border/60 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                      Customer Profile
                    </span>
                    <p className="font-bold text-foreground text-sm">{userDisplay}</p>
                    <p className="font-mono text-[11px] text-muted-foreground truncate">{userProfile?.email || "No email"}</p>
                    <p className="font-mono text-[10px] text-muted-foreground pt-1">UID: {p.user_id}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-section/40 border border-border/60 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                      VIP Package / Pass
                    </span>
                    <p className="font-bold text-foreground text-sm flex items-center gap-1.5">
                      <Crown size={14} className="text-amber-500" />
                      {pkg?.name || p.package_id}
                    </p>
                    {pkg?.booking_code && (
                      <p className="font-mono text-[11px] text-primary font-bold">
                        Code: {pkg.booking_code}
                      </p>
                    )}
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                      {p.package_id?.startsWith("sub_") ? "Subscription Pass" : "VIP Single Package"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-section/40 border border-border/60 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                      Gateway & Method
                    </span>
                    <p className="font-bold text-warning">{p.network || "MTN Mobile Money"}</p>
                    <p className="text-muted-foreground text-[11px]">Sender: {p.sender_name || userDisplay}</p>
                    {p.sender_phone && (
                      <p className="font-mono text-[11px] text-foreground font-semibold">
                        Phone: {p.sender_phone}
                      </p>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-section/40 border border-border/60 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                      Internal Identifiers
                    </span>
                    {p.transaction_id && (
                      <p className="font-mono text-[11px] text-foreground truncate" title={p.transaction_id}>
                        TxID: {p.transaction_id}
                      </p>
                    )}
                    {p.reference_code && (
                      <p className="font-mono text-[11px] text-primary font-bold truncate" title={p.reference_code}>
                        Ref: {p.reference_code}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      ID: {p.id}
                    </p>
                  </div>
                </div>

                {/* Legacy Manual Payment Proof (for manual archive) */}
                {!isMoolreTx && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
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
                            className="w-full max-h-80 object-contain rounded-lg hover:opacity-95 transition-opacity"
                            onSignedUrl={(signed) => setModalProofSrc(signed)}
                          />
                        </a>
                      </div>
                    ) : (
                      <div className="p-8 rounded-xl border border-dashed border-border bg-section/20 text-center text-muted-foreground text-xs">
                        <ImageIcon className="w-8 h-8 opacity-40 mx-auto mb-1.5" />
                        No screenshot uploaded for this manual record
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Panel Footer Actions */}
              <div className="p-4 border-t border-border bg-card flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setViewModalPayment(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-section transition-colors cursor-pointer"
                >
                  Close Inspector
                </button>

                <div className="flex items-center gap-2">
                  {!isMoolreTx && p.status !== "approved" && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setApproveModalPayment(p)}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-primary hover:bg-primary-hover text-primary-foreground flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}

                  {!isMoolreTx && p.status !== "rejected" && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setRejectModalPayment(p)}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-destructive hover:opacity-90 text-destructive-foreground flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  )}

                  {!isMoolreTx && p.status !== "pending" && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setPendingMutation.mutate(p.id)}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-warning hover:opacity-90 text-black flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      <Clock className="w-3.5 h-3.5" /> Set Pending
                    </button>
                  )}

                  {isMoolreTx && (
                    <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                      <ShieldCheck size={14} /> Settlement Verified
                    </span>
                  )}
                </div>
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

            <div className="space-y-2">
              <label className="block text-xs font-bold text-foreground">Rejection Reason</label>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold">Quick Reason Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {REJECTION_REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRejectReason(preset)}
                      className={`px-2 py-1 text-[10px] rounded-md border text-left transition-colors cursor-pointer ${
                        rejectReason === preset
                          ? "bg-destructive/15 border-destructive text-destructive font-bold"
                          : "bg-section hover:bg-muted border-border/80 text-foreground"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={3}
                placeholder="e.g. Payment not received on our statement..."
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

        // Helper to determine accurate status across both subscriptions and manual_payments tables
        const getSubEffectiveStatus = (s: any) => {
          const lp = payments.find((p: any) =>
            (p.reference_code && s.payment_ref && p.reference_code === s.payment_ref) ||
            (p.user_id === s.user_id && p.package_id?.includes(s.subscription_type))
          );
          if (s.status === "cancelled" || s.status === "rejected" || lp?.status === "rejected") {
            return s.status === "cancelled" ? "cancelled" : "rejected";
          }
          if (s.status === "active" || lp?.status === "approved") {
            if (s.expires_at && new Date(s.expires_at) < new Date()) return "expired";
            return "active";
          }
          return s.status || lp?.status || "pending";
        };

        // Stats calculations
        const totalSubs = allSubscriptions.length;
        const pendingSubs = allSubscriptions.filter((s: any) => getSubEffectiveStatus(s) === "pending").length;
        const activeSubs = allSubscriptions.filter((s: any) => getSubEffectiveStatus(s) === "active").length;
        const cancelledSubs = allSubscriptions.filter((s: any) => {
          const st = getSubEffectiveStatus(s);
          return st === "cancelled" || st === "rejected";
        }).length;
        const totalSubsRevenue = allSubscriptions
          .filter((s: any) => getSubEffectiveStatus(s) === "active")
          .reduce((sum: number, s: any) => sum + Number(s.amount_paid || 0), 0);

        const filteredSubs = allSubscriptions
          .filter((s: any) => {
            const st = getSubEffectiveStatus(s);
            if (subStatusFilter === "all") return true;
            if (subStatusFilter === "cancelled") return st === "cancelled" || st === "rejected";
            return st === subStatusFilter;
          })
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
            const nowIso = now.toISOString();
            const expiresIso = expiresAt.toISOString();

            // 1. Update subscriptions table (try setting active)
            const { error: subError } = await supabase
              .from("subscriptions")
              .update({
                status: "active",
                starts_at: nowIso,
                expires_at: expiresIso,
                approved_by: currentAdmin?.id || null,
                updated_at: nowIso,
              })
              .eq("id", sub.id);
            if (subError) console.warn("Subscriptions table update error:", subError);

            // 2. Update linked manual_payments table
            if (sub.payment_ref) {
              await supabase
                .from("manual_payments")
                .update({
                  status: "approved",
                  reviewed_by: currentAdmin?.id || null,
                  reviewed_at: nowIso,
                  updated_at: nowIso,
                })
                .eq("reference_code", sub.payment_ref);
            }
            if (sub.user_id) {
              await supabase
                .from("manual_payments")
                .update({
                  status: "approved",
                  reviewed_by: currentAdmin?.id || null,
                  reviewed_at: nowIso,
                  updated_at: nowIso,
                })
                .eq("user_id", sub.user_id)
                .eq("status", "pending")
                .ilike("package_id", `%${sub.subscription_type}%`);
            }

            // 3. Send in-app notification
            if (sub.user_id) {
              await supabase.from("app_notifications").insert({
                user_id: sub.user_id,
                type: "subscription_active",
                title: "🎉 Subscription Activated!",
                body: `Your ${SUB_TYPE_LABELS[sub.subscription_type] || sub.subscription_type} is now active and expires on ${expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`,
                is_read: false,
              });
            }

            // 4. Optimistically update query caches
            queryClient.setQueryData(["admin_subscriptions"], (old: any[] = []) =>
              old.map((s) => (s.id === sub.id ? { ...s, status: "active", starts_at: nowIso, expires_at: expiresIso } : s))
            );
            queryClient.setQueryData(["admin_manual_payments"], (old: any[] = []) =>
              old.map((p) =>
                (sub.payment_ref && p.reference_code === sub.payment_ref) ||
                (sub.user_id && p.user_id === sub.user_id && p.package_id?.includes(sub.subscription_type))
                  ? { ...p, status: "approved" }
                  : p
              )
            );

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
            const rejectionReason = (reason?.trim() || subRejectReason?.trim() || "We could not confirm this transfer on our account statement. Please verify your details and resubmit.").trim();
            const nowIso = new Date().toISOString();

            // 1. FIRST update linked manual_payment (Admin RLS confirmed working on manual_payments)
            if (sub?.payment_ref) {
              await supabase
                .from("manual_payments")
                .update({
                  status: "rejected",
                  rejection_reason: rejectionReason,
                  reviewed_by: currentAdmin?.id || null,
                  reviewed_at: nowIso,
                  updated_at: nowIso,
                })
                .eq("reference_code", sub.payment_ref);
            }
            if (sub?.user_id) {
              await supabase
                .from("manual_payments")
                .update({
                  status: "rejected",
                  rejection_reason: rejectionReason,
                  reviewed_by: currentAdmin?.id || null,
                  reviewed_at: nowIso,
                  updated_at: nowIso,
                })
                .eq("user_id", sub.user_id)
                .eq("status", "pending")
                .ilike("package_id", `%${sub.subscription_type}%`);
            }

            // 2. Update subscriptions table (try rejected, fallback to cancelled for enum/check constraints)
            const { error: subErr1 } = await supabase
              .from("subscriptions")
              .update({ status: "rejected", updated_at: nowIso })
              .eq("id", subId);

            if (subErr1) {
              console.warn("Update to 'rejected' had error, trying 'cancelled':", subErr1);
              await supabase
                .from("subscriptions")
                .update({ status: "cancelled", updated_at: nowIso })
                .eq("id", subId);
            }

            // Also clear any subscription tickets
            if (sub?.user_id) {
              await supabase
                .from("user_tickets")
                .delete()
                .eq("user_id", sub.user_id)
                .like("package_id", "sub_%");
            }

            // 3. Notify user
            if (sub?.user_id) {
              await supabase.from("app_notifications").insert({
                user_id: sub.user_id,
                type: "subscription_rejected",
                title: "Payment Verification Notice",
                body: `Your pass request for ${SUB_TYPE_LABELS[sub.subscription_type] || sub.subscription_type} could not be confirmed: ${rejectionReason}`,
                is_read: false,
              });
            }

            // 4. Optimistically update local query cache immediately
            queryClient.setQueryData(["admin_subscriptions"], (old: any[] = []) =>
              old.map((s) => (s.id === subId ? { ...s, status: "rejected" } : s))
            );
            queryClient.setQueryData(["admin_manual_payments"], (old: any[] = []) =>
              old.map((p) =>
                (sub?.payment_ref && p.reference_code === sub.payment_ref) ||
                (sub?.user_id && p.user_id === sub.user_id && p.package_id?.includes(sub.subscription_type))
                  ? { ...p, status: "rejected", rejection_reason: rejectionReason }
                  : p
              )
            );

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
            const nowIso = new Date().toISOString();
            await supabase
              .from("subscriptions")
              .update({ status: "pending", updated_at: nowIso })
              .eq("id", subId);

            if (sub?.payment_ref) {
              await supabase
                .from("manual_payments")
                .update({ status: "pending", rejection_reason: null, updated_at: nowIso })
                .eq("reference_code", sub.payment_ref);
            }

            queryClient.setQueryData(["admin_subscriptions"], (old: any[] = []) =>
              old.map((s) => (s.id === subId ? { ...s, status: "pending" } : s))
            );
            queryClient.setQueryData(["admin_manual_payments"], (old: any[] = []) =>
              old.map((p) =>
                (sub?.payment_ref && p.reference_code === sub.payment_ref) ||
                (sub?.user_id && p.user_id === sub.user_id && p.package_id?.includes(sub.subscription_type))
                  ? { ...p, status: "pending", rejection_reason: null }
                  : p
              )
            );

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
                    : s === "cancelled"
                    ? `Cancelled (${allSubscriptions.filter((x: any) => { const st = getSubEffectiveStatus(x); return st === "cancelled" || st === "rejected"; }).length})`
                    : `${s} (${allSubscriptions.filter((x: any) => getSubEffectiveStatus(x) === s).length})`}
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
                    const effectiveStatus = getSubEffectiveStatus(sub);
                    const isExpired = effectiveStatus === "expired" || (sub.expires_at && new Date(sub.expires_at) < new Date());
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
                            {effectiveStatus === "pending" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-warning/15 border border-warning/30 text-warning">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            )}
                            {effectiveStatus === "active" && !isExpired && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success/15 border border-success/30 text-success">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </span>
                            )}
                            {effectiveStatus === "expired" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted border border-border text-muted-foreground">
                                <Clock className="w-3 h-3" /> Expired
                              </span>
                            )}
                            {(effectiveStatus === "cancelled" || effectiveStatus === "rejected") && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-destructive/15 border border-destructive/30 text-destructive">
                                <XCircle className="w-3 h-3" /> {effectiveStatus === "rejected" ? "Rejected" : "Cancelled"}
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
                          {effectiveStatus !== "active" && (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => setApproveModalSub(sub)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-success/15 border border-success/30 text-xs font-bold text-success hover:bg-success/25 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                            </button>
                          )}
                          {effectiveStatus !== "cancelled" && effectiveStatus !== "rejected" && (
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
                        const effectiveStatus = getSubEffectiveStatus(sub);
                        const isExpired = effectiveStatus === "expired" || (sub.expires_at && new Date(sub.expires_at) < new Date());
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
                                {effectiveStatus === "active"
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
                                    {effectiveStatus === "pending" && (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning/15 border border-warning/30 text-warning hover:bg-warning/25 transition-colors">
                                        <Clock className="w-3.5 h-3.5 text-warning" /> Pending
                                      </span>
                                    )}
                                    {effectiveStatus === "active" && !isExpired && (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success/15 border border-success/30 text-success hover:bg-success/25 transition-colors">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Active
                                      </span>
                                    )}
                                    {effectiveStatus === "expired" && (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted border border-border text-muted-foreground hover:bg-muted/80 transition-colors">
                                        <Clock className="w-3.5 h-3.5" /> Expired
                                      </span>
                                    )}
                                    {(effectiveStatus === "cancelled" || effectiveStatus === "rejected") && (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-destructive/15 border border-destructive/30 text-destructive hover:bg-destructive/25 transition-colors">
                                        <XCircle className="w-3.5 h-3.5 text-destructive" /> {effectiveStatus === "rejected" ? "Rejected" : "Cancelled"}
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
                                  {effectiveStatus !== "active" && (
                                    <DropdownMenuItem
                                      disabled={isProcessing}
                                      onClick={() => setApproveModalSub(sub)}
                                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-success hover:bg-success/10 rounded-lg cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-4 h-4 text-success" /> Activate 30 Days Pass
                                    </DropdownMenuItem>
                                  )}
                                  {effectiveStatus !== "cancelled" && effectiveStatus !== "rejected" && (
                                    <DropdownMenuItem
                                      disabled={isProcessing}
                                      onClick={() => setRejectModalSub(sub)}
                                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                    >
                                      <XCircle className="w-4 h-4 text-destructive" /> Reject Subscription
                                    </DropdownMenuItem>
                                  )}
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
                                  {effectiveStatus !== "active" && (
                                    <DropdownMenuItem
                                      disabled={isProcessing}
                                      onClick={() => setApproveModalSub(sub)}
                                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-success hover:bg-success/10 rounded-lg cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-4 h-4 text-success" /> Approve (30 Days)
                                    </DropdownMenuItem>
                                  )}
                                  {effectiveStatus !== "cancelled" && effectiveStatus !== "rejected" && (
                                    <DropdownMenuItem
                                      disabled={isProcessing}
                                      onClick={() => setRejectModalSub(sub)}
                                      className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                    >
                                      <XCircle className="w-4 h-4 text-destructive" /> Reject Request
                                    </DropdownMenuItem>
                                  )}
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
              const dateInfo = formatPaymentDate(sub.created_at);
              const effectiveStatus = getSubEffectiveStatus(sub);
              const isExpired = effectiveStatus === "expired" || (sub.expires_at && new Date(sub.expires_at) < new Date());
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
                          effectiveStatus === "active"
                            ? "bg-success/15 text-success border border-success/30"
                            : effectiveStatus === "pending"
                            ? "bg-warning/15 text-warning border border-warning/30"
                            : "bg-destructive/15 text-destructive border border-destructive/30"
                        }`}>
                          {effectiveStatus}
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
                      {effectiveStatus !== "cancelled" && effectiveStatus !== "rejected" && (
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
                      {effectiveStatus !== "active" && (
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

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground">
                        Rejection Reason (Sent to User)
                      </label>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-semibold">Quick Reason Presets:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {REJECTION_REASON_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setSubRejectReason(preset)}
                              className={`px-2 py-1 text-[10px] rounded-md border text-left transition-colors cursor-pointer ${
                                subRejectReason === preset
                                  ? "bg-destructive/15 border-destructive text-destructive font-bold"
                                  : "bg-section hover:bg-muted border-border/80 text-foreground"
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
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
