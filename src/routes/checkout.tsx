import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Check, Copy, Clock, ShieldCheck, Smartphone,
  ArrowRight, Loader2, BadgeCheck, Upload, ImageIcon,
  Lock, AlertCircle, ArrowLeft, Zap, CheckCircle2, RotateCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { detectUserCurrency } from "@/lib/currency";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): { pkgId: string; country?: string | undefined; mode?: string | undefined } => ({
    pkgId: (search.pkgId as string) || "",
    country: (search.country as string) || (search.bypass as string) || undefined,
    mode: (search.mode as string) || undefined,
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

const MOCO_CHANNELS = [
  { id: 13, name: "MTN Mobile Money", color: "#f59e0b", short: "MTN MoMo" },
  { id: 6,  name: "Telecel Cash",      color: "#ef4444", short: "Telecel" },
  { id: 7,  name: "AT Money (AirtelTigo)", color: "#3b82f6", short: "AT Money" },
];

// ── Page ─────────────────────────────────────────────────────────────────────
function CheckoutPage() {
  const { pkgId, country, mode } = useSearch({ from: "/checkout" });
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect or restore preferred country with bypass support
  const [activeMerchant, setActiveMerchant] = useState<MerchantKey>(() => {
    try {
      // 1. Explicit bypass via URL parameter (?country=nigeria or ?bypass=nigeria or ?country=ghana)
      const c = (country || "").toLowerCase();
      if (c === "nigeria" || c === "ng") return "nigeria";
      if (c === "ghana" || c === "gh") return "ghana";

      // 2. Previously selected tester/user choice
      const saved = localStorage.getItem("a1_checkout_country");
      if (saved === "nigeria" || saved === "ghana") return saved;

      const prefCurr = localStorage.getItem("a1_preferred_currency");
      if (prefCurr === "NGN") return "nigeria";
      if (prefCurr === "GHS") return "ghana";

      // 3. Timezone detection (Africa/Lagos is Nigeria)
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz === "Africa/Lagos") return "nigeria";

      // 4. Browser languages (e.g. en-NG)
      const langs = navigator.languages || [navigator.language || ""];
      if (langs.some((l) => l.toLowerCase().includes("-ng"))) return "nigeria";
    } catch {}
    return "ghana";
  });
  const [senderName, setSenderName] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [success, setSuccess] = useState(false);

  // Moolre states
  const [paymentMode, setPaymentMode] = useState<"moolre" | "manual">("moolre");
  const [moolrePhone, setMoolrePhone] = useState("");
  const [moolreChannel, setMoolreChannel] = useState(13);
  const [promptSent, setPromptSent] = useState(false);
  const [activeRef, setActiveRef] = useState<string | null>(null);
  const [isWaitingPrompt, setIsWaitingPrompt] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(60);

  // Modal Dialog Notification State (replacing transient toasts)
  const [checkoutModal, setCheckoutModal] = useState<{
    isOpen: boolean;
    type: "success" | "error" | "info" | "pending" | "prompt_sent";
    title: string;
    message: string;
    tip?: string | undefined;
    primaryLabel?: string | undefined;
    onPrimary?: (() => void) | undefined;
    secondaryLabel?: string | undefined;
    onSecondary?: (() => void) | undefined;
  }>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const showModal = useCallback((modal: {
    type: "success" | "error" | "info" | "pending" | "prompt_sent";
    title: string;
    message: string;
    tip?: string | undefined;
    primaryLabel?: string | undefined;
    onPrimary?: (() => void) | undefined;
    secondaryLabel?: string | undefined;
    onSecondary?: (() => void) | undefined;
  }) => {
    setCheckoutModal({ ...modal, isOpen: true });
  }, []);

  const closeModal = useCallback(() => {
    setCheckoutModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (!otpRequired) return;
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpRequired]);

  // Redirect to login if not authenticated (wait until auth finishes loading)
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
    if (pkgId === "recovery") navigate({ to: "/dashboard" });
  }, [user, authLoading, pkgId, navigate]);

  useEffect(() => {
    if (user?.user_metadata?.full_name) setSenderName(user.user_metadata.full_name);
    try {
      const savedPhone = localStorage.getItem("a1_momo_phone");
      if (savedPhone) {
        setMoolrePhone(savedPhone);
      } else if (user?.user_metadata?.phone) {
        setMoolrePhone(user.user_metadata.phone);
      }
    } catch {
      if (user?.user_metadata?.phone) setMoolrePhone(user.user_metadata.phone);
    }
  }, [user]);

  // Local subscription package config
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
        .select("payment_gateway, momo_number, momo_name, momo_network, momo_instructions, moolre_test_mode")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
  });

  const isMoolreActive = adminSettings?.payment_gateway === "moolre";
  // NEVER show sandbox mode in production — only in local dev if explicitly enabled in admin settings
  const isMoolreTest = !import.meta.env.PROD && adminSettings?.moolre_test_mode === true;

  // Real-time IP geolocation auto-detection if not explicitly bypassed
  useEffect(() => {
    const c = (country || "").toLowerCase();
    if (c === "nigeria" || c === "ghana" || c === "ng" || c === "gh") return; // URL bypass active
    const saved = localStorage.getItem("a1_checkout_country");
    if (saved) return; // Explicit user choice preserved

    detectUserCurrency().then((curr) => {
      if (curr === "NGN") {
        setActiveMerchant("nigeria");
        setPaymentMode("manual");
      } else if (curr === "GHS") {
        setActiveMerchant("ghana");
      }
    });
  }, [country]);

  // Set default mode based on gateway setting AND country selection / query params
  // Nigeria always uses manual bank transfer — Moolre is Ghana-only (MoMo)
  useEffect(() => {
    const c = (country || "").toLowerCase();
    if (c === "nigeria" || c === "ng") {
      setActiveMerchant("nigeria");
      setPaymentMode("manual");
      return;
    }
    if (c === "ghana" || c === "gh") {
      setActiveMerchant("ghana");
    }
    if (mode === "manual" || activeMerchant === "nigeria") {
      setPaymentMode("manual");
      return;
    }
    if (adminSettings?.payment_gateway) {
      if (adminSettings.payment_gateway === "moolre") {
        setPaymentMode("moolre");
      } else {
        setPaymentMode("manual");
      }
    }
  }, [adminSettings?.payment_gateway, activeMerchant, country, mode]);

  // When user picks Nigeria or Ghana, handle mode and persist choice
  const handleMerchantChange = (key: MerchantKey) => {
    setActiveMerchant(key);
    try {
      localStorage.setItem("a1_checkout_country", key);
    } catch {}
    if (key === "nigeria") {
      setPaymentMode("manual");
    } else if (isMoolreActive) {
      setPaymentMode("moolre");
    } else {
      setPaymentMode("manual");
    }
    // Reset proof & sender state on country switch
    setProofFile(null);
    setProofPreview(null);
    setSenderName(user?.user_metadata?.full_name || "");
  };

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

  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // ── Active status checker function ──────────────────────────────────────────
  const checkPaymentStatus = useCallback(async (manual = false) => {
    if (!activeRef) return false;
    if (manual) setIsCheckingStatus(true);

    try {
      // 1. Check local DB directly for ticket or approved payment
      const { data: ticket } = await supabase
        .from("user_tickets")
        .select("id")
        .eq("payment_ref", activeRef)
        .maybeSingle();

      if (ticket) {
        showModal({
          type: "success",
          title: "Payment Confirmed!",
          message: `Your payment was verified successfully. Access to ${pkg?.name || "your VIP package"} has been unlocked.`,
          primaryLabel: "Go to Dashboard",
          onPrimary: () => navigate({ to: "/dashboard" }),
        });
        setSuccess(true);
        if (manual) setIsCheckingStatus(false);
        return true;
      }

      const { data: payment } = await supabase
        .from("manual_payments")
        .select("status")
        .eq("reference_code", activeRef)
        .maybeSingle();

      if (payment?.status === "approved") {
        showModal({
          type: "success",
          title: "Payment Confirmed!",
          message: `Your payment was verified successfully. Access to ${pkg?.name || "your VIP package"} has been unlocked.`,
          primaryLabel: "Go to Dashboard",
          onPrimary: () => navigate({ to: "/dashboard" }),
        });
        setSuccess(true);
        if (manual) setIsCheckingStatus(false);
        return true;
      }

      // 2. Active status check against Moolre API via Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(`${supabaseUrl}/functions/v1/moolre-payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "check_status",
            reference: activeRef,
          }),
        });

        const data = await res.json();
        if (data?.approved) {
          showModal({
            type: "success",
            title: "Payment Confirmed!",
            message: `Your payment was verified successfully. Access to ${pkg?.name || "your VIP package"} has been unlocked.`,
            primaryLabel: "Go to Dashboard",
            onPrimary: () => navigate({ to: "/dashboard" }),
          });
          setSuccess(true);
          if (manual) setIsCheckingStatus(false);
          return true;
        } else if (manual) {
          showModal({
            type: "pending",
            title: "Payment Awaiting Authorization",
            message: "We haven't received your PIN authorization from the network yet. If you just approved on your phone, please wait a few seconds and check again.",
            tip: moolreChannel === 13
              ? "Tip for MTN: Dial *170# -> 6. My Wallet -> 3. My Approvals to authorize if the popup prompt was missed."
              : moolreChannel === 6
              ? "Tip for Telecel: Dial *110# -> Pending Approvals to authorize."
              : "Tip for AT Money: Dial *110# to approve pending transactions.",
            primaryLabel: "Check Status Again",
            onPrimary: () => checkPaymentStatus(true),
            secondaryLabel: "Wait on This Screen",
          });
        }
      }
    } catch (err: any) {
      if (manual) {
        showModal({
          type: "error",
          title: "Unable to Check Status",
          message: "Could not reach the payment verification server. Please verify your connection and try again.",
          primaryLabel: "Try Again",
          onPrimary: () => checkPaymentStatus(true),
        });
      }
    } finally {
      if (manual) setIsCheckingStatus(false);
    }

    return false;
  }, [activeRef, moolreChannel, pkg?.name, navigate, showModal]);

  // ── Polling for automated payment approval ─────────────────────────────────
  useEffect(() => {
    if (!activeRef || !promptSent || success) return;

    let isSubscribed = true;

    // Run immediate check
    checkPaymentStatus();

    const interval = setInterval(async () => {
      if (!isSubscribed) return;
      const approved = await checkPaymentStatus();
      if (approved) clearInterval(interval);
    }, 3500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeRef, promptSent, success, checkPaymentStatus]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showModal({
        type: "error",
        title: "Invalid File Type",
        message: "Please upload an image file (PNG, JPG, JPEG, or WebP) of your transfer receipt.",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showModal({
        type: "error",
        title: "File Size Too Large",
        message: "The uploaded file exceeds the 5MB size limit. Please upload a smaller screenshot.",
      });
      return;
    }
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setProofPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Moolre Automated Submit ───────────────────────────────────────────────
  const moolreMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in to continue.");
      if (!pkg) throw new Error("Package not found.");
      if (!moolrePhone.trim() || moolrePhone.trim().length < 9) {
        throw new Error("Please enter a valid Mobile Money phone number.");
      }

      setIsWaitingPrompt(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication expired. Please log in again.");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/moolre-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          packageId: pkg.id,
          amount: priceGHS,
          payerPhone: moolrePhone.trim(),
          networkChannel: moolreChannel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to trigger USSD payment prompt.");
      }
      return data;
    },
    onSuccess: (data) => {
      setIsWaitingPrompt(false);
      if (data.otpRequired) {
        setOtpRequired(true);
        if (data.reference) setActiveRef(data.reference);
        showModal({
          type: "info",
          title: "SMS Verification Required",
          message: data.message || `Moolre sent a 6-digit verification code to ${moolrePhone}. Please enter it below to authorize your payment prompt.`,
          primaryLabel: "Enter Code",
        });
        return;
      }
      setOtpRequired(false);
      setPromptSent(true);
      if (data.reference) setActiveRef(data.reference);
      try {
        localStorage.setItem("a1_momo_phone", moolrePhone.trim());
      } catch {}
      showModal({
        type: "prompt_sent",
        title: "USSD Prompt Dispatched!",
        message: `A payment prompt has been sent to ${moolrePhone}. Check your phone screen now and enter your Mobile Money PIN to authorize GH₵ ${priceGHS.toFixed(2)}.`,
        tip: moolreChannel === 13
          ? "Tip for MTN: If popup didn't show, dial *170# -> 6. My Wallet -> 3. My Approvals."
          : undefined,
        primaryLabel: "I've Got My Phone Ready",
      });
    },
    onError: (err: any) => {
      setIsWaitingPrompt(false);
      showModal({
        type: "error",
        title: "Could Not Send Prompt",
        message: err.message || "Could not trigger Mobile Money prompt. Please check your phone number and try again.",
        primaryLabel: "Review Details",
      });
    },
  });

  // ── Moolre OTP Verification ────────────────────────────────────────────────
  const verifyOtpMutation = useMutation({
    mutationFn: async (codeOverride?: string) => {
      const code = (codeOverride || otpCode).trim();
      if (!user) throw new Error("Please log in to continue.");
      if (!pkg) throw new Error("Package not found.");
      if (!code) throw new Error("Please enter the verification code.");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication expired. Please log in again.");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/moolre-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          packageId: pkg.id,
          amount: priceGHS,
          payerPhone: moolrePhone.trim(),
          networkChannel: moolreChannel,
          otpCode: code,
          reference: activeRef,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed. Please check the code.");
      }
      return data;
    },
    onSuccess: (data) => {
      setOtpRequired(false);
      setPromptSent(true);
      if (data.reference) setActiveRef(data.reference);
      try {
        localStorage.setItem("a1_momo_phone", moolrePhone.trim());
      } catch {}
      showModal({
        type: "prompt_sent",
        title: "Phone Verified & Prompt Sent!",
        message: `Your phone number was verified! A USSD prompt has been sent to ${moolrePhone}. Please enter your MoMo PIN on your phone screen to complete authorization.`,
        tip: moolreChannel === 13
          ? "Tip for MTN: Dial *170# -> 6. My Wallet -> 3. My Approvals if the popup didn't display."
          : undefined,
        primaryLabel: "I'll Enter My PIN Now",
      });
    },
    onError: (err: any) => {
      showModal({
        type: "error",
        title: "Verification Failed",
        message: err.message || "Invalid verification code. Please check your SMS and try again.",
        primaryLabel: "Try Again",
      });
    },
  });

  // ── Test Mode Simulated Approval ──────────────────────────────────────────
  const simulateApprovalMutation = useMutation({
    mutationFn: async () => {
      if (!activeRef || !user || !pkg) throw new Error("No active reference");
      
      // Update manual payment to approved
      await supabase
        .from("manual_payments")
        .update({ status: "approved" })
        .eq("reference_code", activeRef);

      // Create ticket
      const ticketId = `ticket_sim_${Date.now()}`;
      await supabase.from("user_tickets").insert({
        id: ticketId,
        user_id: user.id,
        package_id: pkg.id,
        payment_ref: activeRef,
      });

      // If subscription, activate
      if (isSubscription) {
        const subType = pkgId.replace("sub_", "");
        const exp = new Date();
        exp.setDate(exp.getDate() + 30);
        await supabase.from("subscriptions").insert({
          user_id: user.id,
          subscription_type: subType,
          status: "active",
          amount_paid: priceGHS,
          payment_ref: activeRef,
          expires_at: exp.toISOString(),
        });
      }
    },
    onSuccess: () => {
      showModal({
        type: "success",
        title: "Test Payment Approved!",
        message: "Sandbox test payment simulated successfully. Your package is now activated.",
        primaryLabel: "Go to Dashboard",
        onPrimary: () => navigate({ to: "/dashboard" }),
      });
      setSuccess(true);
    },
    onError: (err: any) => {
      showModal({
        type: "error",
        title: "Simulation Failed",
        message: err.message || "Failed to simulate approval.",
      });
    },
  });

  // ── Manual Submit ─────────────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in to continue.");
      if (!pkg) throw new Error("Package not found.");
      if (!senderName.trim()) throw new Error("Please enter your full name.");
      if (!proofFile) throw new Error("Please upload a payment screenshot.");

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

      if (isSubscription) {
        const subscriptionType = pkgId.replace("sub_", "");
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
    onError: (err: any) => {
      showModal({
        type: "error",
        title: "Submission Failed",
        message: err.message || "We could not submit your payment slip. Please check your network and try again.",
        primaryLabel: "Review & Resubmit",
      });
    },
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 text-xs font-black mb-3">
              <Zap className="w-3 h-3" /> Instant MoMo · A1-TipsDeck
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">Payment Confirmed!</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Your VIP access for <strong className="text-slate-800 dark:text-slate-200">{pkg?.name}</strong> has been activated. Start using your tips immediately!
            </p>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-white/5 shadow-sm">
            <div className="bg-slate-50 dark:bg-white/5 px-5 py-3 border-b border-slate-100 dark:border-white/10">
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Order Receipt</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
              <ReceiptRow label="Package" value={pkg?.name || ""} />
              <ReceiptRow label="Amount" value={`GHS ${priceGHS.toFixed(2)}`} />
              <ReceiptRow label="Payment" value="Mobile Money (Moolre)" />
              <ReceiptRow label="Status" value="Active / Confirmed"
                valueClass="text-green-600 dark:text-green-400 font-semibold flex items-center gap-1"
                icon={<CheckCircle2 className="w-3.5 h-3.5" />} />
            </div>
          </div>

          <div className="flex gap-3 w-full max-w-sm">
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              Open Dashboard <ArrowRight className="w-4 h-4" />
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
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-6 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to packages
          </button>

          {/* Page title & Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">Secure Checkout</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {activeMerchant === "nigeria"
                  ? "Pay via Moniepoint bank transfer and upload your proof — we verify within 15 minutes."
                  : paymentMode === "manual"
                    ? "Pay via direct Mobile Money transfer and upload your proof — we verify within 15 minutes."
                    : isMoolreActive
                      ? "Instant USSD Mobile Money checkout — authorize directly on your phone."
                      : "Pay via Mobile Money and upload your proof — we verify within 15 minutes."}
              </p>
            </div>

            {/* Country / Payment Mode Switcher (Always accessible) */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 dark:bg-white/10 border border-slate-300 dark:border-white/10 rounded-xl self-start sm:self-auto shadow-xs">
              <button
                type="button"
                onClick={() => handleMerchantChange("ghana")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer border-none ${
                  activeMerchant === "ghana"
                    ? "bg-amber-500 text-black shadow-xs font-black"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-transparent"
                }`}
              >
                <span>🇬🇭</span>
                <span>Ghana (MoMo)</span>
              </button>

              <button
                type="button"
                onClick={() => handleMerchantChange("nigeria")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer border-none ${
                  activeMerchant === "nigeria"
                    ? "bg-purple-600 text-white shadow-xs font-black"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-transparent"
                }`}
              >
                <span>🇳🇬</span>
                <span>Nigeria (Manual Bank)</span>
              </button>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* OPTION A: MOOLRE AUTOMATED USSD PROMPT CHECKOUT (Ghana automated)   */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {isMoolreActive && activeMerchant !== "nigeria" && paymentMode === "moolre" ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">
              
              {/* Left Column: Summary & Network Selector */}
              <div className="rounded-2xl overflow-hidden shadow-xl shadow-slate-200/60 dark:shadow-black/40 border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0e1117]">
                
                {/* Dark Header */}
                <div className="bg-slate-900 p-6 space-y-4 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-2">
                        <Zap className="w-3 h-3" /> Instant Mobile Money
                      </div>
                      <h2 className="text-xl font-black">{pkg?.name}</h2>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Amount</p>
                      <p className="text-2xl font-black text-green-400">GHS {priceGHS.toFixed(2)}</p>
                    </div>
                  </div>

                  {isMoolreTest && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span><strong>Sandbox Mode:</strong> Payment prompt will be simulated without actual money debited.</span>
                    </div>
                  )}
                </div>

                {/* Network Choice */}
                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Select Your Mobile Money Network
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {MOCO_CHANNELS.map((ch) => {
                        const active = moolreChannel === ch.id;
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => setMoolreChannel(ch.id)}
                            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                              active
                                ? "border-amber-500 bg-amber-500/10 text-slate-900 dark:text-white font-black shadow-sm"
                                : "border-slate-200 dark:border-white/10 hover:border-slate-300 text-slate-600 dark:text-slate-400 font-medium"
                            }`}
                          >
                            <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1.5" style={{ background: ch.color }} />
                            <div className="text-xs">{ch.short}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* MoMo Number Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Your Mobile Money Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 0244123456"
                        value={moolrePhone}
                        onChange={(e) => setMoolrePhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 text-sm font-mono font-bold rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      A prompt will appear instantly on this phone to authorize payment.
                    </p>
                  </div>

                  {/* Action / OTP / Prompt Section */}
                  {otpRequired ? (
                    <div className="space-y-4 pt-2">
                      <div className="p-5 bg-gradient-to-b from-amber-500/15 via-amber-500/10 to-transparent border-2 border-amber-500/40 rounded-2xl space-y-4 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-extrabold text-sm">
                            <ShieldCheck className="w-4 h-4 text-amber-500" />
                            <span>SMS Verification Code</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            Step 1 of 2
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed m-0">
                          Moolre sent a 6-digit code to <strong className="text-slate-900 dark:text-white font-mono">{moolrePhone}</strong>. Enter it below — prompt will trigger automatically:
                        </p>

                        {/* Redesigned 6-Digit Segmented OTP Input */}
                        <div className="flex justify-center py-2">
                          <InputOTP
                            maxLength={6}
                            value={otpCode}
                            onChange={(val) => setOtpCode(val)}
                            onComplete={(code) => {
                              if (code.length === 6 && !verifyOtpMutation.isPending) {
                                verifyOtpMutation.mutate(code);
                              }
                            }}
                            disabled={verifyOtpMutation.isPending}
                            autoFocus
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                            </InputOTPGroup>
                            <InputOTPSeparator />
                            <InputOTPGroup>
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>

                        {/* Automated Transition Feedback */}
                        {verifyOtpMutation.isPending ? (
                          <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                            <span>Verifying code & sending USSD prompt to your phone…</span>
                          </div>
                        ) : (
                          <p className="text-center text-[11px] text-slate-400 m-0">
                            ⚡ Instant: Dispatches to your phone PIN prompt the moment 6 digits are entered.
                          </p>
                        )}

                        {/* Manual Trigger Button (if user prefers tapping) */}
                        <button
                          type="button"
                          onClick={() => verifyOtpMutation.mutate(otpCode)}
                          disabled={verifyOtpMutation.isPending || otpCode.length < 6}
                          className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
                        >
                          {verifyOtpMutation.isPending ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Authorizing Prompt…</>
                          ) : (
                            <><CheckCircle2 className="w-4 h-4" /> Confirm & Send USSD Prompt</>
                          )}
                        </button>

                        {/* Footer Controls: Resend Timer & Change Phone */}
                        <div className="flex items-center justify-between pt-2 border-t border-amber-500/20 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              if (resendCooldown === 0) {
                                moolreMutation.mutate();
                                setResendCooldown(60);
                                showModal({
                                  type: "info",
                                  title: "Resending SMS Code",
                                  message: `A fresh 6-digit verification code is being dispatched to ${moolrePhone}.`,
                                  primaryLabel: "Got It",
                                });
                              }
                            }}
                            disabled={resendCooldown > 0 || moolreMutation.isPending}
                            className="text-amber-600 dark:text-amber-400 hover:underline font-bold disabled:opacity-50 disabled:no-underline cursor-pointer disabled:cursor-not-allowed bg-transparent border-none p-0 flex items-center gap-1"
                          >
                            <RotateCw className={`w-3 h-3 ${moolreMutation.isPending ? "animate-spin" : ""}`} />
                            {resendCooldown > 0 ? `Resend SMS in ${resendCooldown}s` : "Resend SMS Code"}
                          </button>

                          <button
                            type="button"
                            onClick={() => { setOtpRequired(false); setOtpCode(""); }}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer bg-transparent border-none p-0"
                          >
                            Change number
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : !promptSent ? (
                    <button
                      type="button"
                      onClick={() => moolreMutation.mutate()}
                      disabled={moolreMutation.isPending || !moolrePhone.trim() || isWaitingPrompt}
                      className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
                    >
                      {moolreMutation.isPending || isWaitingPrompt ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Sending MoMo Prompt…</>
                      ) : (
                        <><Zap className="w-4 h-4" /> Pay GHS {priceGHS.toFixed(2)} with MoMo Prompt</>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-4 pt-2">
                      <div className="p-5 bg-gradient-to-b from-amber-500/15 via-amber-500/10 to-transparent border-2 border-amber-500/40 rounded-2xl space-y-3.5 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-extrabold text-sm">
                            <Smartphone className="w-5 h-5 text-amber-500 animate-bounce" />
                            <span>Awaiting MoMo PIN Confirmation</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            Step 2 of 2
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed m-0">
                          A USSD payment prompt has been sent to <strong className="text-slate-900 dark:text-white font-mono">{moolrePhone}</strong>. Check your phone screen now and enter your PIN to authorize <strong>GH₵ {priceGHS.toFixed(2)}</strong>.
                        </p>
                        <div className="flex items-center justify-between pt-2 border-t border-amber-500/20">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            Ref: <strong className="text-emerald-600 dark:text-emerald-400">{activeRef?.startsWith("moolre_") ? `#${activeRef.slice(-6).toUpperCase()}` : activeRef}</strong>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            <RotateCw className="w-3.5 h-3.5 animate-spin" /> Auto-detecting payment…
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 m-0">
                          ✨ Your package unlocks automatically as soon as your PIN is entered. No need to reload.
                        </p>
                      </div>

                      {/* Approvals Fallback */}
                      <div className="p-4 bg-slate-100/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-2 text-xs">
                        <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 m-0">
                          <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                          Didn't see the popup prompt on your screen?
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed m-0">
                          {moolreChannel === 13 ? (
                            <>On MTN, open your approvals menu: Dial <strong className="text-slate-800 dark:text-slate-200">*170#</strong> &rarr; <strong>6. My Wallet</strong> &rarr; <strong>3. My Approvals</strong> to approve.</>
                          ) : moolreChannel === 6 ? (
                            <>On Telecel, open your approvals: Dial <strong className="text-slate-800 dark:text-slate-200">*110#</strong> &rarr; <strong>Pending Approvals</strong> to authorize.</>
                          ) : (
                            <>On AT, dial <strong className="text-slate-800 dark:text-slate-200">*110#</strong> to approve pending transactions.</>
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => checkPaymentStatus(true)}
                        disabled={isCheckingStatus}
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                      >
                        {isCheckingStatus ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying payment with Moolre…</>
                        ) : (
                          <><CheckCircle2 className="w-3.5 h-3.5" /> I've entered my PIN — Confirm Access Now</>
                        )}
                      </button>

                      {isMoolreTest && (
                        <button
                          type="button"
                          onClick={() => simulateApprovalMutation.mutate()}
                          disabled={simulateApprovalMutation.isPending}
                          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          {simulateApprovalMutation.isPending ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Simulating Approval…</>
                          ) : (
                            <><CheckCircle2 className="w-3.5 h-3.5" /> Simulate Instant Approval (Sandbox Mode)</>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => { setPromptSent(false); setActiveRef(null); }}
                        className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition-colors cursor-pointer"
                      >
                        Didn't get the prompt? Try another number
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Instructions & Guarantees */}
              <div className="rounded-2xl bg-white dark:bg-[#0e1117] border border-slate-200 dark:border-white/10 p-6 space-y-5 shadow-xl shadow-slate-200/60 dark:shadow-black/40">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" /> How Instant MoMo Works
                </h3>

                <ol className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 font-black flex items-center justify-center shrink-0 text-[11px]">1</span>
                    <span>Enter your mobile money number and click <strong>Pay with MoMo Prompt</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 font-black flex items-center justify-center shrink-0 text-[11px]">2</span>
                    <span>An interactive prompt will instantly pop up on your phone screen.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 font-black flex items-center justify-center shrink-0 text-[11px]">3</span>
                    <span>Authorize with your secret PIN — no screenshot or manual verification required.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 font-black flex items-center justify-center shrink-0 text-[11px]">4</span>
                    <span>Your VIP tickets and booking codes unlock immediately in your dashboard.</span>
                  </li>
                </ol>

                <hr className="border-slate-100 dark:border-white/10" />

              </div>
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════════ */
            /* OPTION B: MANUAL TRANSFER & PROOF UPLOAD                           */
            /* Nigeria → Moniepoint Bank Transfer | Ghana → MoMo Manual           */
            /* ═══════════════════════════════════════════════════════════════════ */
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

              {/* ── LEFT: Merchant details ── */}
              <div className="rounded-2xl overflow-hidden shadow-xl shadow-slate-200/60 dark:shadow-black/40 border border-slate-200 dark:border-white/10">

                {/* Dark header */}
                <div className="bg-slate-900 p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">You're purchasing</p>
                      <h2 className="text-xl font-black text-white">{pkg?.name}</h2>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Amount</p>
                      <p className="text-2xl font-black text-green-400">{displayAmount}</p>
                      {activeMerchant === "nigeria" && (
                        <p className="text-[10px] text-slate-500 mt-0.5">(GHS {priceGHS.toFixed(2)} × 115)</p>
                      )}
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
                          <button key={key} type="button" onClick={() => handleMerchantChange(key)}
                            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border transition-all text-left cursor-pointer ${active
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
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input type="text" required
                      placeholder={activeMerchant === "nigeria" ? "Your name as it appears on your bank account" : "Your name as it appears on your MoMo account"}
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 placeholder:text-slate-400 transition-colors"
                    />
                  </div>

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
                            className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer">Remove</button>
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

                  <div className="flex gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>Make sure the <strong>sender name</strong> matches your payment. We verify payments using your name and proof screenshot.</span>
                  </div>

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
                </form>
              </div>

            </div>
          )}
        </div>

        {/* ── Central Checkout Notification Modal (Replacing Toasts) ─────────────── */}
        <Dialog open={checkoutModal.isOpen} onOpenChange={(open) => !open && closeModal()}>
          <DialogContent className="max-w-[420px] w-[92%] p-6 sm:p-7 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex flex-col items-center text-center gap-4 py-1">
              {/* Type Icon Badge */}
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center transition-all",
                  checkoutModal.type === "success" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-8 ring-emerald-500/10",
                  checkoutModal.type === "prompt_sent" && "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-8 ring-amber-500/10",
                  checkoutModal.type === "pending" && "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-8 ring-amber-500/10",
                  checkoutModal.type === "error" && "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-8 ring-rose-500/10",
                  checkoutModal.type === "info" && "bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-8 ring-sky-500/10"
                )}
              >
                {checkoutModal.type === "success" && <BadgeCheck className="w-9 h-9 stroke-[2.2]" />}
                {checkoutModal.type === "prompt_sent" && <Smartphone className="w-8 h-8 animate-bounce" />}
                {checkoutModal.type === "pending" && <Clock className="w-8 h-8 animate-spin" />}
                {checkoutModal.type === "error" && <AlertCircle className="w-9 h-9" />}
                {checkoutModal.type === "info" && <ShieldCheck className="w-9 h-9" />}
              </div>

              <div className="space-y-1.5 w-full">
                <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {checkoutModal.title}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {checkoutModal.message}
                </DialogDescription>
              </div>

              {/* Optional Contextual Tip Box */}
              {checkoutModal.tip && (
                <div className="w-full p-3.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300 font-mono text-left leading-relaxed flex items-start gap-2">
                  <Smartphone className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{checkoutModal.tip}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="w-full flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (checkoutModal.onPrimary) {
                      checkoutModal.onPrimary();
                    }
                    closeModal();
                  }}
                  className={cn(
                    "w-full py-3.5 px-4 rounded-xl font-extrabold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-2",
                    checkoutModal.type === "success" && "bg-emerald-600 hover:bg-emerald-500 text-white",
                    (checkoutModal.type === "prompt_sent" || checkoutModal.type === "pending") && "bg-amber-500 hover:bg-amber-400 text-slate-950",
                    checkoutModal.type === "error" && "bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950",
                    checkoutModal.type === "info" && "bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950"
                  )}
                >
                  {checkoutModal.primaryLabel || "Got It"}
                </button>

                {checkoutModal.secondaryLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      if (checkoutModal.onSecondary) {
                        checkoutModal.onSecondary();
                      }
                      closeModal();
                    }}
                    className="w-full py-2 px-4 rounded-xl font-bold text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer bg-transparent border-none"
                  >
                    {checkoutModal.secondaryLabel}
                  </button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${variant === "green"
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
