import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, ShoppingCart, Clock, Crown, Check, Copy, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PAYSTACK_ENABLED, paystackPay } from "@/lib/paystack";


export const Route = createFileRoute("/predictions")({
  head: () => ({
    meta: [
      { title: "Today's Predictions — A1 GROUP INSIGHTS" },
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
  sold_out:  { bg: "#fee2e2", color: "#991b1b" },
  draft:     { bg: "#f1f5f9", color: "#64748b" },
};

function PredictionsPage() {
  const [targetDate, setTargetDate] = useState<string>(getDateISO(0));
  const [userSelected, setUserSelected] = useState<boolean>(false);
  const [revealCode, setRevealCode] = useState(false);
  
  const handleQuickSelect = (offset: number) => {
    setUserSelected(true);
    setTargetDate(getDateISO(offset));
  };

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

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
    staleTime: 1000 * 60 * 5,
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
    queryKey: ["vip_packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_packages")
        .select("*")
        .in("availability_status", ["available", "sold_out"])
        .order("id");
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
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

  const hasPurchased = (pkgId: string) =>
    userTickets.some((t) => t.package_id === pkgId);


  // Package overall result
  const pkgResult = (pkgId: string): string => {
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
      const { error } = await supabase.from("user_tickets").insert({
        id: `ticket_${Date.now()}`,
        package_id: packageId,
        user_id: user.id,
        payment_ref: reference,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_tickets"] });
      toast.success("Package purchased! Redirecting to your dashboard...");
      navigate({ to: "/dashboard" });
    },
    onError: (err: any) => toast.error(err.message || "Purchase failed."),
  });

  const handleBuy = (packageId: string) => {
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

    paystackPay(user.email || "", Number(pkg.price), packageId, (reference) => {
      buyMutation.mutate({ packageId, reference });
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans transition-colors flex flex-col w-full">
      <SiteHeader />

      <main className="flex-1 overflow-x-hidden">
        
        {/* ??? HERO ??? */}
        <section className="relative overflow-hidden bg-slate-900 dark:bg-slate-950 transition-colors pt-32 pb-20 px-6 flex flex-col items-center justify-center text-center">
          {/* subtle grid overlay */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] pointer-events-none" style={{backgroundImage:'repeating-linear-gradient(0deg,currentColor 0,currentColor 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,currentColor 0,currentColor 1px,transparent 1px,transparent 60px)'}} />
          
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
                      className={`px-6 py-2.5 rounded-full border-none cursor-pointer font-bold text-[12px] transition-all duration-300 ${
                        isActive
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
        <section className="py-20 px-6">
          <div className="w-[95%] sm:w-[92%] max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight m-0">Free Daily Picks</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 mb-0 font-medium">Expert analysis updated daily across 40+ leagues</p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm">
                <Clock className="w-3.5 h-3.5 text-green-500" />
                Updated 2 hours ago
              </div>
            </div>

            {/* Free Tips Table Card */}
            <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-200 dark:border-white/10 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[2fr_1fr_80px] sm:grid-cols-[2fr_1fr_1fr_80px] bg-slate-50 dark:bg-black/20 p-4 sm:px-7 border-b border-slate-200 dark:border-white/10">
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest">Match</span>
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest">Tip</span>
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest hidden sm:block">Odds</span>
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest text-right">Result</span>
              </div>

              {/* Rows */}
              <ul className="m-0 p-0 list-none">
                {freeIsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="grid grid-cols-[2fr_1fr_80px] sm:grid-cols-[2fr_1fr_1fr_80px] items-center p-4 sm:p-5 px-4 sm:px-7 border-b border-slate-100 dark:border-white/5 gap-4">
                      <div className="animate-pulse">
                        <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-[80%] mb-2" />
                        <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-[50%]" />
                      </div>
                      <div className="animate-pulse h-4 bg-slate-200 dark:bg-white/10 rounded w-[60%]" />
                      <div className="animate-pulse h-4 bg-slate-200 dark:bg-white/10 rounded w-[40%] hidden sm:block" />
                      <div className="animate-pulse h-[30px] w-[30px] bg-slate-200 dark:bg-white/10 rounded-full ml-auto" />
                    </li>
                  ))
                ) : todayFreePreds.length === 0 ? (
                  <div className="py-20 px-5 text-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-white/10 shadow-inner">
                      <Clock className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-slate-900 dark:text-white font-black text-lg mb-1">
                      {targetDate === getDateISO(0) ? "No Tips Yet Today" : targetDate === getDateISO(1) ? "No Tips for Tomorrow Yet" : "No Tips for this Date"}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium max-w-[280px] mx-auto m-0">
                      {targetDate === getDateISO(0)
                        ? "Our analysts are currently finalizing today's selections. Check back shortly!"
                        : targetDate === getDateISO(1)
                        ? "Tomorrow's selections will be posted as soon as analysis is complete."
                        : "No predictions found for this date. Check today's or tomorrow's tips!"}
                    </p>
                  </div>
                ) : (
                  todayFreePreds.map((pred: any, i: number) => {
                    const fix = resolveFixture(pred);
                    return (
                      <li key={pred.id} className={`grid grid-cols-[2fr_1fr_80px] sm:grid-cols-[2fr_1fr_1fr_80px] items-center p-4 sm:p-5 px-4 sm:px-7 hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors ${i < todayFreePreds.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''}`}>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white text-[11px] sm:text-[12px] tracking-tight">
                            {fix ? <>{fix.home_team} <span className="text-slate-400 font-normal mx-1">vs</span> {fix.away_team}</> : <span className="text-slate-400">Match TBC</span>}
                          </span>
                          {fix && (
                            <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-bold tracking-wide uppercase">
                              {fix.competition} • {fix.match_time}
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
                  })
                )}
              </ul>

              {/* Free Booking Code Vault Bar */}
              <div className="bg-slate-50 dark:bg-black/30 border-t border-slate-200 dark:border-white/10 px-6 py-5 flex flex-col sm:flex-row items-center gap-5 justify-between">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 border border-green-500/20">
                    <Lock className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 dark:text-white text-sm mb-0.5 tracking-tight">Free Booking Code</p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium m-0 leading-tight">
                      {!user
                        ? "Log in to unlock today's Sportybet code."
                        : freeBetCode && freeBetStatus === "available"
                        ? "Load this directly on Sportybet."
                        : "Code is not yet available."}
                    </p>
                  </div>
                </div>

                {!user ? (
                  <button
                    onClick={() => navigate({ to: "/login" })}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-gray-100 text-white dark:text-black font-black text-[12px] uppercase tracking-wider rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-black/20 dark:shadow-white/10 border-none cursor-pointer"
                  >
                    Log In to Reveal
                  </button>
                ) : freeBetCode && freeBetStatus === "available" ? (
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

        {/* ??? VIP PACKAGES ??? */}
        <section className="py-12 px-6 bg-slate-100 dark:bg-slate-950 transition-colors border-t border-slate-200 dark:border-white/5 relative">
          
          <div className="w-[95%] sm:w-[92%] max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 text-[10px] font-extrabold tracking-[0.2em] uppercase">
                <Crown className="w-3.5 h-3.5 text-yellow-500" /> Premium
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight m-0">VIP Packages</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-3 mb-0 font-medium max-w-md mx-auto">
                Unlock exclusive high-odds predictions and guaranteed returns with our premium tiers.
              </p>
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
              const visiblePackages = vipPackages.filter((pkg) => {
                const pkgSels = vipSelections.filter((s) => s.package_id === pkg.id);
                const purchased = hasPurchased(pkg.id);
                
                // Show if it has fixtures OR it's a drafted one that user already bought
                return pkgSels.length > 0 || purchased;
              });

              if (visiblePackages.length === 0) {
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {visiblePackages.map((pkg) => {
                    const pkgSels = vipSelections.filter((s) => s.package_id === pkg.id);
                    const purchased = hasPurchased(pkg.id);
                    const avail = pkg.availability_status || "sold_out";
                    const isAvailable = avail === "available";
                    const isFree = false; // Never show FREE
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
                            <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${isAvailable ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'}`}>
                              {isAvailable ? "Available" : "Sold Out"}
                            </span>
                          </div>

                          {/* Price */}
                          <div className="mb-6 flex items-baseline gap-2">
                            <span className="text-xl font-black text-slate-400 dark:text-slate-500">GHS</span>
                            <span className="text-[44px] font-black text-slate-900 dark:text-white leading-none tracking-tighter">{Number(pkg.price).toFixed(2)}</span>
                          </div>

                          {/* Combined odds */}
                          {dynamicOdds && (
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
                                    <li key={sel.id} className="flex items-start gap-3">
                                      <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-[6px] shadow-[0_0_8px_#4ade80]" />
                                      <div>
                                        <div className="text-[13px] text-slate-900 dark:text-white font-bold leading-tight">
                                          {fix ? <>{fix.home_team} <span className="text-slate-400 font-normal text-[11px] mx-0.5">vs</span> {fix.away_team}</> : "Match TBC"}
                                        </div>
                                        {fix && (
                                          <div className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold uppercase tracking-wide">
                                            {fix.match_time} • {fix.competition}
                                          </div>
                                        )}
                                        <div className="inline-flex mt-1.5 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded border border-slate-200 dark:border-white/10 text-[10px] text-green-600 dark:text-green-400 font-black tracking-wide">
                                          {sel.prediction}{sel.odds ? ` @ ${Number(sel.odds).toFixed(2)}` : ""}
                                        </div>
                                      </div>
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

                          {/* Booking code lock */}
                          <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-300 dark:border-white/20 mb-6 flex items-center gap-3">
                            <Lock className="w-4 h-4 text-slate-400" />
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-bold">
                              Booking code unlocked upon purchase
                            </span>
                          </div>

                          {/* CTA */}
                          {purchased ? (
                            <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30 text-center text-green-700 dark:text-green-400 font-black text-[13px] flex items-center justify-center gap-2">
                              <Check className="w-5 h-5" />
                              Secured — Check Dashboard
                            </div>
                          ) : (
                            <button
                              disabled={!isAvailable || buyMutation.isPending || (!isFree && !PAYSTACK_ENABLED)}
                              onClick={() => handleBuy(pkg.id)}
                              className={`w-full p-4 rounded-xl border-none font-black text-[13px] flex items-center justify-center gap-2 transition-all shadow-xl uppercase tracking-wider ${
                                buyMutation.isPending || !isAvailable || (!isFree && !PAYSTACK_ENABLED)
                                  ? "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none"
                                  : "bg-green-500 text-black cursor-pointer hover:-translate-y-0.5 hover:shadow-green-500/30"
                              }`}
                            >
                              {buyMutation.isPending ? (
                                "Processing..."
                              ) : !isAvailable ? (
                                "Sold Out"
                              ) : (!isFree && !PAYSTACK_ENABLED) ? (
                                <>
                                  <Lock className="w-5 h-5" /> Payment Coming Soon
                                </>
                              ) : (
                                <>
                                  <ShoppingCart className="w-5 h-5" /> Secure Package
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}




