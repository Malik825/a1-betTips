import { useEffect, useState, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Check, X, Ticket, ExternalLink, Clock, RotateCcw, Upload, AlertCircle, Trash2, Camera, ShieldCheck } from "lucide-react";
import { isTicketValidForPackage } from "@/lib/ticket-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard — A1-TIPSDECK" },
      { name: "description", content: "View your purchased VIP packages and booking codes." },
    ],
  }),
  component: DashboardPage,
});

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { bg: string; color: string; label: string; border: string }> = {
    pending:   { bg: "bg-green-100 dark:bg-green-500/10", color: "text-green-700 dark:text-green-500", border: "border-green-200 dark:border-green-500/20", label: "Pending" },
    won:       { bg: "bg-green-100 dark:bg-green-500/10", color: "text-green-800 dark:text-green-500", border: "border-green-200 dark:border-green-500/20", label: "Won" },
    lost:      { bg: "bg-red-100 dark:bg-red-500/10", color: "text-red-800 dark:text-red-500", border: "border-red-200 dark:border-red-500/20", label: "Lost" },
    completed: { bg: "bg-slate-100 dark:bg-slate-700/30", color: "text-slate-500 dark:text-slate-400", border: "border-slate-200 dark:border-slate-600/30", label: "Completed" },
    expired:   { bg: "bg-amber-100 dark:bg-amber-500/10", color: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20", label: "Expired" },
  };
  const s = map[result] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.bg} ${s.color} ${s.border}`}>
      {result === "won" && <Check className="w-3 h-3" strokeWidth={3} />}
      {result === "lost" && <X className="w-3 h-3" strokeWidth={3} />}
      {result === "pending" && <Clock className="w-3 h-3" />}
      {s.label}
    </span>
  );
}

// TOGGLE: Set to true when ready to open recovery claim submissions to customers (e.g. for testing in the evening)
export const RECOVERY_CLAIMS_ENABLED = false;

function DashboardPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Recovery Claim Modal State
  const [claimModalTicket, setClaimModalTicket] = useState<any | null>(null);
  const [senderName, setSenderName] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFriendlyErrorMessage = (err: any) => {
    const msg = err?.message || String(err || "");
    if (msg.includes("schema cache") || msg.includes("recovery_requests") || msg.includes("42P01")) {
      return "The recovery system is currently being configured on the server. Please check back in a moment or contact support.";
    }
    if (err?.code === "23505" || msg.includes("unique") || msg.includes("already submitted")) {
      return "You have already submitted a recovery claim for this spoilt ticket. Your request is under review.";
    }
    if (msg.includes("Bucket not found") || msg.includes("NoSuchBucket")) {
      return "Upload storage is temporarily unavailable. Please try again in a few minutes.";
    }
    if (msg.includes("Failed to upload") || msg.includes("storage")) {
      return "Could not upload the screenshot. Please ensure it is a valid image under 10MB.";
    }
    if (msg.includes("permission") || msg.includes("row-level security") || msg.includes("JWT")) {
      return "Your login session may have expired. Please refresh the page and try again.";
    }
    return msg || "Something went wrong while submitting your claim. Please try again.";
  };

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: "/login", replace: true });
    }
  }, [user, isLoading, navigate]);

  const { data: userTickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["user_tickets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: userPendingPayments = [] } = useQuery({
    queryKey: ["user_manual_payments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("manual_payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch user's recovery requests
  const { data: userRecoveryRequests = [] } = useQuery({
    queryKey: ["user_recovery_requests", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("recovery_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("Could not fetch recovery_requests:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch recovery package status & target settings
  const { data: recoveryPackage } = useQuery({
    queryKey: ["public_recovery_package"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_packages")
        .select("*")
        .eq("id", "recovery")
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  const activePendingPayments = userPendingPayments.filter((p: any) => p.status === "pending");

  const { data: vipPackages = [] } = useQuery({
    queryKey: ["vip_packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("secure_vip_packages").select("id, name, price, availability_status, result_status, booking_code, combined_odds, expires_at, updated_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: vipSelections = [] } = useQuery({
    queryKey: ["vip_package_fixtures"],
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

  const { data: fixtures = [] } = useQuery({
    queryKey: ["fixtures"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fixtures").select("*").limit(10000);
      if (error) throw error;
      return data || [];
    },
  });

  // Prefer joined fixture data, fall back to separate fixtures query
  const resolveFixture = (sel: any) =>
    sel.fixtures ?? fixtures.find((f: any) => f.id === sel.fixture_id) ?? null;

  const displayName = user?.email?.split("@")[0] || "there";

  // Handle Proof File selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be under 10MB");
        return;
      }
      setProofFile(file);
      const url = URL.createObjectURL(file);
      setProofPreview(url);
    }
  };

  // Submit Claim
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimModalTicket || !user) return;
    if (!RECOVERY_CLAIMS_ENABLED) {
      toast.info("Recovery package claims are coming soon and will open later today.");
      setClaimModalTicket(null);
      return;
    }

    if (!senderName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!proofFile) {
      toast.error("Please upload a proof screenshot (slip or payment receipt)");
      return;
    }

    setSubmittingClaim(true);
    setClaimError(null);
    try {
      // 1. Upload file to Supabase storage
      const ext = proofFile.name.split(".").pop() || "png";
      const fileName = `${user.id}/recovery_${claimModalTicket.id}_${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(fileName, proofFile, { upsert: true });

      if (uploadError) {
        throw new Error(uploadError.message || "Failed to upload proof image");
      }

      const { data: urlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(uploadData.path);

      const proofUrl = urlData.publicUrl;

      // 2. Insert into recovery_requests
      const { error: insertError } = await supabase.from("recovery_requests").insert({
        user_id: user.id,
        ticket_id: claimModalTicket.id,
        original_package_id: claimModalTicket.package_id,
        recovery_package_id: "recovery",
        sender_name: senderName.trim(),
        proof_url: proofUrl,
        status: "pending",
      });

      if (insertError) {
        if (insertError.code === "23505") {
          throw new Error("You have already submitted a recovery claim for this ticket.");
        }
        throw new Error(insertError.message || "Failed to submit recovery request");
      }

      toast.success("Recovery request submitted! Admin will verify and open your package shortly.");
      queryClient.invalidateQueries({ queryKey: ["user_recovery_requests"] });
      setClaimModalTicket(null);
      setProofFile(null);
      setProofPreview(null);
      setClaimError(null);
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err);
      setClaimError(friendlyMsg);
      toast.error(friendlyMsg);
    } finally {
      setSubmittingClaim(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors">
      <SiteHeader />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 dark:bg-black py-12 px-6 border-b border-transparent dark:border-white/10">
        <div className="w-[95%] sm:w-[92%] max-w-7xl mx-auto">
          <h1 className="text-[1.8rem] text-white font-extrabold mb-1.5">
            Welcome back, <span className="text-green-500">{displayName}!</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium m-0">
            Your purchased VIP packages, recovery games and booking codes are here.
          </p>
        </div>
      </div>

      <main className="flex-1 w-[95%] sm:w-[92%] max-w-7xl mx-auto py-8 px-5 pb-20">

        {/* ── Pending Manual Payments Banner ──────────────────────────── */}
        {activePendingPayments.length > 0 && (
          <div className="mb-8 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5 mb-2">
              <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white m-0">
                Payment Verification in Progress ({activePendingPayments.length})
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              We received your Mobile Money transfer details. Once confirmed by our admin team (usually within 5-15 minutes), your package access and booking codes will unlock automatically.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activePendingPayments.map((p: any) => {
                const pkg = vipPackages.find((pkgItem: any) => pkgItem.id === p.package_id);
                return (
                  <div key={p.id} className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/20 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">
                        {pkg?.name || p.package_id}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Ref: <strong className="font-mono text-green-600 dark:text-green-400">{p.reference_code}</strong> • GHS {Number(p.amount).toFixed(2)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Pending
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Section title ───────────────────────────────────────────── */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white m-0 flex items-center gap-2.5">
            <Ticket className="w-5 h-5 text-green-500" />
            My Tickets
          </h2>
          <Link to="/predictions" className="text-[11px] font-bold text-green-600 dark:text-green-500 flex items-center gap-1 hover:underline">
            Browse packages <ExternalLink className="w-[13px] h-[13px]" />
          </Link>
        </div>

        {/* ── Empty state ─────────────────────────────────────────────── */}
        {ticketsLoading ? (
          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-14 text-center border border-slate-200 dark:border-white/10 shadow-sm">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium m-0">Loading your tickets...</p>
          </div>
        ) : userTickets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-14 text-center border border-slate-200 dark:border-white/10 shadow-sm">
            <Ticket className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="font-bold text-slate-700 dark:text-slate-200 text-[13px] mb-1.5">No tickets yet</p>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-5">
              Purchase a VIP package and your booking code will appear here.
            </p>
            <Link to="/predictions" className="inline-block py-2.5 px-7 bg-slate-900 dark:bg-green-500 text-white dark:text-black rounded-lg font-bold text-sm transition-colors hover:bg-slate-800 dark:hover:bg-green-600">
              View Packages
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {userTickets.map((ticket) => {
              const isRecoveryTicket = ticket.package_id === "recovery";
              const pkg = vipPackages.find((p) => p.id === ticket.package_id) || (isRecoveryTicket ? { id: "recovery", name: "Recovery Package 🔄", price: 0, booking_code: ticket.booking_code } : null);
              if (!pkg) return null;
              
              const isValidTicket = isRecoveryTicket ? true : isTicketValidForPackage(ticket, pkg);
              // Get selections: if valid batch with selections, use live selections; else use ticket snapshot
              const rawSels = (isValidTicket && vipSelections.filter((s) => s.package_id === pkg.id).length > 0)
                ? vipSelections.filter((s) => s.package_id === pkg.id)
                : (ticket.snapshot || []);

              // Resolve latest live result status for each selection
              const sels = rawSels.map((sel: any) => {
                const live = vipSelections.find((s) => s.id === sel.id || (s.fixture_id && s.fixture_id === sel.fixture_id));
                const status = live?.result_status || sel.result_status || "pending";
                return {
                  ...sel,
                  result_status: status,
                };
              });

              // Compute the true ticket result
              let result = "pending";
              if (sels.length > 0) {
                if (sels.some((s: any) => s.result_status === "lost")) {
                  result = "lost";
                } else if (sels.every((s: any) => s.result_status === "won")) {
                  result = "won";
                } else {
                  result = "pending";
                }
              } else if (!isValidTicket) {
                result = "completed";
              }

              // The booking code the user actually bought (snapshot), falls back to current pkg code if still valid
              const displayBookingCode = ticket.booking_code || (isValidTicket ? pkg.booking_code : null);

              // Check if there is an existing recovery request for this ticket
              const ticketRecovery = userRecoveryRequests.find((r: any) => r.ticket_id === ticket.id);

              // Check if recovery package is currently active & eligible for this ticket's package
              const isRecoveryAvailable =
                recoveryPackage &&
                recoveryPackage.availability_status === "available" &&
                (recoveryPackage.target_packages === "all" ||
                  !recoveryPackage.target_packages ||
                  recoveryPackage.target_packages.split(",").map((s: string) => s.trim()).includes(ticket.package_id));

              return (
                <div key={ticket.id} className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-2xl dark:shadow-black/50 transition-colors">
                  {/* Card top bar */}
                  <div className={`h-1 ${result === "won" ? "bg-green-500" : result === "lost" ? "bg-red-500" : isRecoveryTicket ? "bg-emerald-500" : "bg-green-500"}`} />

                  {/* Header */}
                  <div className="px-7 py-5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/20 flex justify-between items-center flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white m-0">
                          {isRecoveryTicket ? "Recovery VIP Package 🔄" : pkg.name}
                        </h3>
                        {isRecoveryTicket && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            Unlocked via Recovery
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium m-0 mt-1">
                        Purchased: {new Date(ticket.purchased_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <ResultBadge result={result} />
                  </div>

                  <div className="p-7">

                    {/* Booking code */}
                    <div className="mb-7">
                      <div className="p-5 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-500/20">
                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Booking Code</p>
                        {displayBookingCode ? (
                          <p className="text-2xl font-black text-green-800 dark:text-green-400 m-0 font-mono tracking-widest">{displayBookingCode}</p>
                        ) : (
                          <p className="text-[13px] text-slate-400 dark:text-slate-500 m-0">{isValidTicket ? "Not set yet" : "This package has been updated — your booking code was for the previous batch."}</p>
                        )}
                      </div>
                    </div>

                    {/* Selections table */}
                    <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3.5">
                      Selections ({sels.length})
                    </h4>

                    <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-transparent">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-black/40 text-left border-b border-slate-200 dark:border-white/10">
                              <th className="p-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400">Match</th>
                              <th className="p-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400">Prediction</th>
                              <th className="p-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 text-right">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sels.map((sel: any, i: number) => {
                              const fix = resolveFixture(sel);
                              const matchLabel = sel.match || (fix ? `${fix.home_team} vs ${fix.away_team}` : "—");
                              const compLabel = sel.competition || fix?.competition || "";
                              const timeLabel = sel.match_time || fix?.match_time || "";
                              return (
                                <tr key={sel.id} className={`${i < sels.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''}`}>
                                  <td className="p-3.5 text-[12px] font-semibold text-slate-900 dark:text-slate-200">
                                    {matchLabel}
                                    {(compLabel || timeLabel) && <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">{compLabel}{compLabel && timeLabel ? " • " : ""}{timeLabel}</div>}
                                  </td>
                                  <td className="p-3.5 text-[12px] font-bold text-green-600 dark:text-green-500">
                                    {sel.prediction}
                                  </td>
                                  <td className="p-3.5 text-right">
                                    <ResultBadge result={sel.result_status || "completed"} />
                                  </td>
                                </tr>
                              );
                            })}
                            {sels.length === 0 && (
                              <tr>
                                <td colSpan={4} className="p-5 text-center text-slate-400 dark:text-slate-500 text-[12px]">
                                  Selections will appear here once added.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ── RECOVERY BOX (For Lost/Spoilt Games) ────────────────── */}
                    {result === "lost" && !isRecoveryTicket && (
                      <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
                        {ticketRecovery?.status === "pending" ? (
                          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-900 dark:text-amber-200 animate-in fade-in">
                            <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <p className="font-extrabold text-xs m-0">Recovery Verification in Progress</p>
                              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 m-0 mt-1">
                                We received your recovery proof. Our admin team will verify it shortly, and your replacement recovery package will unlock automatically in your dashboard.
                              </p>
                            </div>
                          </div>
                        ) : ticketRecovery?.status === "approved" ? (
                          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 flex items-start gap-3 text-green-900 dark:text-green-200 animate-in fade-in">
                            <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-extrabold text-xs m-0">Recovery Claim Verified & Opened</p>
                              <p className="text-[11px] text-green-800/80 dark:text-green-300/80 m-0 mt-1">
                                Your proof was confirmed. Your Recovery VIP Package has been opened above with active predictions and booking code.
                              </p>
                            </div>
                          </div>
                        ) : ticketRecovery?.status === "rejected" ? (
                          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-900 dark:text-red-200 animate-in fade-in">
                            <X className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-extrabold text-xs m-0">Recovery Request Declined</p>
                              <p className="text-[11px] text-red-800/80 dark:text-red-300/80 m-0 mt-1">
                                Reason: {ticketRecovery.rejection_reason || "Unable to verify previous purchase slip or payment details."}
                              </p>
                            </div>
                          </div>
                        ) : !RECOVERY_CLAIMS_ENABLED ? (
                          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 animate-in fade-in">
                            <div className="flex items-start gap-3">
                              <RotateCcw className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-extrabold text-xs m-0">Game Spoilt? Free Recovery Package</p>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                    Coming Soon
                                  </span>
                                </div>
                                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 m-0 mt-1">
                                  Our replacement recovery claim system is being finalized. Free replacement claims for spoilt games will open later today.
                                </p>
                              </div>
                            </div>
                            <span className="w-full sm:w-auto px-4 py-2 bg-slate-200/60 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 rounded-lg font-bold text-xs shrink-0 text-center cursor-not-allowed">
                              Claims Opening Soon
                            </span>
                          </div>
                        ) : isRecoveryAvailable ? (
                          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-emerald-900 dark:text-emerald-200 animate-in fade-in">
                            <div className="flex items-start gap-3">
                              <RotateCcw className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-extrabold text-xs m-0">Game Spoilt? Free Recovery Available 🔄</p>
                                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 m-0 mt-1">
                                  You are eligible for a replacement recovery game. Upload your purchase proof to submit for admin confirmation.
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setClaimModalTicket(ticket);
                                setSenderName(user?.user_metadata?.full_name || displayName);
                                setClaimError(null);
                              }}
                              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                              <Upload size={14} /> Claim Recovery Package
                            </button>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-3 text-slate-500 dark:text-slate-400">
                            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                            <p className="text-xs font-semibold m-0">
                              There is no recovery package available for this game at the moment.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── CLAIM RECOVERY MODAL ─────────────────────────────────────── */}
      {claimModalTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !submittingClaim && setClaimModalTicket(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-black/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <RotateCcw size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white m-0">
                    Claim Recovery Package
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0">
                    Upload your proof to unlock today's recovery game
                  </p>
                </div>
              </div>
              <button
                disabled={submittingClaim}
                onClick={() => setClaimModalTicket(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer border-none bg-transparent"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitClaim} className="p-6 flex flex-col gap-4">
              
              {/* Error banner if any */}
              {claimError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-red-600 dark:text-red-400 text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <div className="flex-1">
                    <p className="font-bold m-0">{claimError}</p>
                  </div>
                </div>
              )}

              {/* Spoilt Ticket Info Banner */}
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold block">
                    Spoilt VIP Package
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {vipPackages.find((p) => p.id === claimModalTicket.package_id)?.name || claimModalTicket.package_id}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold block">
                    Purchase Date
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {new Date(claimModalTicket.purchased_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>

              {/* Sender Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Your Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>



              {/* Proof Screenshot Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Upload Proof Screenshot <span className="text-red-500">*</span>
                </label>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!proofPreview ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-white/20 rounded-xl p-5 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-500/5 transition-all flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Camera size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 m-0">
                        Click to upload slip or payment screenshot
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 m-0">
                        PNG, JPG, WEBP up to 10MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/40 p-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={proofPreview}
                        alt="Proof preview"
                        className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-white/10"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px] m-0">
                          {proofFile?.name}
                        </p>
                        <p className="text-[10px] text-slate-400 m-0">
                          {((proofFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB • Ready
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProofFile(null);
                        setProofPreview(null);
                      }}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer border-none bg-transparent"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>



              <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0">
                🔒 Works once per spoilt ticket. Opens once confirmed by admin.
              </p>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/5 mt-2">
                <button
                  type="button"
                  disabled={submittingClaim}
                  onClick={() => setClaimModalTicket(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingClaim}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer border-none flex items-center gap-2 disabled:opacity-60"
                >
                  {submittingClaim ? (
                    <>
                      <Clock size={14} className="animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Submit Proof for Verification
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
