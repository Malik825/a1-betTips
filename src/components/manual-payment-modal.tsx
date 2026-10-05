import React, { useState, useEffect } from "react";
import { 
  X, Check, Copy, Clock, ShieldCheck, AlertCircle, Smartphone, 
  ArrowRight, ExternalLink, Loader2 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

interface ManualPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: {
    id: string;
    name: string;
    price: number | string;
    combined_odds?: number | null;
  } | null;
}

export function ManualPaymentModal({ isOpen, onClose, pkg }: ManualPaymentModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [senderPhone, setSenderPhone] = useState("");
  const [senderName, setSenderName] = useState("");
  const [network, setNetwork] = useState("MTN Mobile Money");
  const [transactionId, setTransactionId] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Fetch admin MoMo settings
  const { data: adminSettings } = useQuery({
    queryKey: ["public_admin_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("momo_number, momo_name, momo_network, momo_instructions, manual_payment_enabled")
        .eq("id", 1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.warn("Could not fetch admin settings:", error.message);
      }
      return data;
    },
  });

  const momoNumber = adminSettings?.momo_number || "0550000000";
  const momoName = adminSettings?.momo_name || "A1 Predictions";
  const momoNetwork = adminSettings?.momo_network || "MTN Mobile Money";
  const momoInstructions = adminSettings?.momo_instructions;

  // Generate a random human-friendly reference code when modal opens for a package
  useEffect(() => {
    if (isOpen && pkg) {
      setSubmittedSuccess(false);
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "A1-";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setReferenceCode(code);
      setSenderPhone("");
      setSenderName(user?.user_metadata?.full_name || "");
      setTransactionId("");
    }
  }, [isOpen, pkg?.id]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const submitPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in to submit a payment.");
      if (!pkg) throw new Error("No package selected.");
      if (!senderPhone.trim()) throw new Error("Please provide your sender MoMo phone number.");
      if (!senderName.trim()) throw new Error("Please provide your MoMo account/sender name.");

      const payload = {
        user_id: user.id,
        package_id: pkg.id,
        amount: Number(pkg.price),
        sender_phone: senderPhone.trim(),
        sender_name: senderName.trim(),
        reference_code: referenceCode,
        transaction_id: transactionId.trim() || null,
        network,
        status: "pending",
      };

      const { error } = await supabase.from("manual_payments").insert(payload);
      if (error) {
        // Handle case where table or columns might differ
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_manual_payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] });
      setSubmittedSuccess(true);
      toast.success("Payment submitted for verification!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit payment. Please try again.");
    },
  });

  if (!isOpen || !pkg) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">Mobile Money Direct Payment</h3>
              <p className="text-xs text-slate-400">Manual verification • No bank card needed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 dark:text-slate-200">
          
          {submittedSuccess ? (
            /* Success / Confirmation State */
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/10 border-2 border-green-500/30 text-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-500/10">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <div>
                <h4 className="text-xl font-extrabold text-slate-900 dark:text-white mb-1">
                  Payment Submitted!
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                  Your payment for <strong className="text-slate-900 dark:text-white">{pkg.name}</strong> has been received and is pending verification.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-left max-w-sm mx-auto space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Reference Code:</span>
                  <span className="font-mono font-bold text-green-600 dark:text-green-400">{referenceCode}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Amount:</span>
                  <span className="font-bold text-slate-900 dark:text-white">GHS {Number(pkg.price).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Sender Phone:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{senderPhone}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400">Status:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-[11px] text-amber-500">
                    <Clock className="w-3 h-3" /> Under Review (5-15 mins)
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-400 max-w-sm mx-auto flex items-start gap-2 text-left">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  Our team confirms transactions promptly. Once verified, your VIP access and booking codes will unlock automatically on your Dashboard.
                </span>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
                <button
                  onClick={() => {
                    onClose();
                    navigate({ to: "/dashboard" });
                  }}
                  className="flex-1 py-2.5 px-4 bg-green-500 hover:bg-green-600 text-black font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                >
                  Go to Dashboard <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Payment Steps & Form */
            <>
              {/* Package Summary Card */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-extrabold tracking-wider text-green-600 dark:text-green-400">Selected Package</span>
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white leading-tight">{pkg.name}</h4>
                  {pkg.combined_odds && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Combined Odds: <strong className="text-slate-700 dark:text-slate-300">{Number(pkg.combined_odds).toFixed(2)}</strong>
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Total to Pay</span>
                  <span className="text-xl font-black text-green-600 dark:text-green-400">
                    GHS {Number(pkg.price).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Step 1: Send Money Box */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-green-500 dark:text-black flex items-center justify-center text-[10px] font-black">1</span>
                  Send Payment via Mobile Money
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white p-4 rounded-xl border border-white/10 shadow-md space-y-3">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                    <span className="text-xs text-slate-400">Network</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                      {momoNetwork}
                    </span>
                  </div>

                  {/* MoMo Number */}
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-slate-400 block">MoMo Number</span>
                      <span className="font-mono text-lg font-bold text-white tracking-wide">{momoNumber}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(momoNumber, "MoMo Number")}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors border border-white/10"
                    >
                      {copiedField === "MoMo Number" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedField === "MoMo Number" ? "Copied" : "Copy"}
                    </button>
                  </div>

                  {/* MoMo Account Name */}
                  <div className="flex justify-between items-center border-t border-white/10 pt-2.5">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Account Name</span>
                      <span className="text-sm font-semibold text-slate-200">{momoName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(momoName, "Account Name")}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors border border-white/10"
                    >
                      {copiedField === "Account Name" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedField === "Account Name" ? "Copied" : "Copy"}
                    </button>
                  </div>

                  {/* Reference to include */}
                  <div className="flex justify-between items-center border-t border-white/10 pt-2.5 bg-green-500/10 -mx-4 -mb-4 p-3.5 rounded-b-xl border border-green-500/20">
                    <div>
                      <span className="text-[11px] text-green-300 font-bold block">Use this Reference Note</span>
                      <span className="font-mono text-base font-extrabold text-green-400 tracking-wider">{referenceCode}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(referenceCode, "Reference")}
                      className="px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-xs font-bold text-slate-950 flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      {copiedField === "Reference" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedField === "Reference" ? "Copied" : "Copy Ref"}
                    </button>
                  </div>
                </div>

                {momoInstructions && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                    {momoInstructions}
                  </p>
                )}
              </div>

              {/* Step 2: Verification Form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  submitPaymentMutation.mutate();
                }} 
                className="space-y-3 pt-2"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white dark:bg-green-500 dark:text-black flex items-center justify-center text-[10px] font-black">2</span>
                  Submit Your Payment Details
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Your MoMo Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0551234567"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Sender Name on Account <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kwame Mensah"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Network Sent From
                    </label>
                    <select
                      value={network}
                      onChange={(e) => setNetwork(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="MTN Mobile Money">MTN Mobile Money</option>
                      <option value="Telecel Cash">Telecel Cash</option>
                      <option value="AT Money">AirtelTigo / AT Money</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Transaction ID (From SMS) <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2938472910"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitPaymentMutation.isPending}
                    className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-black font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitPaymentMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting payment...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        I Have Sent Payment — Submit for Verification
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2">
                    🔒 Our team verifies incoming MoMo payments within minutes.
                  </p>
                </div>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
