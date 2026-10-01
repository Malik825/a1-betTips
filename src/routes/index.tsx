import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Crown, MessageCircle, Send, ShieldCheck, Target, TrendingUp, Lock, Copy, Check, ArrowRight, Zap, Star, Trophy, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";


import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useContactLinks } from "@/lib/contact-links";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import heroBgImage from "@/assets/hero-bg.png";
import heroMobileBgImage from "@/assets/hero-mobile-bg-generated.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "A1-TIPSDECK — Premium Sports Analytics & Predictions" },
      { name: "description", content: "Daily sports predictions plus a VIP feed. Verified results, expert analysis and premium picks from the A1-TipsDeck team." },
      { property: "og:title", content: "A1-TIPSDECK — Premium Sports Analytics" },
      { property: "og:description", content: "Free daily football predictions plus a VIP feed with verified results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const stats = [
  { value: "95%", label: "Win Rate", icon: Trophy },
  { value: "10K+", label: "Happy Users", icon: Star },
  { value: "5★", label: "User Rating", icon: Zap },
];

const features = [
  {
    icon: Target,
    title: "Expert Analysis",
    body: "Deep statistical research and market insights power our predictions across 40+ leagues worldwide.",
    accent: "#1d4ed8",
  },
  {
    icon: TrendingUp,
    title: "Consistent Profits",
    body: "Our track record speaks for itself — 95% accuracy with tips designed for real, sustainable returns.",
    accent: "#F5A623",
  },
  {
    icon: ShieldCheck,
    title: "Trusted by Thousands",
    body: "Join a thriving community of successful sports enthusiasts who rely on A1-TIPSDECK daily for their edge.",
    accent: "#60a5fa",
  },
];

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

function ResultBadge({ result }: { result: string }) {
  if (result === "pending" || !result) {
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 font-bold text-[9px] tracking-wide">LIVE</span>;
  }
  const won = result === "won";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[9px] tracking-wide ${won ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}>
      {won ? "✓ WON" : "✗ LOST"}
    </span>
  );
}

function HomePage() {
  const links = useContactLinks();
  const [targetDate, setTargetDate] = useState<string>(getDateISO(0));
  const [userSelected, setUserSelected] = useState<boolean>(false);

  const handleQuickSelect = (offset: number) => {
    setUserSelected(true);
    setTargetDate(getDateISO(offset));
  };

  const { data: allTips = [], isLoading } = useQuery({
    queryKey: ["predictions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("predictions").select(`
        *,
        fixtures (id, home_team, away_team, match_date_iso, match_time, competition)
      `).order("id", { ascending: true });
      if (error) throw error;

      return (data || []).map((p: any) => {
        let fix = p.fixtures ?? p.fixture;
        if (Array.isArray(fix)) fix = fix[0];
        return {
          id: p.id,
          match: fix ? `${fix.home_team} vs ${fix.away_team}` : "Match TBC",
          tip: p.tip as string,
          result: (p.result || "pending") as string,
          odds: p.odds as number | undefined,
          time: fix?.match_time as string | undefined,
          date: fix?.match_date_iso as string | undefined,
          competition: fix?.competition as string | undefined,
        };
      });
    },
    staleTime: 1000 * 60 * 5,
  });

  // Auto-switch to day with games if today has none (and user hasn't explicitly clicked a tab)
  useEffect(() => {
    if (userSelected) return;
    if (!allTips || allTips.length === 0) return;

    const dates = allTips.map((t: any) => t.date);
    const smartDate = getSmartInitialDate(dates);
    if (smartDate !== targetDate) {
      setTargetDate(smartDate);
    }
  }, [allTips, userSelected]);

  // Filter by selected date
  const tipsForDate = (date: string) => allTips.filter(t => {
    if (!t.date) return date === getDateISO(0);
    return t.date === date;
  });

  const tips = tipsForDate(targetDate);

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

  const freeBetCode = dailySettings?.free_booking_code;
  const freeBetStatus = dailySettings?.status;
  const hasFreeCode = !!freeBetCode && freeBetStatus === "available";
  const [revealFree, setRevealFree] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Scroll-reveal refs â€” one per major section
  const statsRef = useScrollReveal();
  const featuresRef = useScrollReveal();
  const tipsRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      toast.success("Booking code copied!");
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans transition-colors flex flex-col w-full">
      <SiteHeader />

      <main className="flex-1 overflow-x-hidden">
        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden bg-[#03150f] sm:min-h-[100svh] flex flex-col justify-end items-center">

          {/* ── Mobile BG (portrait players, top-aligned) ── */}
          <div
            className="absolute -top-[120px] inset-x-0 h-[calc(100%+120px)] bg-cover bg-top sm:hidden"
            style={{ backgroundImage: `url(${heroMobileBgImage})` }}
          />

          {/* ── Desktop BG (landscape artwork) ── */}
          <div
            className="absolute inset-0 bg-cover bg-center hidden sm:block"
            style={{ backgroundImage: `url(${heroBgImage})` }}
          />

          {/* ── Base dark overlay across both mobile and desktop ── */}
          <div className="absolute inset-0 pointer-events-none bg-black/30" />

          {/* ── Desktop: dark tint overlay + bottom gradient to highlight players while ensuring text readability ── */}
          <div className="absolute inset-0 pointer-events-none hidden sm:block bg-black/30" />
          <div className="absolute inset-0 pointer-events-none hidden sm:block bg-[linear-gradient(to_bottom,rgba(3,21,15,0.15)_0%,rgba(3,21,15,0.35)_40%,rgba(3,21,15,0.85)_70%,#03150f_98%)]" />

          {/* ── Mobile: bottom-to-top gradient for text readability ── */}
          <div className="absolute inset-0 pointer-events-none sm:hidden bg-[linear-gradient(to_bottom,rgba(0,10,7,0)_0%,rgba(0,10,7,0.2)_35%,rgba(0,18,12,0.7)_55%,rgba(3,21,15,0.95)_75%,#03150f_88%)]" />

          {/* ══════════════════════════════════════════════
              DESKTOP LAYOUT: Centered & pushed to bottom so players' faces are seen
          ══════════════════════════════════════════════ */}
          <div className="hidden sm:flex relative z-10 w-full max-w-4xl mx-auto px-6 pt-[36vh] pb-12 sm:pb-16 flex-col items-center text-center gap-4">

            {/* Brand pill */}
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-green-500/20 border border-green-400/40 text-green-300 text-[11px] font-extrabold tracking-[0.2em] uppercase backdrop-blur-sm shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              A1-TipsDeck
            </span>

            {/* Headline */}
            <h1 className="text-white text-[clamp(2.5rem,4.5vw,4.5rem)] font-black leading-[1.05] tracking-tight drop-shadow-2xl">
              Analyze Smarter. <span className="text-green-400 drop-shadow-[0_0_30px_rgba(34,197,94,0.45)]">Win More.</span>
            </h1>

            {/* Description */}
            <p className="text-slate-200/90 text-[clamp(1rem,1.3vw,1.15rem)] leading-relaxed max-w-xl mx-auto drop-shadow">
              Expert sports analytics, free daily insights, and premium VIP data packages.
            </p>

            {/* CTA row */}
            <div className="flex items-center justify-center gap-4 mt-1">
              <Link
                to="/vip"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-extrabold py-3.5 px-8 rounded-xl text-[15px] tracking-wide transition-all hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(34,197,94,0.35)]"
              >
                👑 Join VIP
              </Link>
              <a
                href="#free-tips"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-semibold py-3.5 px-8 rounded-xl text-[15px] tracking-wide transition-all hover:-translate-y-0.5"
              >
                View Free Tips →
              </a>
            </div>

            {/* Social */}
            <div className="flex items-center justify-center gap-3 mt-1">
              <span className="text-slate-300 text-[11px] font-bold uppercase tracking-widest">Follow us:</span>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://t.me/+S6zQhRKDOV02YjJk"
                className="flex items-center gap-1.5 bg-[#229ED9]/20 hover:bg-[#229ED9]/30 border border-[#229ED9]/40 text-[#229ED9] font-bold text-xs px-4 py-1.5 rounded-full transition-colors"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 496 512" className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg">
                  <path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm121.8 169.9l-40.7 191.8c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 6.1-12.5 6.1l4.4-63.1 114.9-103.8c5-4.4-1.1-6.9-7.7-2.5l-142 89.4-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l239.1-92.2c11.1-4 20.8 2.7 17.2 19.5z" />
                </svg>
                Telegram
              </a>
            </div>

          </div>

          {/* ══════════════════════════════════════════════
              MOBILE LAYOUT: stacked, text below players
          ══════════════════════════════════════════════ */}
          <div className="sm:hidden relative z-10 w-full px-5 pb-6 pt-[26vh] flex flex-col items-center gap-3 text-center">

            {/* brand pill */}
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/30 border border-green-400/70 text-green-300 text-[10px] font-extrabold tracking-[0.18em] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              A1-TipsDeck
            </span>

            {/* headline */}
            <h1 className="text-white text-[clamp(1.9rem,8vw,2.8rem)] font-black leading-[1.0] tracking-tight whitespace-nowrap">
              Analyze Smarter.<br />
              <span className="text-green-400">Win More.</span>
            </h1>

            {/* description */}
            <p className="text-slate-200 text-[12px] leading-[1.5] max-w-[320px]">
              Expert sports analytics, free daily insights, and premium VIP data packages.
            </p>

            {/* CTAs */}
            <div className="flex flex-col gap-2.5 w-full max-w-[360px] mt-1">
              <Link
                to="/vip"
                className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-black font-extrabold h-12 rounded-2xl text-sm tracking-wide transition-all"
              >
                👑 Join VIP
              </Link>
              <a
                href="#free-tips"
                className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/35 text-white font-bold h-12 rounded-2xl text-sm tracking-wide transition-all"
              >
                View Free Tips →
              </a>
            </div>

            {/* Social */}
            <div className="flex items-center justify-center gap-3 mt-1">
              <span className="text-slate-300 text-[11px] font-bold uppercase tracking-widest">Follow us:</span>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://t.me/+S6zQhRKDOV02YjJk"
                className="flex items-center gap-1.5 bg-[#229ED9]/20 hover:bg-[#229ED9]/30 border border-[#229ED9]/40 text-[#229ED9] font-bold text-xs px-4 py-1.5 rounded-full transition-colors"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 496 512" className="w-3 h-3" xmlns="http://www.w3.org/2000/svg">
                  <path d="M248 8C111 8 0 119 0 256s111 248 248 248 248-111 248-248S385 8 248 8zm121.8 169.9l-40.7 191.8c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 6.1-12.5 6.1l4.4-63.1 114.9-103.8c5-4.4-1.1-6.9-7.7-2.5l-142 89.4-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l239.1-92.2c11.1-4 20.8 2.7 17.2 19.5z" />
                </svg>
                Telegram
              </a>
            </div>

          </div>
        </section>

        {/* â”€â”€â”€ STATS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {/* ??? STATS MARQUEE ??? */}
        {/* ??? STATS MARQUEE ??? */}
        <section ref={statsRef} className="py-10 bg-slate-50 dark:bg-slate-950 transition-colors overflow-hidden relative border-y border-slate-200 dark:border-white/5">
          <style>{`
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .animate-marquee {
              animation: marquee 40s linear infinite;
            }
            .animate-marquee:hover {
              animation-play-state: paused;
            }
          `}</style>

          <div className="flex w-max animate-marquee relative z-10">
            {/* Render 4 sets of stats to ensure a smooth continuous loop */}
            {[...Array(4)].map((_, groupIndex) => (
              <div key={groupIndex} className="flex items-center justify-around w-[120vw] sm:w-[100vw] lg:w-[70vw]">
                {stats.map((s, i) => (
                  <div key={`${groupIndex}-${s.label}`} className="flex items-center gap-2 sm:gap-4 px-4 sm:px-8">
                    <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                      <s.icon className="w-4 h-4 sm:w-6 sm:h-6 text-green-500" />
                    </div>
                    <div className="flex flex-col text-left">
                      <p className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white m-0 leading-none tracking-tight">{s.value}</p>
                      <p className="text-[8px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold tracking-[0.2em] uppercase mt-1">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ??? FEATURES ??? */}
        <section ref={featuresRef} className="py-20 px-6 bg-white dark:bg-black transition-colors">
          <div className="w-[95%] sm:w-[92%] max-w-6xl mx-auto">
            <div className="sr sr-up text-center mb-14">
              <h2 className="text-[clamp(1.8rem,4vw,2.6rem)] font-black text-slate-900 dark:text-white mb-3 tracking-tight">
                Why Choose <span className="text-green-500">A1-TIPSDECK?</span>
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-[13px] font-medium max-w-[480px] mx-auto">
                We provide the most accurate and profitable analytics data in the industry
              </p>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-8">
              {features.map((f, i) => (
                <div key={f.title} className={`sr sr-up sr-delay-${i + 1} group p-8 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 hover:border-green-500/30 hover:shadow-xl hover:shadow-green-500/5 transition-all duration-300 hover:-translate-y-1`}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110" style={{ background: `${f.accent}18`, color: f.accent }}>
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-[15px] text-slate-900 dark:text-white mb-3">{f.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[12px] leading-relaxed font-medium m-0">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* â”€â”€â”€ FREE TIPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section ref={tipsRef} className="py-20 px-6 bg-slate-50 dark:bg-slate-950 transition-colors">
          <div className="w-[95%] sm:w-[92%] max-w-6xl mx-auto">
            <div className="sr sr-up text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-600 dark:text-green-400 font-bold text-sm mb-4">
                <Zap className="w-4 h-4" /> Daily Picks
              </div>
              <h2 className="text-[clamp(1.8rem,4vw,2.6rem)] font-black text-slate-900 dark:text-white mb-3 tracking-tight">
                Free Tips & <span className="text-green-500">Predictions</span>
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-[13px] font-medium">Expert analysis, updated daily across 40+ leagues</p>
            </div>

            {/* Day tabs */}
            <div className="flex justify-center mb-8">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="inline-flex bg-slate-200 dark:bg-slate-900 rounded-full p-1 gap-1">
                  <button
                    onClick={() => handleQuickSelect(-1)}
                    className={`px-5 py-2 rounded-full border-none cursor-pointer font-bold text-[11px] transition-all ${targetDate === getDateISO(-1)
                      ? "bg-green-500 text-white dark:text-black shadow-[0_2px_8px_rgba(34,197,94,0.35)]"
                      : "bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    Yesterday
                  </button>
                  <button
                    onClick={() => handleQuickSelect(0)}
                    className={`px-5 py-2 rounded-full border-none cursor-pointer font-bold text-[11px] transition-all ${targetDate === getDateISO(0)
                      ? "bg-green-500 text-white dark:text-black shadow-[0_2px_8px_rgba(34,197,94,0.35)]"
                      : "bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => handleQuickSelect(1)}
                    className={`px-5 py-2 rounded-full border-none cursor-pointer font-bold text-[11px] transition-all ${targetDate === getDateISO(1)
                      ? "bg-green-500 text-white dark:text-black shadow-[0_2px_8px_rgba(34,197,94,0.35)]"
                      : "bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                  >
                    Tomorrow
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => {
                      setUserSelected(true);
                      setTargetDate(e.target.value);
                    }}
                    className="px-4 py-2 rounded-xl border-2 border-green-500 text-green-600 dark:text-green-400 bg-white dark:bg-slate-900 font-bold text-[13px] focus:outline-none focus:ring-4 focus:ring-green-500/20 cursor-pointer shadow-sm transition-all hover:border-green-400"
                  />
                </div>
              </div>
            </div>

            {/* Table container with Booking Code */}
            <div className="w-full bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-2xl dark:shadow-black/50 transition-colors mb-8">
              {/* Header row */}
              <div className="grid grid-cols-[2fr_1fr_80px] sm:grid-cols-[2fr_1fr_1fr_80px] bg-green-500 text-white font-extrabold text-[9px] sm:text-[11px] uppercase tracking-wider py-4 px-4 sm:px-7 border-b border-green-600/20">
                <span>Match</span>
                <span>Tip</span>
                <span className="hidden sm:block">Odds</span>
                <span className="text-right">Result</span>
              </div>

              <ul className="m-0 p-0 list-none flex flex-col">
                {isLoading ? (
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
                ) : tips.length === 0 ? (
                  <div className="py-16 px-5 text-center bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-white/5">
                    <div className="w-16 h-16 bg-slate-200/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-slate-700 dark:text-slate-300 font-bold text-[15px] mb-2">
                      {targetDate === getDateISO(0) ? "No Free Tips Today" : targetDate === getDateISO(1) ? "No Free Tips for Tomorrow" : "No Free Tips"}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-[13px] font-medium max-w-[280px] mx-auto m-0">
                      {targetDate === getDateISO(0)
                        ? "Our analysts are still cooking up today's free selections. Check back later!"
                        : "Our analysts have not published tips for this date yet. Check back soon!"}
                    </p>
                  </div>
                ) : (
                  tips.map((tip, i) => (
                    <li key={`${tip.match}-${i}`} className={`grid grid-cols-[2fr_1fr_80px] sm:grid-cols-[2fr_1fr_1fr_80px] items-center p-4 sm:p-5 px-4 sm:px-7 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${i < tips.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : 'border-b border-slate-100 dark:border-white/5'}`}>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white text-[11px] sm:text-[13px]">
                          {!!tip.match && tip.match !== "TBC" && tip.match.includes(" vs ") ? (
                            <>
                              {tip.match.split(" vs ")[0]} <span className="text-slate-400 font-normal">vs</span> {tip.match.split(" vs ")[1]}
                            </>
                          ) : (
                            <span className={tip.match === "Match TBC" || tip.match === "TBC" ? "text-slate-400" : ""}>{tip.match || "Match TBC"}</span>
                          )}
                        </span>
                        {tip.time && (
                          <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                            {tip.time}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] sm:text-[12px] font-bold text-slate-900 dark:text-white">{tip.tip}</span>
                      <span className="text-[11px] sm:text-[13px] font-extrabold text-green-600 dark:text-green-500 hidden sm:block">
                        {tip.odds ? Number(tip.odds).toFixed(2) : "—"}
                      </span>
                      <div className="flex justify-end">
                        <ResultBadge result={tip.result} />
                      </div>
                    </li>
                  ))
                )}
              </ul>

              {/* ─── FREE BOOKING CODE — always visible below table ─── */}
              <div className="border-t border-slate-200 dark:border-white/10 px-4 sm:px-7 py-5 bg-green-500/5 dark:bg-green-500/5 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 dark:text-white text-[14px] mb-0.5">Free Booking Code</p>
                  <p className="text-slate-500 dark:text-slate-400 text-[12px] m-0">
                    {!user
                      ? "Log in to access today's free booking code."
                      : freeBetCode && freeBetStatus === "available"
                        ? "Copy the code below and load it directly."
                        : "The free booking code for this day hasn't been published yet. Check back soon!"}
                  </p>
                </div>
                {!user ? (
                  <button
                    onClick={() => navigate({ to: "/login" })}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-800 dark:bg-white/10 hover:bg-slate-700 text-white font-extrabold text-[12px] rounded-xl transition-all hover:scale-105 border-none cursor-pointer whitespace-nowrap"
                  >
                    <Lock className="w-4 h-4" /> Log In to Reveal
                  </button>
                ) : freeBetCode && freeBetStatus === "available" ? (
                  !revealFree ? (
                    <button
                      onClick={() => setRevealFree(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-gray-100 text-white dark:text-black font-extrabold text-[13px] rounded-xl transition-all hover:scale-105 shadow-lg border-none cursor-pointer whitespace-nowrap"
                    >
                      <Lock className="w-4 h-4" /> Booking Code
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCopy(freeBetCode!, "free")}
                      className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-black font-extrabold text-[13px] rounded-xl transition-all hover:scale-105 shadow-lg shadow-green-500/20 border-none cursor-pointer whitespace-nowrap"
                    >
                      {copiedId === "free" ? <Check className="w-4 h-4 text-green-900" /> : <Copy className="w-4 h-4" />} {freeBetCode}
                    </button>
                  )
                ) : (
                  <span className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 text-[12px] font-bold whitespace-nowrap">
                    Coming Soon
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
              <Link
                to="/predictions"
                id="home-view-all"
                className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-[12px] px-8 py-3 rounded-xl no-underline transition-all hover:-translate-y-0.5"
              >
                View All Predictions <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* â”€â”€â”€ FINAL CTA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <section ref={ctaRef} className="py-24 px-6 bg-slate-900 dark:bg-slate-950 text-center transition-colors relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(34,197,94,0.08)_0%,_transparent_70%)] pointer-events-none" />
          <div className="relative z-10 w-[95%] sm:w-[92%] max-w-4xl mx-auto">
            <div className="sr sr-zoom">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 font-bold text-sm mb-8">
                <Crown className="w-4 h-4" /> Limited VIP Slots
              </div>
            </div>
            <h2 className="sr sr-up sr-delay-1 text-[clamp(2rem,5vw,3rem)] font-black text-white mb-5 tracking-tight leading-tight">
              Ready to Start <span className="text-green-400">Winning?</span>
            </h2>
            <p className="sr sr-up sr-delay-2 text-slate-400 text-[13px] leading-relaxed mb-10 font-medium">
              Join A1-TIPSDECK today and get access to our premium analytics data, exclusive booking codes, and expert analysis.
            </p>
            <div className="sr sr-up sr-delay-3 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/vip"
                id="cta-access-vip"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-black font-black text-[13px] px-10 py-4 rounded-xl no-underline shadow-[0_4px_24px_rgba(34,197,94,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(34,197,94,0.4)]"
              >
                <Crown className="w-5 h-5" /> Access VIP Now
              </Link>
              <Link
                to="/register"
                id="cta-register"
                className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-[13px] px-8 py-4 rounded-xl no-underline transition-all"
              >
                Create Free Account <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}








