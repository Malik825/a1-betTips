import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, ShoppingCart, Clock, Crown, Check, Copy, Eye, EyeOff, Search, Trophy, Filter, Sparkles, Repeat } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PAYSTACK_ENABLED, paystackPay } from "@/lib/paystack";
import { hasUserPurchasedPackage } from "@/lib/ticket-utils";


export const Route = createFileRoute("/predictions")({
  head: () => ({
    meta: [
      { title: "Today's Predictions — A1-TIPSDECK" },
      { name: "description", content: "Expert football analytics data and predictions for today's matches." },
    ],
  }),
  component: PredictionsPage,
});

function getDateISO(offset: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0]!;
}

function getSmartInitialDate(dates: (string | undefined)[]): string {
  const today = getDateISO(0);
  const tomorrow = getDateISO(1);
  const yesterday = getDateISO(-1);

  const validDates = dates.filter(Boolean) as string[];
  if (validDates.length === 0) return today;

  // 1. If today has games, show today
  if (validDates.includes(today)) return today;

  // 2. If tomorrow has games, show tomorrow
  if (validDates.includes(tomorrow)) return tomorrow;

  // 3. If any future date has games, show earliest upcoming date
  const futureDates = validDates.filter((d) => d > today).sort();
  if (futureDates.length > 0) return futureDates[0]!;

  // 4. If yesterday has games, show yesterday
  if (validDates.includes(yesterday)) return yesterday;

  // 5. If past dates have games, show most recent past date
  const pastDates = validDates.filter((d) => d < today).sort().reverse();
  if (pastDates.length > 0) return pastDates[0]!;

  return today;
}

type Result = "pending" | "won" | "lost";

function ResultBadge({ result, score }: { result: Result; score?: string | undefined }) {
  if (result === "pending") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: "50%",
        background: "#fef3c7", color: "#92400e", fontWeight: 800, fontSize: 15,
        boxShadow: "0 2px 4px rgba(0,0,0,0.07)"
      }}>?</span>
    );
  }
  const won = result === "won";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      padding: "2px 10px",
      borderRadius: 4,
      background: won ? "#dcfce7" : "#fee2e2",
      color: won ? "#166534" : "#991b1b",
      fontWeight: 700, fontSize: 12,
      boxShadow: "0 2px 4px rgba(0,0,0,0.07)"
    }}>
      {won ? "Won" : "Lost"}
    </span>
  );
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  available: { bg: "#dcfce7", color: "#166534" },
  sold_out: { bg: "#fee2e2", color: "#991b1b" },
  draft: { bg: "#f1f5f9", color: "#64748b" },
};

function PredictionsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [targetDate, setTargetDate] = useState<string>(getDateISO(0));
  const [userSelected, setUserSelected] = useState<boolean>(false);
  const [revealCode, setRevealCode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeague, setSelectedLeague] = useState("ALL");
  const [initializingPkg, setInitializingPkg] = useState<string | null>(null);
  const [pkgFilter, setPkgFilter] = useState<"active" | "results">("active");

  const { data: adminSettings } = useQuery({
    queryKey: ["public_admin_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("payment_gateway, paystack_public_key, kora_public_key")
        .eq("id", 1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") return null;
      return data;
    },
  });

  const { data: userPendingPayments = [] } = useQuery({
    queryKey: ["user_manual_payments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("manual_payments")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending");
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
  });

  const hasPendingPayment = (pkgId: string) => {
    return userPendingPayments.some((p: any) => p.package_id === pkgId);
  };

  const handleQuickSelect = (offset: number) => {
    setUserSelected(true);
    setTargetDate(getDateISO(offset));
    setSearchQuery("");
    setSelectedLeague("ALL");
  };

  // —— Data ————————————————————————————————————————————————————
  const { data: fixtures = [], isLoading: fixturesLoading } = useQuery({
    queryKey: ["fixtures"],
    queryFn: async () => {
      return []; // No longer needed for free predictions, keeping to prevent breaking vip fallback
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: allFreePredictions = [], isLoading: freeLoading } = useQuery({
    queryKey: ["free_predictions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("predictions").select(`
        *,
        fixtures (id, home_team, away_team, competition, match_time, match_date_iso, sport)
      `).order("id", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });

  // Prefer joined fixture data, fall back to separate fixtures query
  const resolveFixture = (sel: any) => {
    let fix = sel.fixtures ?? sel.fixture ?? fixtures.find((f: any) => f.id === sel.fixture_id) ?? null;
    if (Array.isArray(fix)) fix = fix[0];
    return fix;
  };

  // Auto-switch to day with games if today has none (and user hasn't explicitly clicked a tab)
  useEffect(() => {
    if (userSelected) return;
    if (!allFreePredictions || allFreePredictions.length === 0) return;

    const dates = allFreePredictions.map((p: any) => {
      const fix = resolveFixture(p);
      return fix?.match_date_iso;
    });
    const smartDate = getSmartInitialDate(dates);
    if (smartDate !== targetDate) {
      setTargetDate(smartDate);
    }
  }, [allFreePredictions, userSelected]);

  // Filter by selected date
  const predsForDate = (date: string) => allFreePredictions.filter((p: any) => {
    const fix = resolveFixture(p);
    const fixtureDate = fix?.match_date_iso;
    if (!fixtureDate) return date === getDateISO(0);
    return fixtureDate === date;
  });

  const freePredictions = predsForDate(targetDate);


  const { data: vipPackages = [], isLoading: vipLoading } = useQuery({
    queryKey: ["public_vip_packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_packages")
        .select("*")
        .in("availability_status", ["available", "sold_out"])
        .neq("id", "recovery")
        .order("id");
      if (error) throw error;
      return (data || []).filter((p: any) => p.id !== "recovery");
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });

  const { data: vipSelections = [], isLoading: vipSelectionsLoading } = useQuery({
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
    staleTime: 1000 * 60 * 5,
  });

  const { data: vipHistory = [] } = useQuery({
    queryKey: ["vip_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_history")
        .select("*")
        .order("settled_date", { ascending: false })
        .limit(20);
      if (error) {
        return [];
      }
      return data || [];
    },
    staleTime: 1000 * 60,
  });

  const freeIsLoading = freeLoading;
  const packagesIsLoading = vipLoading || vipSelectionsLoading;

  const { data: userTickets = [] } = useQuery({
    queryKey: ["user_tickets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from("user_tickets").select("*").eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  // Daily settings (status + booking code for the free tips)
  const { data: dailySettings } = useQuery({
    queryKey: ["daily_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_settings")
        .select("*")
        .eq("status", "available")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const freeBetStatus = (dailySettings as any)?.status || "draft";
  const freeBetCode = (dailySettings as any)?.free_booking_code || null;

  const todayFreePreds = freePredictions;

  // Extract unique leagues for current date
  const uniqueLeagues = Array.from(
    new Set(
      todayFreePreds
        .map((p: any) => resolveFixture(p)?.competition || "Other Matches")
        .filter(Boolean)
    )
  ).sort() as string[];

  // Filter by search query & selected league
  const filteredFreePreds = todayFreePreds.filter((pred: any) => {
    const fix = resolveFixture(pred);
    const comp = fix?.competition || "Other Matches";
    const home = fix?.home_team || "";
    const away = fix?.away_team || "";
    const tip = pred.tip || "";

    const matchesLeague = selectedLeague === "ALL" || comp === selectedLeague;
    const matchesSearch =
      !searchQuery.trim() ||
      home.toLowerCase().includes(searchQuery.toLowerCase()) ||
      away.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tip.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesLeague && matchesSearch;
  });

  // Group filtered predictions by competition
  const groupedFreePreds = filteredFreePreds.reduce((acc: Record<string, any[]>, pred: any) => {
    const fix = resolveFixture(pred);
    const comp = fix?.competition || "Other Matches";
    if (!acc[comp]) acc[comp] = [];
    acc[comp].push(pred);
    return acc;
  }, {});

  const hasPurchased = (pkgId: string) => {
    const pkg = vipPackages.find((p) => p.id === pkgId);
    return pkg ? hasUserPurchasedPackage(userTickets, pkg) : false;
  };


  // Package overall result
  const pkgResult = (pkgId: string, pkg?: any): string => {
    // Trust the DB-stored result_status on the package first (set by admin settle action)
    if (pkg?.result_status && pkg.result_status !== "pending") return pkg.result_status;
    // Fallback: compute from individual selection statuses
    const sels = vipSelections.filter((s) => s.package_id === pkgId);
    if (!sels.length) return "pending";
    if (sels.some((s) => s.result_status === "lost")) return "lost";
    if (sels.every((s) => s.result_status === "won")) return "won";
    return "pending";
  };

  // Dynamically calculate combined odds from selections
  const calcCombinedOdds = (pkgId: string): number | null => {
    const sels = vipSelections.filter((s) => s.package_id === pkgId);
    if (!sels.length) return null;
    const product = sels.reduce((acc, sel) => acc * (Number(sel.odds) || 1), 1);
    return product;
  };

  // â”€â”€ Buy mutation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const buyMutation = useMutation({
    mutationFn: async ({ packageId, reference }: { packageId: string; reference?: string }) => {
      if (!user) throw new Error("Not logged in");
      const pkg = vipPackages.find(p => p.id === packageId);
      const pkgSels = vipSelections.filter(s => s.package_id === packageId);
      const snapshot = pkgSels.map(sel => {
        const fix = resolveFixture(sel);
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

      const ticketPayload: any = {
        id: `ticket_${Date.now()}`,
        package_id: packageId,
        user_id: user.id,
        payment_ref: reference,
        booking_code: pkg?.booking_code || null,
        snapshot: snapshot.length > 0 ? snapshot : null,
        amount_paid: Number(pkg?.price || 0),
      };

      const { error } = await supabase.from("user_tickets").insert(ticketPayload);
      if (error) {
        if (error.message?.includes("column")) {
          const { error: fallbackError } = await supabase.from("user_tickets").insert({
            id: ticketPayload.id,
            package_id: packageId,
            user_id: user.id,
            payment_ref: reference,
          });
          if (fallbackError) throw fallbackError;
        } else {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_tickets"] });
      toast.success("Package purchased! Redirecting to your dashboard...");
      navigate({ to: "/dashboard" });
    },
    onError: (err: any) => toast.error(err.message || "Purchase failed."),
  });

  const handleBuy = async (packageId: string) => {
    if (!user) {
      toast.error("Please log in to purchase this package.");
      navigate({ to: "/login" });
      return;
    }

    const pkg = vipPackages.find(p => p.id === packageId);
    if (!pkg) return;

    if (Number(pkg.price) === 0) {
      buyMutation.mutate({ packageId });
      return;
    }

    const activeGateway = adminSettings?.payment_gateway || "manual";

    // 1. Manual Mobile Money transfer
    if (activeGateway === "manual") {
      navigate({ to: "/checkout", search: { pkgId: packageId } });
      return;
    }

    // 2. Kora Pay (fallback to manual until credentials live)
    if (activeGateway === "kora") {
      navigate({ to: "/checkout", search: { pkgId: packageId } });
      return;
    }

    // 3. Paystack gateway
    setInitializingPkg(packageId);
    const opened = await paystackPay(
      user.email || "",
      Number(pkg.price),
      packageId,
      (reference) => {
        setInitializingPkg(null);
        buyMutation.mutate({ packageId, reference });
      },
      () => {
        setInitializingPkg(null);
      }
    );

    if (!opened) {
      setInitializingPkg(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors flex flex-col w-full">
      <SiteHeader />

      <main className="flex-1 overflow-x-hidden">

        {/* ??? HERO ??? */}
        <section className="relative overflow-hidden bg-slate-900 dark:bg-slate-950 transition-colors pt-32 pb-20 px-6 flex flex-col items-center justify-center text-center">
          {/* subtle grid overlay */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg,currentColor 0,currentColor 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,currentColor 0,currentColor 1px,transparent 1px,transparent 60px)' }} />

          <div className="absolute -top-40 right-0 w-[500px] h-[500px] rounded-full bg-green-500/10 blur-[120px] pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto">
            <span className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-extrabold tracking-[0.2em] uppercase shadow-lg shadow-green-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Daily Insights
            </span>
            <h1 className="text-white text-[clamp(2.4rem,5vw,4rem)] font-black leading-tight tracking-tight mb-4">
              {targetDate === getDateISO(0) ? "Today's" : targetDate === getDateISO(1) ? "Tomorrow's" : targetDate === getDateISO(-1) ? "Yesterday's" : "Upcoming"}{" "}
              <span className="text-green-500 drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]">Predictions</span>
            </h1>
            <p className="text-slate-400 text-sm sm:text-base font-medium max-w-lg mx-auto mb-10">
              Expert football analytics data, free daily picks, and premium VIP packages to boost your winning rate.
            </p>

            {/* Day tabs + custom datepicker */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <div className="inline-flex bg-white/5 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-xl shadow-black/20">
                {[-1, 0, 1].map((offset) => {
                  const dateISO = getDateISO(offset);
                  const label = offset === -1 ? "Yesterday" : offset === 0 ? "Today" : "Tomorrow";
                  const isActive = targetDate === dateISO;
                  return (
                    <button
                      key={offset}
                      onClick={() => handleQuickSelect(offset)}
                      className={`px-6 py-2.5 rounded-full border-none cursor-pointer font-bold text-[12px] transition-all duration-300 ${isActive
                        ? "bg-green-500 text-black shadow-[0_4px_15px_rgba(34,197,94,0.3)] scale-[1.02]"
                        : "bg-transparent text-slate-400 hover:text-white hover:bg-white/5"
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => {
                    setUserSelected(true);
                    setTargetDate(e.target.value);
                  }}
                  className="px-4 py-2 rounded-full border border-white/10 text-green-400 bg-white/5 backdrop-blur-md font-bold text-[12px] focus:outline-none focus:ring-2 focus:ring-green-500/50 cursor-pointer shadow-xl shadow-black/20 transition-all hover:bg-white/10"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── FREE TIPS ─── */}
        <section className="py-16 px-6">
          <div className="w-[95%] sm:w-[92%] max-w-5xl mx-auto">

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 font-extrabold text-[10px] uppercase tracking-widest mb-2">
                  <Sparkles className="w-3 h-3 text-green-500" /> Daily Analytics
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight m-0">Free Daily Picks</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 mb-0 font-medium">Expert analysis updated daily across top leagues</p>
              </div>

              {/* Search & Status Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search teams or league..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-medium outline-none focus:ring-2 focus:ring-green-500/50 shadow-sm"
                  />
                </div>

                <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm">
                  <Clock className="w-3.5 h-3.5 text-green-500" />
                  Updated Recently
                </div>
              </div>
            </div>

            {/* Competition Filter Pills (if multiple leagues exist) */}
            {uniqueLeagues.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
                <button
                  onClick={() => setSelectedLeague("ALL")}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${selectedLeague === "ALL"
                    ? "bg-green-500 text-black shadow-lg shadow-green-500/20"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:text-slate-900 dark:hover:text-white"
                    }`}
                >
                  All Leagues ({todayFreePreds.length})
                </button>

                {uniqueLeagues.map((league) => {
                  const count = todayFreePreds.filter((p: any) => (resolveFixture(p)?.competition || "Other Matches") === league).length;
                  return (
                    <button
                      key={league}
                      onClick={() => setSelectedLeague(league)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${selectedLeague === league
                        ? "bg-green-500 text-black shadow-lg shadow-green-500/20 font-black"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                      <Trophy className="w-3 h-3 text-amber-500" />
                      {league} <span className="text-[10px] opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Free Tips Table Card */}
            <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 overflow-hidden">

              {/* Table Column Headers */}
              <div className="grid grid-cols-[2fr_1fr_80px] sm:grid-cols-[2fr_1fr_1fr_80px] bg-slate-100/80 dark:bg-black/40 p-4 sm:px-7 border-b border-slate-200 dark:border-white/10">
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest">Match / League</span>
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest">Tip</span>
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest hidden sm:block">Odds</span>
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest text-right">Result</span>
              </div>

              {/* Rows Grouped By Competition */}
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {freeIsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-[2fr_1fr_80px] sm:grid-cols-[2fr_1fr_1fr_80px] items-center p-4 sm:p-5 px-4 sm:px-7 gap-4">
                      <div className="animate-pulse">
                        <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-[80%] mb-2" />
                        <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-[50%]" />
                      </div>
                      <div className="animate-pulse h-4 bg-slate-200 dark:bg-white/10 rounded w-[60%]" />
                      <div className="animate-pulse h-4 bg-slate-200 dark:bg-white/10 rounded w-[40%] hidden sm:block" />
                      <div className="animate-pulse h-[30px] w-[30px] bg-slate-200 dark:bg-white/10 rounded-full ml-auto" />
                    </div>
                  ))
                ) : filteredFreePreds.length === 0 ? (
                  <div className="py-16 px-5 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4 border border-slate-200 dark:border-white/10 shadow-inner">
                      {searchQuery ? <Filter className="w-8 h-8 text-slate-400" /> : <Clock className="w-8 h-8 text-slate-400" />}
                    </div>
                    <h3 className="text-slate-900 dark:text-white font-black text-lg mb-1">
                      {searchQuery || selectedLeague !== "ALL"
                        ? "No matching games found"
                        : targetDate === getDateISO(0)
                          ? "No Tips Yet Today"
                          : targetDate === getDateISO(1)
                            ? "No Tips for Tomorrow Yet"
                            : "No Tips for this Date"}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium max-w-[340px] mb-6 leading-relaxed">
                      {searchQuery || selectedLeague !== "ALL"
                        ? `No predictions match your current search or league filter. Try clearing filters to see all available picks.`
                        : targetDate === getDateISO(0)
                          ? "Our analysts are currently finalizing today's selections. Check back shortly or explore VIP packages below!"
                          : "No predictions found for this date. Check today's or tomorrow's tips!"}
                    </p>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {(searchQuery || selectedLeague !== "ALL") && (
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setSelectedLeague("ALL");
                          }}
                          className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer border-none"
                        >
                          Clear Filters
                        </button>
                      )}

                      {targetDate !== getDateISO(0) && (
                        <button
                          onClick={() => handleQuickSelect(0)}
                          className="px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer border-none"
                        >
                          View Today's Predictions
                        </button>
                      )}

                      <a
                        href="#vip-packages"
                        className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-800 dark:text-white font-bold text-xs uppercase tracking-wider transition-all border border-slate-200 dark:border-white/10 no-underline inline-flex items-center gap-1.5"
                      >
                        <Crown className="w-3.5 h-3.5 text-yellow-500" /> Explore VIP Packages
                      </a>
                    </div>
                  </div>
                ) : (
                  Object.entries(groupedFreePreds).map(([leagueName, preds]: [string, any]) => (
                    <div key={leagueName} className="flex flex-col">
                      {/* Competition Group Header */}
                      <div className="bg-slate-50/90 dark:bg-slate-800/40 px-4 sm:px-7 py-2.5 flex items-center justify-between border-y border-slate-200/60 dark:border-white/5">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="font-black text-[11px] sm:text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                            {leagueName}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                          {preds.length} {preds.length === 1 ? "match" : "matches"}
                        </span>
                      </div>

                      {/* Matches in this competition */}
                      <ul className="m-0 p-0 list-none divide-y divide-slate-100 dark:divide-white/5">
                        {preds.map((pred: any) => {
                          const fix = resolveFixture(pred);
                          return (
                            <li key={pred.id} className="grid grid-cols-[2fr_1fr_80px] sm:grid-cols-[2fr_1fr_1fr_80px] items-center p-4 sm:p-5 px-4 sm:px-7 hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                              <div>
                                <span className="font-extrabold text-slate-900 dark:text-white text-[12px] sm:text-[13px] tracking-tight">
                                  {fix ? (
                                    <>
                                      {fix.home_team} <span className="text-slate-400 font-normal mx-1">vs</span> {fix.away_team}
                                    </>
                                  ) : (
                                    <span className="text-slate-400">Match TBC</span>
                                  )}
                                </span>
                                {fix && (
                                  <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold tracking-wide uppercase flex items-center gap-2">
                                    <span>{fix.match_time}</span>
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] sm:text-[11px] font-black text-slate-900 dark:text-white">{pred.tip}</span>
                              <span className="text-[11px] sm:text-[12px] font-black text-green-600 dark:text-green-500 hidden sm:block">
                                {pred.odds ? Number(pred.odds).toFixed(2) : "—"}
                              </span>
                              <div className="flex justify-end">
                                <ResultBadge result={pred.result} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </div>

              {/* Free Booking Code Vault Bar */}
              <div className="bg-slate-50 dark:bg-black/30 border-t border-slate-200 dark:border-white/10 px-6 py-5 flex flex-col sm:flex-row items-center gap-5 justify-between">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/20">
                    <Lock className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 dark:text-white text-sm mb-0.5 tracking-tight">Free Booking Code</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium m-0 leading-tight">
                      {freeBetCode && freeBetStatus === "available"
                        ? "Load this code directly on your preferred platform."
                        : "Code is not yet available."}
                    </p>
                  </div>
                </div>

                {freeBetCode && freeBetStatus === "available" ? (
                  !revealCode ? (
                    <button
                      onClick={() => setRevealCode(true)}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-gray-100 text-white dark:text-black font-black text-[12px] uppercase tracking-wider rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-black/20 dark:shadow-white/10 border-none cursor-pointer"
                    >
                      Show Code
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(freeBetCode);
                        toast.success(`Booking code: ${freeBetCode} — copied!`, { duration: 6000 });
                      }}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-black font-black text-[12px] uppercase tracking-wider rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-green-500/25 border-none cursor-pointer"
                    >
                      <Copy className="w-4 h-4" /> {freeBetCode}
                    </button>
                  )
                ) : (
                  <span className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-dashed border-slate-300 dark:border-white/20 text-slate-400 dark:text-slate-500 text-[11px] font-black uppercase tracking-widest bg-slate-100/50 dark:bg-white/5">
                    Coming Soon
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* VIP PACKAGES */}
        <section id="vip-packages" className="py-12 px-6 bg-slate-100 dark:bg-slate-950 transition-colors border-t border-slate-200 dark:border-white/5 relative">

          <div className="w-[95%] sm:w-[92%] max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 text-[10px] font-extrabold tracking-[0.2em] uppercase">
                <Crown className="w-3.5 h-3.5 text-yellow-500" /> Premium
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight m-0">VIP Packages</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-3 mb-0 font-medium max-w-md mx-auto">
                Unlock exclusive high-odds predictions and guaranteed returns with our premium tiers.
              </p>
              <div className="mt-5 flex items-center justify-center">
                <Link
                  to="/subscriptions"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20 transition-all hover:scale-105 no-underline shadow-sm"
                >
                  <Repeat className="w-3.5 h-3.5 text-emerald-500" />
                  Looking for unlimited packages? Monthly Subscriptions from GHS 50/mo →
                </Link>
              </div>
            </div>

            {packagesIsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col shadow-xl">
                    <div className="h-1 bg-slate-200 dark:bg-white/10" />
                    <div className="p-8 flex-1 flex flex-col animate-pulse">
                      <div className="flex justify-between mb-6">
                        <div className="h-6 bg-slate-200 dark:bg-white/10 rounded w-1/2" />
                        <div className="h-5 bg-slate-200 dark:bg-white/10 rounded-full w-20" />
                      </div>
                      <div className="h-10 bg-slate-200 dark:bg-white/10 rounded w-1/3 mb-6" />
                      <div className="h-24 bg-slate-100 dark:bg-white/5 rounded-xl mb-6" />
                      <div className="h-14 bg-slate-200 dark:bg-white/10 rounded-xl mt-auto" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (() => {
              const allVisible = vipPackages
                .filter((pkg) => pkg.id !== "recovery")
                .filter((pkg) => {
                  const pkgSels = vipSelections.filter((s) => s.package_id === pkg.id);
                  const purchased = hasPurchased(pkg.id);
                  return pkgSels.length > 0 || purchased;
                });

              const activePackages = allVisible.filter(pkg => pkgResult(pkg.id, pkg) === "pending");
              const resultsPackages = allVisible.filter(pkg => pkgResult(pkg.id, pkg) !== "pending");
              const totalResultsCount = resultsPackages.length + vipHistory.length;
              const visiblePackages = pkgFilter === "active" ? activePackages : resultsPackages;
              const hasVisibleContent = pkgFilter === "active" ? activePackages.length > 0 : totalResultsCount > 0;
              const showTabs = allVisible.length > 0 || vipHistory.length > 0;

              if (allVisible.length === 0 && vipHistory.length === 0) {
                return (
                  <div className="py-20 text-center bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <Crown className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <h3 className="text-slate-900 dark:text-white font-black text-xl mb-2">No VIP Packages Right Now</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
                      Our premium packages for today have either sold out or are currently being finalized.
                    </p>
                  </div>
                );
              }

              return (
                <>
                  {/* Active / Results filter tabs */}
                  {showTabs && (
                    <div className="flex items-center justify-center mb-8">
                      <div className="inline-flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-1.5 shadow-lg shadow-slate-200/50 dark:shadow-black/30 gap-1">
                        <button
                          onClick={() => setPkgFilter("active")}
                          className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-200 border-none cursor-pointer ${
                            pkgFilter === "active"
                              ? "bg-green-500 text-black shadow-md shadow-green-500/30"
                              : "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                          }`}
                        >
                          🟢 Active
                          <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] ${
                            pkgFilter === "active" ? "bg-black/20 text-white" : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400"
                          }`}>{activePackages.length}</span>
                        </button>
                        <button
                          onClick={() => setPkgFilter("results")}
                          className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-200 border-none cursor-pointer ${
                            pkgFilter === "results"
                              ? "bg-slate-800 dark:bg-white text-white dark:text-black shadow-md"
                              : "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                          }`}
                        >
                          📊 Results
                          <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] ${
                            pkgFilter === "results" ? "bg-white/20 text-white dark:bg-black/20 dark:text-black" : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400"
                          }`}>{totalResultsCount}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!hasVisibleContent ? (
                    <div className="py-16 text-center bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                      <Crown className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                      <h3 className="text-slate-900 dark:text-white font-black text-lg mb-1">
                        {pkgFilter === "active" ? "No Active Packages Right Now" : "No Settled Packages Yet"}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
                        {pkgFilter === "active"
                          ? "Today's packages are being finalized. Check back soon."
                          : "Results and verified winning tickets will appear here once packages are settled."}
                      </p>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {visiblePackages.map((pkg) => {
                    const pkgSels = vipSelections.filter((s) => s.package_id === pkg.id);
                    const purchased = hasPurchased(pkg.id);
                    const avail = pkg.availability_status || "sold_out";
                    const isAvailable = avail === "available";
                    const isFree = false; // Never show FREE
                    const isSettled = pkgResult(pkg.id, pkg) !== "pending";
                    const dynamicOdds = pkgSels.length > 0
                      ? pkgSels.reduce((acc, sel) => acc * (Number(sel.odds) || 1), 1)
                      : null;

                    return (
                      <div key={pkg.id} className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/50 flex flex-col relative transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-green-500/10 hover:border-green-500/30">
                        {/* Accent glow on top edge */}
                        <div className={`absolute top-0 left-0 right-0 h-1 ${isAvailable ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-slate-300 dark:bg-slate-700'}`} />

                        <div className="p-8 flex-1 flex flex-col">

                          {/* Title + status */}
                          <div className="flex justify-between items-start mb-6">
                            <h2 className="text-2xl font-black m-0 text-slate-900 dark:text-white tracking-tight">{pkg.name}</h2>
                            <div className="flex items-center gap-2">
                              {pkgResult(pkg.id, pkg) !== "pending" && (
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 ${
                                  pkgResult(pkg.id, pkg) === "won"
                                    ? "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30"
                                    : "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30"
                                }`}>
                                  {pkgResult(pkg.id, pkg) === "won" ? "✓ WON" : "✗ LOST"}
                                </span>
                              )}
                              <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${isAvailable ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'}`}>
                                {isAvailable ? "Available" : "Sold Out"}
                              </span>
                            </div>
                          </div>

                          {/* Price */}
                          <div className="mb-6 flex items-baseline gap-2">
                            <span className="text-xl font-black text-slate-400 dark:text-slate-500">GHS</span>
                            <span className="text-[44px] font-black text-slate-900 dark:text-white leading-none tracking-tighter">{Number(pkg.price).toFixed(2)}</span>
                          </div>

                          {/* Combined odds — only visible to buyers */}
                          {dynamicOdds && purchased && (
                            <div className="mb-6 inline-flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-inner">
                              <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest">Combined Odds</span>
                              <span className="text-xl font-black text-green-600 dark:text-green-400">{Number(dynamicOdds).toFixed(2)}</span>
                            </div>
                          )}

                          {/* Match list */}
                          <div className="mb-8 flex-1">
                            <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              Included Matches
                              <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-[9px] text-slate-700 dark:text-slate-300">{pkgSels.length}</span>
                            </h3>
                            {pkgSels.length > 0 ? (
                              <ul className="m-0 p-0 list-none flex flex-col gap-4">
                                {pkgSels.map((sel: any) => {
                                  const fix = resolveFixture(sel);
                                  return (
                                    <li key={sel.id} className="flex items-start justify-between gap-3">
                                      <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className={`w-2 h-2 rounded-full shrink-0 mt-[6px] ${
                                          sel.result_status === "won" ? "bg-green-500 shadow-[0_0_8px_#4ade80]" :
                                          sel.result_status === "lost" ? "bg-red-500 shadow-[0_0_8px_#ef4444]" :
                                          "bg-green-500 shadow-[0_0_8px_#4ade80]"
                                        }`} />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[13px] text-slate-900 dark:text-white font-bold leading-tight">
                                            {fix ? <>{fix.home_team} <span className="text-slate-400 font-normal text-[11px] mx-0.5">vs</span> {fix.away_team}</> : "Match TBC"}
                                          </div>
                                          {fix && (
                                            <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold uppercase tracking-wide">
                                              {fix.match_time} • {fix.competition}
                                            </div>
                                          )}
                                          {(purchased || sel.result_status === "won" || sel.result_status === "lost") ? (
                                            <div className="inline-flex mt-1.5 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded border border-slate-200 dark:border-white/10 text-[10px] text-green-600 dark:text-green-400 font-black tracking-wide">
                                              Tip: {sel.prediction}
                                            </div>
                                          ) : (
                                            <div className="inline-flex mt-1.5 items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded border border-dashed border-slate-300 dark:border-white/10 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                              <Lock size={9} /> Locked
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      {sel.result_status && sel.result_status !== "pending" && (
                                        <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                          sel.result_status === "won"
                                            ? "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/20"
                                            : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20"
                                        }`}>
                                          {sel.result_status === "won" ? "✓ Won" : "✗ Lost"}
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-[12px] text-slate-500 dark:text-slate-400 italic m-0 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 text-center">
                                {purchased ? "Matches will be added shortly." : "Matches hidden until purchased."}
                              </p>
                            )}
                          </div>

                          {/* Booking code lock — only show if not settled or user purchased */}
                          {(!isSettled || purchased) && (
                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-300 dark:border-white/20 mb-6 flex items-center gap-3">
                              <Lock className="w-4 h-4 text-slate-400" />
                              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                                Booking code unlocked upon purchase
                              </span>
                            </div>
                          )}

                          {/* CTA */}
                          {purchased ? (
                            <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30 text-center text-green-700 dark:text-green-400 font-black text-[13px] flex items-center justify-center gap-2">
                              <Check className="w-5 h-5" />
                              Secured - Check Dashboard
                            </div>
                          ) : hasPendingPayment(pkg.id) ? (
                            <button
                              onClick={() => navigate({ to: "/checkout", search: { pkgId: pkg.id } })}
                              className="w-full p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold text-[13px] flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-amber-500/20"
                            >
                              <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                              Payment Under Review — View Details
                            </button>
                          ) : isSettled ? (
                            <div className="p-4 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-center text-slate-500 dark:text-slate-400 font-black text-[12px] flex items-center justify-center gap-2 uppercase tracking-wider">
                              <Trophy className="w-4 h-4" />
                              Results Final — Package Closed
                            </div>
                          ) : (
                            <button
                              disabled={!isAvailable || buyMutation.isPending || initializingPkg === pkg.id}
                              onClick={() => handleBuy(pkg.id)}
                              className={`w-full p-4 rounded-xl border-none font-black text-[13px] flex items-center justify-center gap-2 transition-all shadow-xl uppercase tracking-wider ${buyMutation.isPending || !isAvailable || initializingPkg === pkg.id
                                ? "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none"
                                : "bg-green-500 text-black cursor-pointer hover:-translate-y-0.5 hover:shadow-green-500/30"
                                }`}
                            >
                              {buyMutation.isPending ? (
                                "Processing..."
                              ) : initializingPkg === pkg.id ? (
                                "Opening secure checkout..."
                              ) : !isAvailable ? (
                                "Sold Out"
                              ) : (
                                <>
                                  <ShoppingCart className="w-5 h-5" /> Buy Now GHS {pkg.price}
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Archived Historical Settled Batches */}
                  {pkgFilter === "results" && vipHistory.map((item: any) => {
                    const isWon = item.result_status === "won";
                    const selections = Array.isArray(item.selections) ? item.selections : [];
                    const dateFormatted = item.settled_date
                      ? new Date(item.settled_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "Settled Batch";

                    return (
                      <div key={item.id} className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/50 flex flex-col relative transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl">
                        {/* Top accent glow */}
                        <div className={`absolute top-0 left-0 right-0 h-1 ${
                          isWon ? 'bg-gradient-to-r from-emerald-400 to-green-600' : 'bg-gradient-to-r from-red-500 to-rose-600'
                        }`} />

                        <div className="p-8 flex-1 flex flex-col">
                          {/* Title + Won/Lost badge */}
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <h2 className="text-2xl font-black m-0 text-slate-900 dark:text-white tracking-tight">{item.package_name}</h2>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
                                {dateFormatted}
                              </p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 ${
                              isWon
                                ? "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30"
                                : "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30"
                            }`}>
                              {isWon ? "✓ WON" : "✗ LOST"}
                            </span>
                          </div>

                          {/* Odds & Booking Code summary */}
                          <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Combined Odds</span>
                              <span className="text-xl font-black text-green-600 dark:text-green-400">
                                {item.combined_odds ? `${Number(item.combined_odds).toFixed(2)}` : "—"}
                              </span>
                            </div>
                            {item.booking_code && (
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Booking Code</span>
                                <span className="text-xs font-mono font-black text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-white/10 px-2 py-1 rounded">
                                  {item.booking_code}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Selections list */}
                          <div className="mb-8 flex-1">
                            <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              Settled Matches
                              <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-[9px] text-slate-700 dark:text-slate-300">
                                {selections.length}
                              </span>
                            </h3>
                            {selections.length > 0 ? (
                              <ul className="m-0 p-0 list-none flex flex-col gap-4">
                                {selections.map((sel: any, idx: number) => (
                                  <li key={idx} className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                      <div className={`w-2 h-2 rounded-full shrink-0 mt-[6px] ${
                                        sel.result_status === "won" ? "bg-green-500 shadow-[0_0_8px_#4ade80]" :
                                        sel.result_status === "lost" ? "bg-red-500 shadow-[0_0_8px_#ef4444]" :
                                        "bg-slate-400"
                                      }`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-[13px] text-slate-900 dark:text-white font-bold leading-tight">
                                          {sel.home_team} <span className="text-slate-400 font-normal text-[11px] mx-0.5">vs</span> {sel.away_team}
                                        </div>
                                        {sel.competition && (
                                          <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold uppercase tracking-wide">
                                            {sel.competition}
                                          </div>
                                        )}
                                        <div className="inline-flex mt-1.5 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded border border-slate-200 dark:border-white/10 text-[10px] text-green-600 dark:text-green-400 font-black tracking-wide">
                                          Tip: {sel.prediction} {sel.odds ? `(${sel.odds})` : ""}
                                        </div>
                                      </div>
                                    </div>
                                    {sel.result_status && (
                                      <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                        sel.result_status === "won"
                                          ? "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/20"
                                          : "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20"
                                      }`}>
                                        {sel.result_status === "won" ? "✓ Won" : "✗ Lost"}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[12px] text-slate-500 dark:text-slate-400 italic m-0 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 text-center">
                                Matches archived.
                              </p>
                            )}
                          </div>

                          {/* Results Final Banner */}
                          <div className="p-4 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-center text-slate-500 dark:text-slate-400 font-black text-[13px] uppercase tracking-wider flex items-center justify-center gap-2">
                            Results Final — Verified
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </>
            );
          })()}
          </div>
        </section>
      </main>


      <SiteFooter />
    </div>
  );
}




