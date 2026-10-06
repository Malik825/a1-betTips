import React, { useState, useEffect, useRef } from "react";
import {
  X, Check, Copy, Clock, ShieldCheck, Smartphone,
  ArrowRight, Loader2, BadgeCheck, Upload, ImageIcon, Lock, AlertCircle,
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

// ── Merchant config ──────────────────────────────────────────
const MERCHANTS = {
  ghana: {
    id: "ghana",
    label: "Ghana",
    flag: "🇬🇭",
    currency: "GHS",
    symbol: "GHS",
    network: "MTN Mobile Money",
    networkColor: "#f59e0b",        // MTN yellow
    networkBg: "rgba(245,158,11,0.12)",
  },
  nigeria: {
    id: "nigeria",
    label: "Nigeria",
    flag: "🇳🇬",
    currency: "NGN",
    symbol: "₦",
    number: "6719402828",
    name: "Wizzy Brand (Esoroibe Wisdom Ifeanyi)",
    network: "Moniepoint MFB",
    networkColor: "#7c3aed",        // purple for Moniepoint
    networkBg: "rgba(124,58,237,0.12)",
  },
} as const;

type MerchantKey = keyof typeof MERCHANTS;

export function ManualPaymentModal({ isOpen, onClose, pkg }: ManualPaymentModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeMerchant, setActiveMerchant] = useState<MerchantKey>("ghana");
  const [senderName, setSenderName] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Ghana merchant details from admin settings (DB-configurable)
  const { data: adminSettings } = useQuery({
    queryKey: ["public_admin_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("momo_number, momo_name, momo_network, momo_instructions")
        .eq("id", 1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") console.warn("Settings fetch:", error.message);
      return data;
    },
  });

  // Live GHS → NGN exchange rate
  const { data: exchangeRate } = useQuery({
    queryKey: ["ghs_ngn_rate"],
    queryFn: async () => {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/GHS");
        const json = await res.json();
        return (json?.rates?.NGN as number) || null;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 30, // cache for 30 min
  });

  const ghanaNumber  = adminSettings?.momo_number  || "0597489841";
  const ghanaName    = adminSettings?.momo_name    || "YAW ASAFO";
  const ghanaNetwork = adminSettings?.momo_network || "MTN Mobile Money";

  const priceGHS = Number(pkg?.price ?? 0);
  const priceNGN = exchangeRate ? Math.ceil(priceGHS * exchangeRate) : null;

  // Active merchant details
  const merchant = MERCHANTS[activeMerchant];
  const accountNumber = activeMerchant === "ghana" ? ghanaNumber : MERCHANTS.nigeria.number;
  const accountName   = activeMerchant === "ghana" ? ghanaName   : MERCHANTS.nigeria.name;
  const networkLabel  = activeMerchant === "ghana" ? ghanaNetwork : MERCHANTS.nigeria.network;
  const displayAmount = activeMerchant === "ghana"
    ? `GHS ${priceGHS.toFixed(2)}`
    : priceNGN !== null
      ? `₦${priceNGN.toLocaleString()}`
      : "Loading…";

  useEffect(() => {
    if (isOpen && pkg) {
      setSubmittedSuccess(false);
      setActiveMerchant("ghana");
      setSenderName(user?.user_metadata?.full_name || "");
      setTransactionId("");
      setProofFile(null);
      setProofPreview(null);
    }
  }, [isOpen, pkg?.id]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file."); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error("Max file size is 5MB.");          return; }
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setProofPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const submitPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in to continue.");
      if (!pkg)  throw new Error("No package selected.");
      if (!senderName.trim()) throw new Error("Please enter your full name.");
      if (!proofFile)
        throw new Error("Please upload a payment screenshot.");

      let proofUrl: string | null = null;
      if (proofFile) {
        const ext  = proofFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { data: up, error: upErr } = await supabase.storage
          .from("payment-proofs")
          .upload(path, proofFile, { upsert: false });
        if (!upErr && up) {
          const { data: urlData } = supabase.storage
            .from("payment-proofs")
            .getPublicUrl(up.path);
          proofUrl = urlData?.publicUrl || null;
        }
      }

      const amountPaid = activeMerchant === "nigeria" && priceNGN !== null ? priceNGN : priceGHS;

      const { error } = await supabase.from("manual_payments").insert({
        user_id:        user.id,
        package_id:     pkg.id,
        amount:         priceGHS,            // always store in GHS for consistency
        sender_name:    senderName.trim(),
        transaction_id: transactionId.trim() || null,
        network:        `${merchant.flag} ${networkLabel} (${activeMerchant === "nigeria" ? `₦${amountPaid.toLocaleString()}` : `GHS ${priceGHS.toFixed(2)}`})`,
        proof_url:      proofUrl,
        status:         "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_manual_payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] });
      setSubmittedSuccess(true);
    },
    onError: (err: any) => toast.error(err.message || "Submission failed. Try again."),
  });

  if (!isOpen || !pkg) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-end"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", animation: "fadeInOverlay 0.2s ease" }}
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="relative flex flex-col w-full sm:max-w-[820px] bg-white dark:bg-[#0e1117] shadow-2xl"
        style={{ animation: "slideInRight 0.3s cubic-bezier(0.32,0.72,0,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#0e1117] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">Complete Your Purchase</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Pay via Mobile Money · Verified within 15 minutes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {submittedSuccess ? (
            /* SUCCESS */
            <div className="flex flex-col items-center justify-center min-h-full p-10 text-center gap-6">
              <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-500/15 border-4 border-green-500/30 flex items-center justify-center">
                <BadgeCheck className="w-12 h-12 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Payment Submitted!</h3>
                <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">
                  Your payment for <strong className="text-slate-800 dark:text-slate-200">{pkg.name}</strong> is under review.
                  Access unlocks automatically once confirmed.
                </p>
              </div>
              <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="bg-slate-50 dark:bg-white/5 px-5 py-3 border-b border-slate-200 dark:border-white/10">
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Receipt</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  <ReceiptRow label="Package"   value={pkg.name} />
                  <ReceiptRow label="Amount (GHS)" value={`GHS ${priceGHS.toFixed(2)}`} />
                  {activeMerchant === "nigeria" && priceNGN && (
                    <ReceiptRow label="Amount (NGN)" value={`₦${priceNGN.toLocaleString()}`} valueClass="font-bold text-purple-600 dark:text-purple-400" />
                  )}
                  <ReceiptRow label="Name"     value={senderName} valueClass="font-semibold text-slate-900 dark:text-slate-100" />
                  <ReceiptRow label="Status"    value="Pending · 5–15 min" valueClass="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1" icon={<Clock className="w-3.5 h-3.5" />} />
                </div>
              </div>
              <div className="flex gap-3 w-full max-w-sm">
                <button
                  onClick={() => { onClose(); navigate({ to: "/dashboard" }); }}
                  className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-500/20"
                >
                  Go to Dashboard <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={onClose} className="px-5 py-3.5 rounded-xl border border-slate-200 dark:border-white/15 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 min-h-full">

              {/* ── LEFT: Merchant Info ── */}
              <div className="bg-slate-900 text-white flex flex-col p-7 gap-5">

                {/* Package & price */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">You're buying</p>
                  <h3 className="text-lg font-black text-white leading-tight">{pkg.name}</h3>
                  {pkg.combined_odds && (
                    <p className="text-xs text-slate-400 mt-0.5">Odds: <span className="font-bold text-white">{Number(pkg.combined_odds).toFixed(2)}</span></p>
                  )}
                </div>

                {/* Merchant toggle */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Pay via</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["ghana", "nigeria"] as MerchantKey[]).map((key) => {
                      const m = MERCHANTS[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveMerchant(key)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all text-sm font-bold ${
                            activeMerchant === key
                              ? "bg-white text-slate-900 border-white shadow-lg"
                              : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span className="text-lg">{m.flag}</span>
                          <div>
                            <div className="font-black text-xs leading-tight">{m.label}</div>
                            <div className={`text-[10px] font-normal ${activeMerchant === key ? "text-slate-500" : "text-slate-600"}`}>{m.currency}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount */}
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">Amount to send</span>
                  <div className="text-right">
                    <div className="text-2xl font-black text-green-400">{displayAmount}</div>
                    {activeMerchant === "nigeria" && priceNGN && exchangeRate && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Rate: 1 GHS ≈ ₦{exchangeRate.toFixed(1)}
                      </div>
                    )}
                    {activeMerchant === "nigeria" && !priceNGN && (
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Fetching rate…
                      </div>
                    )}
                  </div>
                </div>

                {/* Account details */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Send payment to</p>

                  {/* Network badge */}
                  <div
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 border text-xs font-black"
                    style={{ background: MERCHANTS[activeMerchant].networkBg, borderColor: `${MERCHANTS[activeMerchant].networkColor}40`, color: MERCHANTS[activeMerchant].networkColor }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: MERCHANTS[activeMerchant].networkColor }} />
                    {networkLabel}
                  </div>

                  {/* Account card */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                    {/* Number */}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">
                          {activeMerchant === "ghana" ? "MoMo Number" : "Account Number"}
                        </p>
                        <span className="text-2xl font-black tracking-widest font-mono text-white">{accountNumber}</span>
                      </div>
                      <CopyBtn text={accountNumber} label={activeMerchant === "ghana" ? "MoMo number" : "Account number"} copiedField={copiedField} onCopy={copy} />
                    </div>

                    {/* Name */}
                    <div className="flex items-center justify-between border-t border-white/10 pt-4 gap-3">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Account Name</p>
                        <span className="text-sm font-bold text-white">{accountName}</span>
                      </div>
                      <CopyBtn text={accountName} label="Account name" copiedField={copiedField} onCopy={copy} />
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-2 text-[11px] text-slate-500">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  Verified by our team within 15 minutes
                </div>
              </div>

              {/* ── RIGHT: Proof Form ── */}
              <div className="bg-slate-50 dark:bg-[#0e1117] flex flex-col p-7 border-l border-slate-200 dark:border-white/10">
                <div className="mb-5">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Submit Your Proof</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    After sending, enter your name and upload a screenshot.
                  </p>
                </div>

                <form
                  onSubmit={(e) => { e.preventDefault(); submitPaymentMutation.mutate(); }}
                  className="flex flex-col flex-1 gap-4"
                >
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text" required
                      placeholder="Your name as it appears on your MoMo account"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-xl border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-green-500 placeholder:text-slate-400 transition-colors"
                    />
                  </div>

                  {/* Transaction ID */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Transaction / Session ID
                      <span className="text-slate-400 font-normal ml-1">(From SMS — Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TRF2938472910"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-xl border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:border-green-500 placeholder:text-slate-400 transition-colors"
                    />
                  </div>

                  {/* Screenshot */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Payment Screenshot <span className="text-red-500">*</span>
                    </label>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

                    {proofPreview ? (
                      <div className="relative rounded-xl overflow-hidden border-2 border-green-500 group">
                        <img src={proofPreview} alt="Payment proof" className="w-full max-h-40 object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button type="button" onClick={() => { setProofFile(null); setProofPreview(null); }}
                            className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Remove</button>
                        </div>
                        <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                          <Check className="w-3 h-3" /> Uploaded
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`rounded-xl border-2 border-dashed cursor-pointer transition-all p-5 flex flex-col items-center gap-2 text-center ${
                          isDragging
                            ? "border-green-500 bg-green-50 dark:bg-green-500/10"
                            : "border-slate-200 dark:border-white/10 hover:border-green-400 bg-white dark:bg-white/5 hover:bg-green-50/50"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDragging ? "bg-green-500" : "bg-slate-100 dark:bg-white/10"}`}>
                          {isDragging ? <Upload className="w-4 h-4 text-white" /> : <ImageIcon className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{isDragging ? "Drop here" : "Upload screenshot"}</p>
                          <p className="text-xs text-slate-400 mt-0.5">Drag & drop or click · Max 5MB</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Alert */}
                  <div className="flex gap-2.5 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>Make sure the <strong>sender name</strong> on your screenshot matches the name you entered above. We verify payments using your name and proof image.</span>
                  </div>

                  {/* Submit */}
                  <div className="mt-auto pt-1">
                    <button
                      type="submit"
                      disabled={submitPaymentMutation.isPending}
                      className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2.5 transition-colors shadow-xl shadow-green-500/20 cursor-pointer"
                    >
                      {submitPaymentMutation.isPending
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                        : <><ShieldCheck className="w-4 h-4" /> I've Paid — Submit for Verification</>}
                    </button>
                    <p className="text-[11px] text-center text-slate-400 mt-2">
                      🔒 Payments verified within 15 minutes. Access unlocks automatically.
                    </p>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight  { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}

/* ── Shared sub-components ── */
function CopyBtn({ text, label, copiedField, onCopy, variant = "default" }: {
  text: string; label: string; copiedField: string | null;
  onCopy: (t: string, l: string) => void; variant?: "default" | "green";
}) {
  const active = copiedField === label;
  const greenCls = active ? "bg-green-500 text-black" : "bg-green-500 hover:bg-green-400 text-black";
  const defCls   = active ? "bg-green-500 text-black" : "bg-white/10 hover:bg-white/20 text-slate-300 border border-white/10";
  return (
    <button type="button" onClick={() => onCopy(text, label)}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${variant === "green" ? greenCls : defCls}`}>
      {active ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {active ? "Copied" : "Copy"}
    </button>
  );
}

function ReceiptRow({ label, value, icon, valueClass = "font-semibold text-slate-900 dark:text-slate-100" }: {
  label: string; value: string; icon?: React.ReactNode; valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`flex items-center gap-1 ${valueClass}`}>{icon}{value}</span>
    </div>
  );
}
