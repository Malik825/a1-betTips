import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Globe, ShieldCheck, Clock, Trophy, TrendingUp, Heart, ArrowRight } from "lucide-react";
import { useContactLinks } from "@/lib/contact-links";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About A1 PREDICTIONS — Our Betting Analysts & Method" },
      {
        name: "description",
        content:
          "Meet the A1 PREDICTIONS team: data-led football analysts publishing transparent, verified betting predictions since 2018.",
      },
      { property: "og:title", content: "About A1 PREDICTIONS — Our Betting Analysts & Method" },
      {
        property: "og:description",
        content: "Data-led football analysts publishing transparent, verified betting predictions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

const missionFeatures = [
  {
    icon: Globe,
    title: "Global Markets",
    body: "Covering major leagues worldwide with expert analysis of all major sports.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted Tips",
    body: "Our tips are backed by years of betting experience and proven winning strategies.",
  },
  {
    icon: Clock,
    title: "24/7 Tips",
    body: "Daily tips and predictions available around the clock for all major matches.",
  },
];

const whyUs = [
  {
    icon: Trophy,
    title: "Proven Results",
    body: "85% win rate with consistent performance across all sports",
    accent: "#22c55e",
  },
  {
    icon: TrendingUp,
    title: "Expert Analysis",
    body: "Deep sports knowledge and market analysis for profitable betting opportunities",
    accent: "#3b82f6",
  },
  {
    icon: ShieldCheck,
    title: "Transparent",
    body: "Complete transparency with detailed betting analysis and winning strategies",
    accent: "#f59e0b",
  },
  {
    icon: Heart,
    title: "Profit-Focused",
    body: "Your betting profits are our success. We're committed to your winning journey",
    accent: "#ec4899",
  },
];

const stats = [
  { value: "85%", label: "Win Rate" },
  { value: "10K+", label: "Happy Users" },
  { value: "5.0★", label: "User Rating" },
  { value: "24/7", label: "Support" },
];

function AboutPage() {
  const links = useContactLinks();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans transition-colors flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="bg-slate-900 dark:bg-black py-24 px-6 text-center border-b border-white/10 transition-colors">
          <h1 className="text-[clamp(2.5rem,5vw,3.5rem)] font-black text-white mb-6 tracking-tight">
            About <span className="text-green-500">A1 PREDICTIONS</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl font-medium max-w-[600px] mx-auto leading-relaxed">
            Your trusted partner in sports betting success. We combine years of betting expertise,
            market analysis, and insider knowledge to deliver winning tips.
          </p>
        </section>

        {/* ── Our Story ─────────────────────────────────────────────────── */}
        <section className="py-20 px-6 bg-slate-50 dark:bg-slate-950 transition-colors border-b border-slate-200 dark:border-white/10">
          <div className="w-[95%] sm:w-[92%] max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">
                Our Story
              </h2>
              <div className="space-y-4 text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                <p>
                  <strong className="text-green-500">A1 PREDICTIONS</strong> was founded by a
                  team of professional bettors who spent years studying sports markets, analyzing team
                  performance, and understanding the nuances of betting. We know what it takes to win
                  consistently in sports betting.
                </p>
                <p>
                  Our team includes former professional sports analysts, experienced tipsters, and
                  successful bettors who have made millions from betting. We share our knowledge and
                  winning strategies with our community.
                </p>
              </div>
            </div>
            
            {/* Callout box */}
            <div className="bg-white dark:bg-slate-900 p-10 rounded-3xl border border-slate-200 dark:border-white/10 text-center shadow-xl shadow-slate-200/50 dark:shadow-none relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <Trophy className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4">
                Proven Track Record
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Our consistent winning performance speaks for itself. Join thousands of successful
                bettors who trust A1 PREDICTIONS for profitable betting.
              </p>
            </div>
          </div>
        </section>

        {/* ── Our Mission ───────────────────────────────────────────────── */}
        <section className="py-24 px-6 bg-green-500 text-center relative overflow-hidden">
          <div className="w-[95%] sm:w-[92%] max-w-7xl mx-auto relative z-10">
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-black text-black mb-6 tracking-tight">
              Our Mission
            </h2>
            <p className="text-green-950 text-lg md:text-xl font-bold max-w-[700px] mx-auto leading-relaxed mb-16">
              To provide every sports bettor with winning tips, insider knowledge, and proven betting
              strategies that generate consistent profits.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {missionFeatures.map((f) => (
                <div key={f.title} className="bg-black/10 backdrop-blur-md rounded-2xl p-8 border border-black/5 hover:bg-black/15 transition-colors">
                  <f.icon className="w-10 h-10 text-black mb-5 mx-auto" />
                  <h3 className="text-xl font-black text-black mb-3">{f.title}</h3>
                  <p className="text-green-950 font-semibold">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why Choose Us ─────────────────────────────────────────────── */}
        <section className="py-24 px-6 bg-white dark:bg-black transition-colors border-b border-slate-200 dark:border-white/10">
          <div className="w-[95%] sm:w-[92%] max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                Why Choose <span className="text-green-500">Us?</span>
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium max-w-[500px] mx-auto">
                We're committed to helping our community beat the bookies through data-driven analysis.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-8">
              {whyUs.map((f) => (
                <div key={f.title} className="group flex gap-6 p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/10 hover:border-green-500/30 transition-all duration-300 hover:-translate-y-1">
                  <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: `${f.accent}15`, color: f.accent }}>
                    <f.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{f.title}</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed m-0">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <section className="py-20 px-6 bg-slate-900 dark:bg-slate-950 transition-colors text-center border-b border-white/10">
          <div className="w-[95%] sm:w-[92%] max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">{s.value}</p>
                <p className="text-green-500 font-bold uppercase tracking-wider text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────── */}
        <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900 transition-colors text-center">
          <h2 className="text-[clamp(1.8rem,4vw,2.5rem)] font-black text-slate-900 dark:text-white mb-6 tracking-tight">
            Ready to Start Winning?
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium max-w-[500px] mx-auto mb-10">
            Join our community of successful bettors and start making consistent profits with A1 PREDICTIONS.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/vip"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-black font-black text-[13px] px-8 py-3.5 rounded-xl no-underline shadow-lg shadow-green-500/20 transition-all hover:-translate-y-0.5"
            >
              Get VIP Access <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href={links.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-black font-bold text-[13px] px-8 py-3.5 rounded-xl no-underline transition-all hover:-translate-y-0.5"
            >
              Join Telegram
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
