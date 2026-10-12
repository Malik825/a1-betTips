import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  Check, Crown, Star, Zap, BadgeCheck, CalendarDays, Repeat,
  Clock, Sparkles, ShieldCheck, HelpCircle, Layers,
  Trophy, Flame, RotateCcw, AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/subscriptions")({
  validateSearch: (search: Record<string, unknown>): { renew?: boolean | undefined } => ({
    renew: search.renew ? search.renew === "true" || search.renew === true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Monthly VIP Subscriptions — A1-TIPSDECK" },
      { name: "description", content: "Subscribe monthly to unlock all VIP and VVIP packages in the games. High odds, booking codes, and replacement game protection included." },
    ],
  }),
  component: SubscriptionsPage,
});

// Primary Tier Plans covering game packages (with fallback values)
const DEFAULT_COMBO_PLANS = [
  {
    id: "sub_all_access",
    name: "All-Access VIP Master Pass",
    type: "all_access",
    badge: "Most Popular",
    price: 350,
    originalPrice: 500,
    tagline: "Gives you complete daily access to all 5 VIP and VVIP game packages for a full 30 days.",
    packagesCovered: ["VIP 1", "VIP 2", "VVIP 1", "VVIP 2", "SUPREME VVIP 👑"],
    features: [
      "Unlocks all 5 VIP packages every day",
      "VIP 1 & VIP 2 safe banker slips",
      "VVIP 1 & VVIP 2 high odds accumulators",
      "SUPREME VVIP 👑 top predictions",
      "SportyBet booking codes ready to copy & place",
      "Emergency safety net: Replacement game if a slip fails (opened as needed)",
      "Direct priority WhatsApp member support",
      "Valid for 30 full days from activation",
    ],
    highlight: true,
  },
  {
    id: "sub_supreme_vvip",
    name: "Supreme VVIP Pass 👑",
    type: "supreme_vvip",
    badge: "Big Odds",
    price: 280,
    originalPrice: 350,
    tagline: "Our highest odds daily games for punters targeting big payouts with high strike rates.",
    packagesCovered: ["SUPREME VVIP 👑"],
    features: [
      "Daily SUPREME VVIP 👑 top predictions",
      "Big odds slips (25.0 to 50.0+ odds)",
      "Daily SportyBet booking code included",
      "Thorough match research before every pick",
      "Emergency safety net: Replacement game if a slip fails (opened as needed)",
      "Valid for 30 full days from activation",
    ],
    highlight: false,
  },
  {
    id: "sub_vvip_combo",
    name: "VVIP Combo Pass",
    type: "vvip_combo",
    badge: "High Odds Combo",
    price: 220,
    originalPrice: 280,
    tagline: "Covers BOTH VVIP 1 & VVIP 2 — higher odds and multi-match accumulator slips.",
    packagesCovered: ["VVIP 1", "VVIP 2"],
    features: [
      "Daily access to both VVIP 1 and VVIP 2 slips",
      "High odds ranging from 5.0 to 30.0+",
      "Midweek and weekend SportyBet booking codes",
      "Emergency safety net: Replacement game if a slip fails (opened as needed)",
      "Email and SMS alert notifications",
      "Valid for 30 full days from activation",
    ],
    highlight: false,
  },
  {
    id: "sub_vip_combo",
    name: "VIP Combo Pass",
    type: "vip_combo",
    badge: "Safe & Steady",
    price: 120,
    originalPrice: 160,
    tagline: "Covers BOTH VIP 1 & VIP 2 — safe banker slips for steady, daily winning.",
    packagesCovered: ["VIP 1", "VIP 2"],
    features: [
      "Daily access to both VIP 1 and VIP 2 slips",
      "Safe banker odds (2.0 to 7.0 odds)",
      "Daily SportyBet booking codes ready to place",
      "Best for low-risk, steady daily profit",
      "Emergency safety net: Replacement game if a slip fails (opened as needed)",
      "Valid for 30 full days from activation",
    ],
    highlight: false,
  },
];

// Single Game Package Monthly Passes (with fallback values)
const DEFAULT_SINGLE_PLANS = [
  {
    id: "sub_vip_1",
    name: "VIP 1 Monthly Pass",
    targetPkg: "vip_1",
    pkgTitle: "VIP 1 (Daily Bankers)",
    price: 70,
    originalPrice: 90,
    oddsRange: "2.00 – 3.50 Odds",
    description: "Safe daily banker games designed for minimal risk and reliable winning.",
  },
  {
    id: "sub_vip_2",
    name: "VIP 2 Monthly Pass",
    targetPkg: "vip_2",
    pkgTitle: "VIP 2 (Value Multis)",
    price: 70,
    originalPrice: 90,
    oddsRange: "3.50 – 7.00 Odds",
    description: "Balanced multi-bets across top European leagues with solid value.",
  },
  {
    id: "sub_vvip_1",
    name: "VVIP 1 Monthly Pass",
    targetPkg: "vvip_1",
    pkgTitle: "VVIP 1 (Premium Slips)",
    price: 130,
    originalPrice: 160,
    oddsRange: "5.00 – 15.00 Odds",
    description: "Premium selections with higher odds for bettors wanting bigger returns.",
  },
  {
    id: "sub_vvip_2",
    name: "VVIP 2 Monthly Pass",
    targetPkg: "vvip_2",
    pkgTitle: "VVIP 2 (Mega Accumulators)",
    price: 130,
    originalPrice: 160,
    oddsRange: "10.00 – 30.00+ Odds",
    description: "Multi-game accumulator slips for punters hunting major payouts.",
  },
];

// Game Packages Details in the system
const GAME_PACKAGES_METADATA: Record<string, {
  name: string;
  tagline: string;
  typicalOdds: string;
  risk: string;
  coveredBy: string;
  icon: typeof Trophy;
}> = {
  vip_1: {
    name: "VIP 1",
    tagline: "Safe Daily Bankers",
    typicalOdds: "2.00 – 3.50",
    risk: "Low Risk",
    coveredBy: "All-Access • VIP Combo • VIP 1 Pass",
    icon: Zap,
  },
  vip_2: {
    name: "VIP 2",
    tagline: "Value Combo Slips",
    typicalOdds: "3.50 – 7.00",
    risk: "Moderate",
    coveredBy: "All-Access • VIP Combo • VIP 2 Pass",
    icon: Layers,
  },
  vvip_1: {
    name: "VVIP 1",
    tagline: "Premium High Odds",
    typicalOdds: "5.00 – 15.00",
    risk: "High Return",
    coveredBy: "All-Access • VVIP Combo • VVIP 1 Pass",
    icon: Flame,
  },
  vvip_2: {
    name: "VVIP 2",
    tagline: "Mega Accumulator Slips",
    typicalOdds: "10.00 – 30.00+",
    risk: "Big Payout",
    coveredBy: "All-Access • VVIP Combo • VVIP 2 Pass",
    icon: Trophy,
  },
  supreme_vvip: {
    name: "SUPREME VVIP 👑",
    tagline: "Top High Odds Package",
    typicalOdds: "25.00 – 50.00+",
    risk: "Maximum Yield",
    coveredBy: "All-Access • Supreme VVIP Pass",
    icon: Crown,
  },
  recovery: {
    name: "Recovery Slip 🔄",
    tagline: "Emergency Safety Net",
    typicalOdds: "Replacement Odds",
    risk: "Emergency Backup",
    coveredBy: "Only active when games spoil (not an everyday slip)",
    icon: RotateCcw,
  },
};

const FAQS = [
  {
    q: "How does the monthly subscription work?",
    a: "When you subscribe to a monthly pass, every game package included in your plan unlocks automatically in your dashboard as soon as our analysts publish it. You never have to buy daily individual tickets for a full 30 days.",
  },
  {
    q: "Are all game packages covered by the All-Access Pass?",
    a: "Yes! The All-Access VIP Master Pass unlocks all 5 regular packages: VIP 1, VIP 2, VVIP 1, VVIP 2, and SUPREME VVIP 👑. You get every single SportyBet booking code and prediction uploaded for 30 consecutive days.",
  },
  {
    q: "Is the Recovery Package available every day?",
    a: "No. The Recovery Package is NOT an everyday game. It is a special safety backup that our analysts only open when a VIP ticket has a lost game to help members recover. When active, eligible subscribers get replacement access.",
  },
  {
    q: "How do I make payment?",
    a: "Click 'Subscribe' on any plan. On the checkout page, you can pay easily using Mobile Money (MTN, Telecel, AT in Ghana) or Nigerian Moniepoint transfer. Verification is fast and secure.",
  },
  {
    q: "How fast is my subscription approved?",
    a: "Once you send your Mobile Money payment and upload your screenshot, our admin verifies and activates your subscription — usually within 5 to 15 minutes.",
  },
  {
    q: "Can I upgrade or negotiate a special deal?",
    a: "Yes! You can upgrade your tier anytime. If you are a high-roller, running a betting syndicate, or need custom terms, reach out to our WhatsApp support team for direct assistance.",
  },
];

function SubscriptionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const isRenewMode = search?.renew;
  const [planTab, setPlanTab] = useState<"combo" | "single">("combo");

  // Fetch user subscriptions
  const { data: userSubscriptions = [] } = useQuery({
    queryKey: ["user_subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch user manual payments so we can detect pending/rejected subscription payments
  const { data: userManualPayments = [] } = useQuery({
    queryKey: ["user_manual_payments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("manual_payments")
        .select("id, package_id, status, rejection_reason, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
  });

  // If user already has an active All-Access VIP pass, redirect them to dashboard (unless in explicit renew mode)
  const activeAllAccess = userSubscriptions.find(
    (s: any) =>
      s.status === "active" &&
      s.subscription_type === "all_access" &&
      s.expires_at &&
      new Date(s.expires_at) > new Date()
  );

  useEffect(() => {
    if (activeAllAccess && !isRenewMode) {
      toast.info("Your All-Access VIP Pass is active! Redirecting to your dashboard...");
      navigate({ to: "/dashboard" });
    }
  }, [activeAllAccess, isRenewMode, navigate]);

  // Fetch live VIP game packages to display real-time coverage
  const { data: liveVipPackages = [] } = useQuery({
    queryKey: ["secure_vip_packages_subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("secure_vip_packages")
        .select("id, name, price, availability_status, combined_odds, booking_code")
        .order("id");
      if (error) return [];
      return data || [];
    },
  });

  // Fetch live selections count per package
  const { data: liveSelections = [] } = useQuery({
    queryKey: ["vip_package_fixtures_subs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_package_fixtures")
        .select("id, package_id");
      if (error) return [];
      return data || [];
    },
  });

  // Fetch dynamic subscription plans configured by admin
  const { data: dbPlans = [] } = useQuery({
    queryKey: ["subscription_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.warn("Could not fetch subscription_plans from DB, using defaults:", error);
        return [];
      }
      return data || [];
    },
  });

  const comboPlans = dbPlans.length > 0 && dbPlans.some((p: any) => p.category === "combo")
    ? dbPlans
        .filter((p: any) => p.category === "combo")
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          type: p.id.replace("sub_", ""),
          badge: p.badge || "Best Value",
          price: Number(p.price),
          originalPrice: p.original_price ? Number(p.original_price) : null,
          tagline: p.tagline,
          packagesCovered: p.packages_covered || [],
          features: p.features || [],
          highlight: p.id === "sub_all_access",
        }))
    : DEFAULT_COMBO_PLANS;

  const singlePlans = dbPlans.length > 0 && dbPlans.some((p: any) => p.category === "single")
    ? dbPlans
        .filter((p: any) => p.category === "single")
        .map((p: any) => {
          const fallback = DEFAULT_SINGLE_PLANS.find((s) => s.id === p.id);
          return {
            id: p.id,
            name: p.name,
            targetPkg: p.id.replace("sub_", ""),
            pkgTitle: fallback?.pkgTitle || p.name,
            price: Number(p.price),
            originalPrice: p.original_price ? Number(p.original_price) : null,
            oddsRange: fallback?.oddsRange || "High Odds",
            description: p.tagline || fallback?.description,
          };
        })
    : DEFAULT_SINGLE_PLANS;

  const hasActiveSub = (type: string) =>
    userSubscriptions.some((s: any) => {
      if (s.status !== "active") return false;
      if (new Date(s.expires_at) <= new Date()) return false;
      if (s.subscription_type === "all_access") return true;
      if (s.subscription_type === type) return true;
      if (type === "vip_combo" && (s.subscription_type === "silver" || s.subscription_type === "vip_tier")) return true;
      if (type === "vvip_combo" && (s.subscription_type === "gold" || s.subscription_type === "vvip_tier")) return true;
      if (type === "supreme_vvip" && (s.subscription_type === "supreme" || s.subscription_type === "platinum")) return true;
      return false;
    });

  // Check manual_payments for a directly matching pending sub payment.
  // Intentionally does NOT treat "sub_all_access" as pending for all types.
  const hasPendingManualSubPayment = (type: string) =>
    userManualPayments.some((p: any) =>
      p.status === "pending" &&
      (p.package_id === `sub_${type}` || p.package_id === type)
    );

  // Rejected = direct package match was rejected and no newer pending/approved payment supersedes it
  const hasRejectedSubPayment = (type: string) => {
    const directMatch = userManualPayments.find((p: any) =>
      p.status === "rejected" &&
      (p.package_id === `sub_${type}` || p.package_id === type)
    );
    if (!directMatch) return false;
    const superseded = userManualPayments.some((q: any) =>
      (q.package_id === `sub_${type}` || q.package_id === type) &&
      q.id !== directMatch.id &&
      new Date(q.created_at) > new Date(directMatch.created_at) &&
      (q.status === "pending" || q.status === "approved")
    );
    return !superseded;
  };

  // Pending = subscription row or payment is pending, BUT rejection overrides pending
  const hasPendingSub = (type: string) => {
    if (hasRejectedSubPayment(type)) return false;
    return (
      userSubscriptions.some((s: any) => s.status === "pending" && s.subscription_type === type) ||
      hasPendingManualSubPayment(type)
    );
  };

  const getSubRejectionReason = (type: string): string | null => {
    const rejected = userManualPayments.find((p: any) =>
      p.status === "rejected" &&
      (p.package_id === `sub_${type}` || p.package_id === type)
    );
    return rejected?.rejection_reason || null;
  };


  const activeSub = userSubscriptions.find(
    (s: any) => s.status === "active" && new Date(s.expires_at) > new Date()
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors">
      <SiteHeader />

      {/* Hero */}
      <section className="relative text-center px-6 pt-20 pb-16 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4/5 h-[320px] bg-emerald-500 rounded-full blur-[180px] opacity-10 dark:opacity-15 pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-6 border border-emerald-500/20">
          <Repeat className="w-4 h-4" /> Monthly VIP Membership
        </div>

        <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-black text-slate-900 dark:text-white mb-4 tracking-tight">
          Covers All <span className="text-emerald-600 dark:text-emerald-400">Game Packages</span>
        </h1>
        <p className="mx-auto text-slate-600 dark:text-slate-400 text-base font-medium w-[95%] sm:w-[92%] max-w-3xl leading-relaxed">
          Get continuous daily access to VIP 1, VIP 2, VVIP 1, VVIP 2, and SUPREME VVIP 👑 games with ready-to-copy SportyBet booking codes and emergency replacement safety net whenever a slip fails.
        </p>

        {/* Clear Notice on Recovery */}
        <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-medium border border-amber-500/20 max-w-2xl text-left">
          <RotateCcw className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span><strong>Important Note on Recovery:</strong> Replacement games are not published every day. They are opened as a safety net only on days when a VIP ticket suffers a lost game.</span>
        </div>

        {/* Tab switch */}
        <div className="mt-8 inline-flex items-center p-1.5 rounded-2xl bg-slate-200/80 dark:bg-slate-900/90 border border-slate-300 dark:border-white/10 shadow-inner">
          <button
            onClick={() => setPlanTab("combo")}
            className={`px-6 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer border-none ${
              planTab === "combo"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            ⭐ Complete Tier Passes
          </button>
          <button
            onClick={() => setPlanTab("single")}
            className={`px-6 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer border-none ${
              planTab === "single"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            🎯 Single Package Passes
          </button>
        </div>
      </section>

      <main className="flex-1 w-[95%] sm:w-[92%] max-w-7xl mx-auto px-5 pb-24 relative z-10">
        {/* Active Subscription Banner */}
        {activeSub && (
          <div className="mb-10 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-teal-500/10 border border-emerald-500/30 shadow-sm animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <BadgeCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {activeSub.subscription_type === "all_access"
                        ? "All-Access Monthly Pass Active — All Packages Unlocked!"
                        : `Monthly Subscription Active: ${activeSub.subscription_type.toUpperCase().replace("_", " ")}`}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      Active
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 m-0 mt-0.5">
                    Valid until: <strong className="text-slate-700 dark:text-slate-200">
                      {new Date(activeSub.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </strong>
                    {activeSub.subscription_type === "all_access" && " — you have automated access to VIP 1, VIP 2, VVIP 1, VVIP 2, and SUPREME VVIP."}
                  </p>
                </div>
              </div>
              <Link
                to="/dashboard"
                className="shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 no-underline"
              >
                Go to My Dashboard →
              </Link>
            </div>
          </div>
        )}

        {/* ── COMBO & TIER PLANS GRID ── */}
        {planTab === "combo" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20 animate-in fade-in duration-200">
            {comboPlans.map((plan: any) => {
              const active = hasActiveSub(plan.type);
              const pending = hasPendingSub(plan.type);
              const rejected = !active && !pending && hasRejectedSubPayment(plan.type);
              const rejectionReason = rejected ? getSubRejectionReason(plan.type) : null;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl overflow-hidden border flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                    plan.highlight
                      ? "bg-gradient-to-b from-slate-900 via-slate-900 to-black dark:from-slate-900 dark:to-black border-emerald-500/40 shadow-2xl shadow-emerald-500/15 md:col-span-2 lg:col-span-1"
                      : "bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border-slate-200 dark:border-white/5 shadow-xl hover:border-emerald-500/30 hover:shadow-emerald-500/10"
                  }`}
                >
                  {plan.highlight && plan.badge && (
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                        <Star className="w-3 h-3 fill-current" /> {plan.badge}
                      </span>
                    </div>
                  )}

                  {/* Top accent bar */}
                  <div className={`h-1.5 ${
                    plan.highlight
                      ? "bg-gradient-to-r from-emerald-400 via-amber-400 to-emerald-400"
                      : active
                      ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                      : "bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
                  }`} />

                  <div className="p-7 flex-1 flex flex-col">
                    {/* Header */}
                    <div className="mb-2 flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        plan.highlight ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      }`}>
                        {plan.highlight ? (
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                        ) : plan.type === "supreme_vvip" ? (
                          <Crown className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Zap className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>
                      <h3 className={`text-base font-black m-0 ${
                        plan.highlight ? "text-white" : "text-slate-900 dark:text-white"
                      }`}>{plan.name}</h3>
                    </div>

                    <p className={`text-[11px] mb-4 font-medium ${
                      plan.highlight ? "text-emerald-100/80" : "text-slate-500 dark:text-slate-400"
                    }`}>{plan.tagline}</p>

                    {/* Price with Strikethrough for Discount / Negotiation Leverage */}
                    <div className="mb-5 flex items-baseline gap-2 flex-wrap">
                      {plan.originalPrice && plan.originalPrice > plan.price && (
                        <span className={`text-xs line-through ${
                          plan.highlight ? "text-emerald-300/60" : "text-slate-400"
                        }`}>
                          GHS {plan.originalPrice}
                        </span>
                      )}
                      <span className={`text-sm font-bold ${
                        plan.highlight ? "text-emerald-200/70" : "text-slate-400"
                      }`}>GHS</span>
                      <span className={`text-[42px] font-black leading-none ${
                        plan.highlight ? "text-white" : "text-slate-900 dark:text-white"
                      }`}>{plan.price}</span>
                      <span className={`text-[11px] font-bold ${
                        plan.highlight ? "text-emerald-200/70" : "text-slate-400"
                      }`}>/month</span>
                    </div>

                    {/* Packages covered pill list */}
                    <div className="mb-5 pt-3 border-t border-slate-200/40 dark:border-white/10">
                      <p className={`text-[10px] font-black uppercase tracking-wider mb-2 ${
                        plan.highlight ? "text-emerald-300" : "text-slate-500 dark:text-slate-400"
                      }`}>Game Packages Covered:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {plan.packagesCovered.map((pkgName: string) => (
                          <span
                            key={pkgName}
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              plan.highlight
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10"
                            }`}
                          >
                            {pkgName}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="flex-1 flex flex-col gap-2.5 mb-7 list-none m-0 p-0">
                      {plan.features.map((f: string, i: number) => (
                        <li key={i} className={`flex items-start gap-2.5 text-[12px] font-medium ${
                          plan.highlight ? "text-slate-200" : "text-slate-600 dark:text-slate-300"
                        }`}>
                          <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                            plan.highlight ? "text-emerald-400" : "text-emerald-500"
                          }`} strokeWidth={3} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    {active ? (
                      <div className={`p-3.5 rounded-xl text-center flex items-center justify-center gap-2 font-extrabold text-[12px] ${
                        plan.highlight
                          ? "bg-white/20 text-white border border-white/30"
                          : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                      }`}>
                        <BadgeCheck className="w-4 h-4" /> Active Subscription
                      </div>
                    ) : pending ? (
                      <div className={`p-3.5 rounded-xl text-center flex items-center justify-center gap-2 font-extrabold text-[12px] ${
                        plan.highlight
                          ? "bg-white/20 text-amber-200 border border-amber-200/30"
                          : "bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400"
                      }`}>
                        <Clock className="w-4 h-4 animate-pulse" /> Under Review...
                      </div>
                    ) : rejected ? (
                      <div className="flex flex-col gap-2.5">
                        <div className={`p-3 rounded-xl text-left text-xs ${
                          plan.highlight
                            ? "bg-amber-500/15 text-amber-200 border border-amber-500/25"
                            : "bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border border-amber-500/20"
                        }`}>
                          <div className="flex items-center gap-1.5 font-bold mb-1">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Payment Verification Notice</span>
                          </div>
                          <p className="text-[11px] leading-relaxed opacity-90 m-0">
                            {rejectionReason || "We could not verify this transfer on our account statement. Please verify your details and resubmit."}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (!user) { navigate({ to: "/login" }); return; }
                            navigate({ to: "/checkout", search: { pkgId: plan.id } });
                          }}
                          className={`w-full p-3.5 rounded-xl font-extrabold text-[13px] flex items-center justify-center gap-2 transition-all border-none cursor-pointer ${
                            plan.highlight
                              ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30"
                              : "bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/10"
                          }`}
                        >
                          <RotateCcw className="w-4 h-4" />
                          Resubmit Payment — GHS {plan.price}/mo
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (!user) {
                            toast.error("Please log in to subscribe.");
                            navigate({ to: "/login" });
                            return;
                          }
                          navigate({ to: "/checkout", search: { pkgId: plan.id } });
                        }}
                        className={`w-full p-3.5 rounded-xl font-extrabold text-[13px] flex items-center justify-center gap-2 transition-all border-none cursor-pointer ${
                          plan.highlight
                            ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30 font-black"
                            : "bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/10"
                        }`}
                      >
                        <CalendarDays className="w-4 h-4" />
                        Subscribe — GHS {plan.price}/mo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── SINGLE PACKAGE PASSES GRID ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20 animate-in fade-in duration-200">
            {singlePlans.map((plan: any) => {
              const active = hasActiveSub(plan.targetPkg);
              const pending = hasPendingSub(plan.targetPkg);
              const rejected = !active && !pending && hasRejectedSubPayment(plan.targetPkg);
              const rejectionReason = rejected ? getSubRejectionReason(plan.targetPkg) : null;
              return (
                <div
                  key={plan.id}
                  className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 p-6 flex flex-col justify-between hover:border-emerald-500/30 transition-all shadow-md hover:shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {plan.oddsRange}
                      </span>
                      <span className="text-xs font-bold text-slate-400">30 Days</span>
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white m-0 mb-1">
                      {plan.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 font-medium leading-relaxed">
                      {plan.description}
                    </p>

                    {/* Price with Strikethrough for Discount / Negotiation Leverage */}
                    <div className="mb-6 flex items-baseline gap-2 flex-wrap">
                      {plan.originalPrice && plan.originalPrice > plan.price && (
                        <span className="text-xs line-through text-slate-400">
                          GHS {plan.originalPrice}
                        </span>
                      )}
                      <span className="text-xs font-bold text-slate-400">GHS</span>
                      <span className="text-3xl font-black text-slate-900 dark:text-white">{plan.price}</span>
                      <span className="text-[11px] font-bold text-slate-400">/month</span>
                    </div>

                    <ul className="list-none p-0 m-0 flex flex-col gap-2 mb-6">
                      <li className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Unlocks every {plan.pkgTitle} upload
                      </li>
                      <li className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Daily Sportybet booking codes included
                      </li>
                      <li className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        100% Replacement on spoilt slips
                      </li>
                    </ul>
                  </div>

                  {active ? (
                    <div className="p-3 rounded-xl text-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-extrabold flex items-center justify-center gap-1.5">
                      <BadgeCheck className="w-4 h-4" /> Active Subscription
                    </div>
                  ) : pending ? (
                    <div className="p-3 rounded-xl text-center bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-extrabold flex items-center justify-center gap-1.5">
                      <Clock className="w-4 h-4 animate-pulse" /> Under Review...
                    </div>
                  ) : rejected ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="p-3 rounded-xl text-left bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border border-amber-500/20 text-xs">
                        <div className="flex items-center gap-1.5 font-bold mb-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Verification Notice</span>
                        </div>
                        <p className="text-[11px] leading-relaxed opacity-90 m-0">
                          {rejectionReason || "Unable to confirm this transfer. Please review and resubmit."}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (!user) { navigate({ to: "/login" }); return; }
                          navigate({ to: "/checkout", search: { pkgId: plan.id } });
                        }}
                        className="w-full p-3 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-extrabold text-xs transition-all border-none cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Resubmit — GHS {plan.price}/mo
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (!user) {
                          toast.error("Please log in to subscribe.");
                          navigate({ to: "/login" });
                          return;
                        }
                        navigate({ to: "/checkout", search: { pkgId: plan.id } });
                      }}
                      className="w-full p-3 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-extrabold text-xs transition-all border-none cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      Subscribe — GHS {plan.price}/mo
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── ALL PACKAGES IN THE GAMES (LIVE REAL-TIME STATUS) ── */}
        <section className="mb-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-3">
              <Layers className="w-3.5 h-3.5" /> Full Game Coverage
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight m-0">
              Every Package in the Games, Covered
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
              Here is how each active package in our sports predictions system is fully unlocked with a monthly pass.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.entries(GAME_PACKAGES_METADATA).map(([pkgId, meta]) => {
              const livePkg = liveVipPackages.find((p: any) => p.id === pkgId);
              const matchCount = liveSelections.filter((s: any) => s.package_id === pkgId).length;
              const IconComp = meta.icon;

              return (
                <div
                  key={pkgId}
                  className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                          {meta.risk}
                        </span>
                        {livePkg?.availability_status === "available" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Now
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="text-lg font-black text-slate-900 dark:text-white m-0">
                      {livePkg?.name || meta.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                      {meta.tagline}
                    </p>

                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 mb-4">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Odds</span>
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {livePkg?.combined_odds ? `${Number(livePkg.combined_odds).toFixed(2)} Odds` : meta.typicalOdds}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Matches Today</span>
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {matchCount > 0 ? `${matchCount} Matches` : "Batch Loading"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Unlocked By:
                    </span>
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                      {meta.coveredBy}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── PACKAGE COVERAGE COMPARISON MATRIX ── */}
        <section className="mb-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight m-0">
              Subscription Plan Coverage Matrix
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-2">
              Compare which game packages and benefits are included in each monthly tier.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 shadow-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 font-extrabold">
                  <th className="p-4 sm:p-5">Game Package / Feature</th>
                  <th className="p-4 sm:p-5 text-center text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">All-Access (GHS 350)</th>
                  <th className="p-4 sm:p-5 text-center">Supreme VVIP (GHS 280)</th>
                  <th className="p-4 sm:p-5 text-center">VVIP Combo (GHS 220)</th>
                  <th className="p-4 sm:p-5 text-center">VIP Combo (GHS 120)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-slate-600 dark:text-slate-300 font-medium">
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-900 dark:text-white">VIP 1 Banker Games</td>
                  <td className="p-4 sm:p-5 text-center bg-emerald-500/5 font-extrabold text-emerald-600 dark:text-emerald-400">✅ Included</td>
                  <td className="p-4 sm:p-5 text-center text-slate-400">—</td>
                  <td className="p-4 sm:p-5 text-center text-slate-400">—</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-emerald-600 dark:text-emerald-400">✅ Included</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-900 dark:text-white">VIP 2 Value Multi-Bets</td>
                  <td className="p-4 sm:p-5 text-center bg-emerald-500/5 font-extrabold text-emerald-600 dark:text-emerald-400">✅ Included</td>
                  <td className="p-4 sm:p-5 text-center text-slate-400">—</td>
                  <td className="p-4 sm:p-5 text-center text-slate-400">—</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-emerald-600 dark:text-emerald-400">✅ Included</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-900 dark:text-white">VVIP 1 Premium High Odds</td>
                  <td className="p-4 sm:p-5 text-center bg-emerald-500/5 font-extrabold text-emerald-600 dark:text-emerald-400">✅ Included</td>
                  <td className="p-4 sm:p-5 text-center text-slate-400">—</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-emerald-600 dark:text-emerald-400">✅ Included</td>
                  <td className="p-4 sm:p-5 text-center text-slate-400">—</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-900 dark:text-white">VVIP 2 Mega Accumulators</td>
                  <td className="p-4 sm:p-5 text-center bg-emerald-500/5 font-extrabold text-emerald-600 dark:text-emerald-400">✅ Included</td>
                  <td className="p-4 sm:p-5 text-center text-slate-400">—</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-emerald-600 dark:text-emerald-400">✅ Included</td>
                  <td className="p-4 sm:p-5 text-center text-slate-400">—</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-900 dark:text-white">SUPREME VVIP 👑 Elite Slips</td>
                  <td className="p-4 sm:p-5 text-center bg-emerald-500/5 font-extrabold text-emerald-600 dark:text-emerald-400">✅ Included</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-emerald-600 dark:text-emerald-400">✅ Included</td>
                  <td className="p-4 sm:p-5 text-center text-slate-400">—</td>
                  <td className="p-4 sm:p-5 text-center text-slate-400">—</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-900 dark:text-white">Daily Booking Codes Auto-Unlocked</td>
                  <td className="p-4 sm:p-5 text-center bg-emerald-500/5 font-extrabold text-emerald-600 dark:text-emerald-400">✅ All Codes</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-emerald-600 dark:text-emerald-400">✅ Supreme Code</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-emerald-600 dark:text-emerald-400">✅ VVIP Codes</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-emerald-600 dark:text-emerald-400">✅ VIP Codes</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-900 dark:text-white">Emergency Replacement Cover (If Slips Fail)</td>
                  <td className="p-4 sm:p-5 text-center bg-emerald-500/5 font-extrabold text-emerald-600 dark:text-emerald-400">✅ Priority Cover</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-emerald-600 dark:text-emerald-400">✅ Priority Cover</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-emerald-600 dark:text-emerald-400">✅ Included</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-emerald-600 dark:text-emerald-400">✅ Included</td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-900 dark:text-white">Billing Duration</td>
                  <td className="p-4 sm:p-5 text-center bg-emerald-500/5 font-extrabold text-slate-900 dark:text-white">Full 30 Days</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-slate-900 dark:text-white">Full 30 Days</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-slate-900 dark:text-white">Full 30 Days</td>
                  <td className="p-4 sm:p-5 text-center font-extrabold text-slate-900 dark:text-white">Full 30 Days</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Feature Highlights Banner ── */}
        <section className="mb-20 p-8 sm:p-12 rounded-3xl bg-slate-900 text-white border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs mb-4 border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" /> The A1-TIPSDECK Guarantee
            </span>
            <h2 className="text-2xl sm:text-3xl font-black mb-4 tracking-tight">
              Why Punter Groups Prefer Monthly Subscriptions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8">
              <div>
                <p className="font-extrabold text-base text-emerald-400 mb-1">⚡ Automatic Access</p>
                <p className="text-slate-400 text-xs leading-relaxed m-0">
                  New package uploads unlock immediately in your account. Never miss match kickoffs waiting for manual confirmation.
                </p>
              </div>
              <div>
                <p className="font-extrabold text-base text-emerald-400 mb-1">💰 Huge Savings</p>
                <p className="text-slate-400 text-xs leading-relaxed m-0">
                  Single tickets add up rapidly. A monthly pass saves you up to 60% compared to purchasing daily slips individually.
                </p>
              </div>
              <div>
                <p className="font-extrabold text-base text-emerald-400 mb-1">🔄 Recovery Safety Net</p>
                <p className="text-slate-400 text-xs leading-relaxed m-0">
                  If games spoil, an emergency replacement slip is opened so you can recover your stake (opened only when slips fail, not everyday).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQs ── */}
        <section className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white m-0">Frequently Asked Questions</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 m-0">Everything you need to know about our VIP memberships</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FAQS.map((faq, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 shadow-sm">
                <p className="font-bold text-sm text-slate-900 dark:text-white mb-2 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  {faq.q}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed m-0 pl-6">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
