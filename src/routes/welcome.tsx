import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/lib/auth-context";
import {
  Sparkles,
  Crown,
  TrendingUp,
  LayoutDashboard,
  Gift,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Headphones,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome to A1-TIPSDECK — Get Started" },
      {
        name: "description",
        content: "Welcome to A1-TIPSDECK! Explore free picks, premium VIP packages, and your member dashboard.",
      },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Winner";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors">
      <SiteHeader />

      <main className="flex-1 pt-28 pb-20 px-6 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/10 rounded-full blur-[160px] pointer-events-none" />

        <div className="w-[95%] sm:w-[92%] max-w-5xl mx-auto relative z-10">
          
          {/* Welcome Banner */}
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 font-extrabold text-xs uppercase tracking-widest mb-6 shadow-sm">
              <Sparkles className="w-4 h-4 text-green-500 animate-pulse" />
              Account Created Successfully
            </div>

            <h1 className="text-[clamp(2.2rem,5vw,3.5rem)] font-black text-slate-900 dark:text-white tracking-tight mb-4 leading-tight">
              Welcome aboard, <span className="text-green-600 dark:text-green-500">{userName}</span>! 🎉
            </h1>

            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg font-medium leading-relaxed">
              Your account is set up and ready to go. What would you like to explore first?
            </p>
          </div>

          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            
            {/* Action 1: Free Predictions */}
            <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 border border-slate-200 dark:border-white/10 shadow-xl flex flex-col justify-between group hover:-translate-y-1 transition-all duration-300 hover:border-green-500/40 hover:shadow-green-500/10">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-7 h-7 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                  Today's Free Picks
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                  Check out today's expert free picks updated daily across 40+ top football leagues.
                </p>
              </div>

              <Link
                to="/predictions"
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-green-500 hover:text-black text-slate-900 dark:text-white font-extrabold text-xs uppercase tracking-wider transition-all border border-slate-200 dark:border-white/10 group-hover:border-green-500"
              >
                View Free Picks <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Action 2: VIP Packages (Highlighted) */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 dark:from-slate-900/90 dark:to-slate-950 rounded-2xl p-8 border-2 border-green-500/50 shadow-2xl shadow-green-500/15 flex flex-col justify-between group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-green-500 text-black font-extrabold text-[9px] uppercase tracking-widest">
                Recommended
              </div>

              <div>
                <div className="w-14 h-14 rounded-2xl bg-green-500/20 border border-green-500/40 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Crown className="w-7 h-7 text-green-400" />
                </div>
                <h3 className="text-xl font-black text-white mb-2 tracking-tight">
                  VIP Packages
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                  Unlock high-confidence premium multi-match packages and instant booking codes.
                </p>
              </div>

              <Link
                to="/vip"
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-green-500 hover:bg-green-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-green-500/25"
              >
                Explore VIP Tiers <Zap className="w-4 h-4 fill-black" />
              </Link>
            </div>

            {/* Action 3: Dashboard */}
            <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 border border-slate-200 dark:border-white/10 shadow-xl flex flex-col justify-between group hover:-translate-y-1 transition-all duration-300 hover:border-green-500/40 hover:shadow-green-500/10">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <LayoutDashboard className="w-7 h-7 text-slate-700 dark:text-slate-300" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                  Member Dashboard
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6 font-medium">
                  Access your purchased tickets, view unlocked booking codes, and manage your profile.
                </p>
              </div>

              <Link
                to="/dashboard"
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-900 hover:text-white dark:hover:bg-white dark:hover:text-black text-slate-900 dark:text-white font-extrabold text-xs uppercase tracking-wider transition-all border border-slate-200 dark:border-white/10"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

          </div>

          {/* Member Guarantees / Quick Info */}
          <div className="bg-white/60 dark:bg-slate-900/40 rounded-2xl p-6 border border-slate-200 dark:border-white/5 backdrop-blur-sm grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-green-500 shrink-0" />
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Verified Analytics</h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium m-0">92%+ historical win accuracy rate</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Gift className="w-8 h-8 text-green-500 shrink-0" />
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Free Booking Codes</h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium m-0">Updated daily for all members</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Headphones className="w-8 h-8 text-green-500 shrink-0" />
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Need Help?</h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium m-0">
                  <Link to="/contact" className="text-green-600 dark:text-green-400 underline font-bold">Contact Support</Link> anytime
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
