import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Check, Copy, Clock, ShieldCheck, Smartphone,
  ArrowRight, Loader2, BadgeCheck, Upload, ImageIcon,
  Lock, AlertCircle, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    pkgId: (search.pkgId as string) || "",
  }),
  head: () => ({
    meta: [
      { title: "Checkout — A1-TIPSDECK" },
      { name: "description", content: "Complete your purchase securely via Mobile Money." },
    ],
  }),
  component: CheckoutPage,
});

// ── Merchant config ──────────────────────────────────────────────────────────
const MERCHANTS = {
  ghana: {
    id: "ghana" as const,
    label: "Ghana",
    flag: "🇬🇭",
    currency: "GHS",
    network: "MTN Mobile Money",
    networkColor: "#f59e0b",
    networkBg: "rgba(245,158,11,0.10)",
  },
  nigeria: {
    id: "nigeria" as const,
    label: "Nigeria",
    flag: "🇳🇬",
    currency: "NGN",
    number: "6719402828",
    name: "Wizzy Brand (Esoroibe Wisdom Ifeanyi)",
    network: "Moniepoint MFB",
    networkColor: "#7c3aed",
    networkBg: "rgba(124,58,237,0.10)",
  },
} as const;
type MerchantKey = keyof typeof MERCHANTS;

// ── Page ─────────────────────────────────────────────────────────────────────
function CheckoutPage() {
  const { pkgId } = useSearch({ from: "/checkout" });
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeMerchant, setActiveMerchant] = useState<MerchantKey>("ghana");
  const [senderName, setSenderName] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [success, setSuccess] = useState(false);

  // Redirect to login if not authenticated (wait until auth finishes loading)
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
    if (pkgId === "recovery") navigate({ to: "/dashboard" });
  }, [user, authLoading, pkgId, navigate]);

  useEffect(() => {
    if (user?.user_metadata?.full_name) setSenderName(user.user_metadata.full_name);
  }, [user]);

  // Local subscription package config (covers all game packages in the system)
  const SUBSCRIPTION_PACKAGES: Record<string, { id: string; name: string; price: number }> = {
    sub_all_access:   { id: "sub_all_access",   name: "All-Access VIP Monthly Pass",          price: 350 },
    sub_supreme_vvip: { id: "sub_supreme_vvip", name: "Supreme VVIP Monthly Pass 👑",        price: 280 },
    sub_supreme:      { id: "sub_supreme",      name: "Supreme VVIP Monthly Pass 👑",        price: 280 },
    sub_vvip_combo:   { id: "sub_vvip_combo",   name: "VVIP Combo Monthly Pass (VVIP 1 & 2)", price: 220 },
    sub_vip_combo:    { id: "sub_vip_combo",    name: "VIP Combo Monthly Pass (VIP 1 & 2)",   price: 120 },
    sub_vip_1:        { id: "sub_vip_1",        name: "VIP 1 Monthly Pass",                   price: 70  },
    sub_vip_2:        { id: "sub_vip_2",        name: "VIP 2 Monthly Pass",                   price: 70  },
    sub_vvip_1:       { id: "sub_vvip_1",       name: "VVIP 1 Monthly Pass",                  price: 130 },
    sub_vvip_2:       { id: "sub_vvip_2",       name: "VVIP 2 Monthly Pass",                  price: 130 },
    // Backwards compatibility for legacy plans
    sub_silver:       { id: "sub_silver",       name: "Silver VIP Monthly Subscription",      price: 100 },
    sub_gold:         { id: "sub_gold",         name: "Gold VIP Monthly Subscription",        price: 180 },
    sub_platinum:     { id: "sub_platinum",     name: "Platinum VIP Monthly Subscription",    price: 250 },
    sub_vip1:         { id: "sub_vip1",         name: "VIP 1 Monthly Subscription",           price: 70  },
    sub_vip2:         { id: "sub_vip2",         name: "VIP 2 Monthly Subscription",           price: 70  },
    sub_vip3:         { id: "sub_vip3",         name: "VIP 3 Monthly Subscription",           price: 70  },
  };
  const isSubscription = pkgId?.startsWith("sub_");

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: pkg, isLoading: pkgLoading } = useQuery({
    queryKey: ["checkout_pkg", pkgId],
    queryFn: async () => {
      if (!pkgId) return null;
      // Subscription packages: query dynamic admin-configured price first
      if (isSubscription) {
        try {
          const { data: dbSubPlan } = await supabase
            .from("subscription_plans")
            .select("id, name, price")
            .eq("id", pkgId)
            .maybeSingle();
          if (dbSubPlan) {
            return {
              id: dbSubPlan.id,
              name: dbSubPlan.name,
              price: Number(dbSubPlan.price),
            };
          }
        } catch (e) {
          console.warn("Could not load dynamic subscription plan, using fallback:", e);
        }
        return SUBSCRIPTION_PACKAGES[pkgId] ?? null;
      }
      const { data, error } = await supabase
        .from("secure_vip_packages")
        .select("id, name, price, combined_odds")
        .eq("id", pkgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!pkgId,
  });

  const { data: adminSettings } = useQuery({
    queryKey: ["public_admin_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("momo_number, momo_name, momo_network, momo_instructions")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
  });

  // Fixed GHS → NGN conversion rate
  const exchangeRate = 115;

  // ── Derived values ────────────────────────────────────────────────────────
  const ghanaNumber = adminSettings?.momo_number || "0597489841";
  const ghanaName = adminSettings?.momo_name || "YAW ASAFO";
  const ghanaNetwork = adminSettings?.momo_network || "MTN Mobile Money";

  const priceGHS = Number(pkg?.price ?? 0);
  const priceNGN = exchangeRate ? Math.ceil(priceGHS * exchangeRate) : null;

  const accountNumber = activeMerchant === "ghana" ? ghanaNumber : MERCHANTS.nigeria.number;
  const accountName = activeMerchant === "ghana" ? ghanaName : MERCHANTS.nigeria.name;
  const networkLabel = activeMerchant === "ghana" ? ghanaNetwork : MERCHANTS.nigeria.network;

  const displayAmount = activeMerchant === "ghana"
    ? `GHS ${priceGHS.toFixed(2)}`
    : `₦${priceNGN?.toLocaleString() ?? "…"}`;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max file size is 5 MB."); return; }
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setProofPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in to continue.");
      if (!pkg) throw new Error("Package not found.");
      if (!senderName.trim()) throw new Error("Please enter your full name.");
      if (!proofFile)
        throw new Error("Please upload a payment screenshot.");

      let proofUrl: string | null = null;
      if (proofFile) {
        const ext = proofFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { data: up, error: upErr } = await supabase.storage
          .from("payment-proofs")
          .upload(path, proofFile, { upsert: false });
        if (upErr || !up) {
          console.error("Storage upload error:", upErr);
          throw new Error(upErr?.message ? `Failed to upload screenshot: ${upErr.message}` : "Failed to upload screenshot.");
        }
        const { data: urlData } = supabase.storage
          .from("payment-proofs")
          .getPublicUrl(up.path);
        proofUrl = urlData?.publicUrl || null;
      }

      if (!proofUrl) {
        throw new Error("Payment screenshot is required to complete submission.");
      }

      const amountPaid = activeMerchant === "nigeria" && priceNGN ? priceNGN : priceGHS;
      const refCode = `MOMO-${Date.now().toString(36).toUpperCase()}`;

      // Always insert into manual_payments so admin sees it in the payments tab
      const { error } = await supabase.from("manual_payments").insert({
        user_id: user.id,
        package_id: pkg.id,
        amount: priceGHS,
        sender_name: senderName.trim(),
        sender_phone: "N/A",
        reference_code: refCode,
        transaction_id: null,
        network: `${MERCHANTS[activeMerchant].flag} ${networkLabel} (${activeMerchant === "nigeria" ? `₦${amountPaid.toLocaleString()}` : `GHS ${priceGHS.toFixed(2)}`})`,
        proof_url: proofUrl,
        status: "pending",
      });
      if (error) throw error;

      // For subscription packages, also create a subscriptions row
      if (isSubscription) {
        const subscriptionType = pkgId.replace("sub_", ""); // e.g. "sub_all_access" → "all_access"
        const { error: subError } = await supabase.from("subscriptions").insert({
          user_id: user.id,
          subscription_type: subscriptionType,
          status: "pending",
          amount_paid: priceGHS,
          payment_ref: refCode,
          proof_url: proofUrl,
        });
        if (subError) console.warn("Could not create subscription row:", subError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_manual_payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin_manual_payments"] });
      queryClient.invalidateQueries({ queryKey: ["user_subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin_subscriptions"] });
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err: any) => toast.error(err.message || "Submission failed. Please try again."),
  });

  // ── Loading ───────────────────────────────────────────────────────────────
  if (authLoading || pkgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-green-500" />
      </div>
    );
  }

  // ── Guard: no pkgId ───────────────────────────────────────────────────────
  if (!pkgId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-8">
        <p className="text-slate-500">No package selected.</p>
        <button onClick={() => navigate({ to: "/vip" })}
          className="px-5 py-2.5 bg-green-600 text-white font-bold rounded-xl text-sm">
          Browse Packages
        </button>
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a0d12] flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6 pt-24">
          <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-500/15 border-4 border-green-400/40 flex items-center justify-center shadow-xl shadow-green-500/10">
            <BadgeCheck className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">Payment Submitted!</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Your payment for <strong className="text-slate-800 dark:text-slate-200">{pkg?.name}</strong> is under review.
              Access unlocks automatically once confirmed.
            </p>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-white/5 shadow-sm">
            <div className="bg-slate-50 dark:bg-white/5 px-5 py-3 border-b border-slate-100 dark:border-white/10">
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Receipt</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
              <ReceiptRow label="Package" value={pkg?.name || ""} />
              <ReceiptRow label="Amount" value={`GHS ${priceGHS.toFixed(2)}`} />
              <ReceiptRow label="Name" value={senderName}
                valueClass="font-semibold text-slate-900 dark:text-slate-100" />
              <ReceiptRow label="Status" value="Pending · 5–15 min"
                valueClass="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1"
                icon={<Clock className="w-3.5 h-3.5" />} />
            </div>
          </div>

          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-sm text-amber-800 dark:text-amber-300 max-w-sm w-full text-left flex gap-3">
            <Clock className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
            <span>Once verified by our team, your VIP access and booking codes unlock automatically in your Dashboard.</span>
          </div>

          <div className="flex gap-3 w-full max-w-sm">
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate({ to: "/vip" })}
              className="px-5 py-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main checkout ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0d12] flex flex-col">
      <SiteHeader />

      <main className="flex-1 pt-20 pb-16 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Back link */}
          <button
            onClick={() => navigate({ to: "/vip" })}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to packages
          </button>

          {/* Page title */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Secure Checkout</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Pay via Mobile Money and upload your proof — we verify within 15 minutes.
            </p>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

            {/* ── LEFT: Merchant details ── */}
            <div className="rounded-2xl overflow-hidden shadow-xl shadow-slate-200/60 dark:shadow-black/40 border border-slate-200 dark:border-white/10">

              {/* Dark header */}
              <div className="bg-slate-900 p-6 space-y-5">
                {/* Package summary */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">You're purchasing</p>
                    <h2 className="text-xl font-black text-white">{pkg?.name}</h2>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Amount</p>
                    <p className="text-2xl font-black text-green-400">GHS {priceGHS.toFixed(2)}</p>
                  </div>
                </div>

                <hr className="border-white/10" />

                {/* Merchant switcher */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Choose your country</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["ghana", "nigeria"] as MerchantKey[]).map((key) => {
                      const m = MERCHANTS[key];
                      const active = activeMerchant === key;
                      return (
                        <button key={key} type="button" onClick={() => setActiveMerchant(key)}
                          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all text-left ${active
                              ? "bg-white text-slate-900 border-white shadow-lg"
                              : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white"
                            }`}
                        >
                          <span className="text-2xl">{m.flag}</span>
                          <div>
                            <div className="font-black text-sm leading-tight">{m.label}</div>
                            <div className={`text-xs font-medium ${active ? "text-slate-500" : "text-slate-600"}`}>
                              {m.currency}
                            </div>
                          </div>
                          {active && <Check className="w-4 h-4 ml-auto text-green-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Account details area */}
              <div className="bg-white dark:bg-slate-900/50 p-6 space-y-4">
                {/* Amount to pay */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <div>
                    <p className="text-xs text-slate-500 font-semibold">Amount to send</p>
                    {activeMerchant === "nigeria" && (
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Rate: 1 GHS = ₦115</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-green-600 dark:text-green-400">{displayAmount}</p>
                  </div>
                </div>

                {/* Network badge */}
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-black"
                    style={{
                      background: MERCHANTS[activeMerchant].networkBg,
                      borderColor: `${MERCHANTS[activeMerchant].networkColor}40`,
                      color: MERCHANTS[activeMerchant].networkColor,
                    }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: MERCHANTS[activeMerchant].networkColor }} />
                    {networkLabel}
                  </div>
                </div>

                {/* Account number */}
                <div className="rounded-xl border-2 border-slate-100 dark:border-white/10 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">
                        {activeMerchant === "ghana" ? "MoMo Number" : "Account Number"}
                      </p>
                      <p className="text-3xl font-black tracking-widest font-mono text-slate-900 dark:text-white">
                        {accountNumber}
                      </p>
                    </div>
                    <CopyBtn text={accountNumber} label="number" copiedField={copiedField} onCopy={copy} />
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 dark:border-white/10 pt-4">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Account Name</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{accountName}</p>
                    </div>
                    <CopyBtn text={accountName} label="name" copiedField={copiedField} onCopy={copy} />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  Payments verified by our team within 15 minutes
                </div>
              </div>
            </div>

            {/* ── RIGHT: Submit proof ── */}
            <div className="rounded-2xl bg-white dark:bg-[#0e1117] border border-slate-200 dark:border-white/10 shadow-xl shadow-slate-200/60 dark:shadow-black/40 p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Submit Your Proof</h2>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  After sending payment, enter your name and upload a screenshot for fast verification.
                </p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); submitMutation.mutate(); }} className="space-y-4">

                {/* Full name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" required
                    placeholder="Your name as it appears on your MoMo account"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 placeholder:text-slate-400 transition-colors"
                  />
                </div>

                {/* Screenshot upload */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Payment Screenshot <span className="text-red-500">*</span>
                  </label>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

                  {proofPreview ? (
                    <div className="relative rounded-xl overflow-hidden border-2 border-green-500 group">
                      <img src={proofPreview} alt="Payment proof" className="w-full max-h-44 object-cover" />
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
                      className={`rounded-md border border-dashed cursor-pointer transition-all p-5 flex flex-col items-center gap-2 text-center ${isDragging
                          ? "border-green-500 bg-green-50 dark:bg-green-500/10"
                          : "border-slate-300 dark:border-white/15 hover:border-green-400 hover:bg-green-50/30 bg-white dark:bg-white/5"
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDragging ? "bg-green-500" : "bg-slate-100 dark:bg-white/10"}`}>
                        {isDragging ? <Upload className="w-5 h-5 text-white" /> : <ImageIcon className="w-5 h-5 text-slate-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{isDragging ? "Drop here" : "Upload screenshot"}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Drag & drop or click · JPG, PNG · Max 5 MB</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Alert */}
                <div className="flex gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>Make sure the <strong>sender name</strong> on your screenshot matches the name you entered above. We verify payments using your name and proof image.</span>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={submitMutation.isPending || !proofFile || !senderName.trim()}
                  className="w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-black text-sm rounded-md flex items-center justify-center gap-2.5 transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  ) : !proofFile ? (
                    <><Upload className="w-4 h-4" /> Please Upload Payment Screenshot First</>
                  ) : (
                    <><ShieldCheck className="w-4 h-4" /> I've Paid — Submit for Verification</>
                  )}
                </button>

                <p className="text-[11px] text-center text-slate-400">
                  🔒 Payments are verified within 15 minutes. Access unlocks automatically.
                </p>
              </form>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function CopyBtn({ text, label, copiedField, onCopy, variant = "default" }: {
  text: string; label: string; copiedField: string | null;
  onCopy: (t: string, l: string) => void; variant?: "default" | "green";
}) {
  const active = copiedField === label;
  return (
    <button type="button" onClick={() => onCopy(text, label)}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all ${variant === "green"
          ? active ? "bg-green-600 text-white" : "bg-green-600 hover:bg-green-700 text-white"
          : active ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30"
            : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/20"
        }`}>
      {active ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {active ? "Copied!" : "Copy"}
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
