import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Crown, Lock, Copy, Check, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { hasUserPurchasedPackage } from "@/lib/ticket-utils";

interface BookingCodesSectionProps {
  /** If false, hides the entire section when no packages are available */
  hideWhenEmpty?: boolean;
  /** Optional daily free booking code to show alongside VIP */
  freeBetCode?: string | null;
  /** Whether the free code is currently available */
  freeBetStatus?: string;
}

export function BookingCodesSection({ hideWhenEmpty = false, freeBetCode, freeBetStatus }: BookingCodesSectionProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealFree, setRevealFree] = useState(false);

  const { data: vipPackages = [], isLoading } = useQuery({
    queryKey: ["vip_packages_booking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("secure_vip_packages")
        .select("*")
        .in("availability_status", ["available", "sold_out"])
        .neq("id", "recovery")
        .order("id");
      if (error) throw error;
      return (data || []).filter((p: any) => p.id !== "recovery");
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: vipSelections = [] } = useQuery({
    queryKey: ["vip_package_fixtures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_package_fixtures")
        .select("id, package_id, fixture_id, prediction, odds");
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

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

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      toast.success("Booking code copied!");
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const hasPurchased = (pkgId: string) => {
    const pkg = vipPackages.find((p: any) => p.id === pkgId);
    return pkg ? hasUserPurchasedPackage(userTickets, pkg) : false;
  };

  // Only show packages that have at least one game OR that the user has purchased
  const visiblePkgs = vipPackages
    .filter((pkg: any) => pkg.id !== "recovery")
    .filter((pkg: any) => {
      const hasGames = vipSelections.some((s: any) => s.package_id === pkg.id);
      return hasGames || hasPurchased(pkg.id);
    });

  const availablePkgs = visiblePkgs.filter((p: any) => p.availability_status === "available");

  const hasFreeCode = freeBetCode && freeBetStatus === "available";

  // Hide the section entirely when empty (for home page)
  if (hideWhenEmpty && !isLoading && availablePkgs.length === 0 && !hasFreeCode) {
    return null;
  }

  return (
    <section className="py-20 px-6 bg-white dark:bg-black transition-colors">
      <div className="w-[95%] sm:w-[92%] max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8 md:mb-12 px-2 sm:px-4">
          <div className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-600 dark:text-green-400 font-bold text-xs md:text-sm mb-4 md:mb-6">
            <Crown className="w-3.5 h-3.5 md:w-4 md:h-4" /> Today's Booking Codes
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.6rem] font-black text-slate-900 dark:text-white mb-3 md:mb-4 tracking-tight leading-tight">
            Your <span className="text-green-500">Booking Codes</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-[13px] max-w-[520px] mx-auto font-medium leading-relaxed px-2">
            Purchase a VIP package to instantly unlock the booking code.
            Free codes available for logged-in users.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden animate-pulse">
                <div className="h-0.5 bg-green-500/30" />
                <div className="p-6 flex flex-col gap-4">
                  <div className="flex justify-between">
                    <div className="h-5 bg-white/10 rounded w-24" />
                    <div className="h-5 bg-white/10 rounded w-16" />
                  </div>
                  <div className="h-12 bg-white/10 rounded-xl" />
                  <div className="h-10 bg-white/10 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : availablePkgs.length === 0 && !hasFreeCode ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-300 font-bold text-[15px] mb-2">No Packages Available Today</p>
            <p className="text-slate-500 text-[12px] m-0">Check back soon — new packages drop daily.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Free code card */}
            {hasFreeCode && (
              <div className="relative rounded-2xl border border-green-400/30 bg-white/5 backdrop-blur overflow-hidden group transition-all hover:border-blue-400/50 hover:bg-white/[0.07]">
                <div className="h-0.5 w-full bg-gradient-to-r from-green-400 to-cyan-400" />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-black text-white text-lg">Free Tips Code</h3>
                    <span className="text-[9px] font-extrabold px-2.5 py-1 rounded-full bg-green-400/20 text-green-400 uppercase tracking-widest">Free</span>
                  </div>

                  <div className="mt-2 relative">
                    <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest mb-2">Today's Booking Code</p>
                    <div
                      onClick={() => revealFree && handleCopy(freeBetCode!, "free")}
                      className={`flex items-center justify-between gap-3 p-3 rounded-xl bg-green-400/10 border border-green-400/30 transition-colors mb-2 ${revealFree ? 'cursor-pointer hover:bg-green-500/20' : ''}`}
                    >
                      <span className={`font-mono font-black text-sm tracking-[0.2em] transition-all duration-300 ${revealFree ? 'text-green-400' : 'text-transparent blur-md bg-green-400/20 rounded px-2'}`}>
                        {freeBetCode}
                      </span>
                      <span className="text-green-400 shrink-0">
                        {revealFree ? (
                          copiedId === "free" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                      </span>
                    </div>

                    {!revealFree && (
                      <div className="absolute inset-0 top-6 flex items-center justify-center">
                        {user ? (
                          <button
                            onClick={() => setRevealFree(true)}
                            className="bg-green-600 hover:bg-blue-400 text-white font-bold text-xs py-2 px-6 rounded-full transition-all cursor-pointer border-none shadow-lg shadow-green-400/25 hover:scale-105"
                          >
                            Reveal Code
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate({ to: "/login" })}
                            className="bg-green-500 hover:bg-green-600 text-black font-bold text-xs py-2 px-6 rounded-full transition-all cursor-pointer border-none shadow-lg hover:scale-105"
                          >
                            Log In to Access
                          </button>
                        )}
                      </div>
                    )}
                    
                    <p className="text-[9px] text-slate-600 text-center">Tap to copy · Use on your platform</p>
                  </div>
                </div>
              </div>
            )}

            {/* VIP package cards */}
            {availablePkgs.map((pkg: any) => {
              const isFree = Number(pkg.price || 0) === 0;
              const purchased = hasPurchased(pkg.id);
              const code = purchased || isFree ? pkg.booking_code : null;
              const isLocked = !code;
              const pkgSels = vipSelections.filter((s: any) => s.package_id === pkg.id);

              return (
                <div key={pkg.id} className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden group transition-all hover:border-green-500/30 hover:bg-white/[0.07]">
                  {/* Top accent */}
                  <div className="h-0.5 w-full bg-gradient-to-r from-green-500 to-emerald-400" />

                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-black text-white text-lg">{pkg.name}</h3>
                      <span className="text-[9px] font-extrabold px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 uppercase tracking-widest">
                        GHS {Number(pkg.price).toFixed(2)}
                      </span>
                    </div>

                    {/* Match count teaser */}
                    {pkgSels.length > 0 && (
                      <p className="text-[10px] text-slate-500 font-semibold mb-4">{pkgSels.length} match{pkgSels.length !== 1 ? "es" : ""} included</p>
                    )}

                    {isLocked ? (
                      <div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mb-4">
                          <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                          <span className="text-slate-500 font-mono text-sm tracking-[0.2em]">••••••••••</span>
                        </div>
                        {!user ? (
                          <button
                            onClick={() => navigate({ to: "/login" })}
                            className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-black font-bold text-sm transition-all cursor-pointer border-none hover:scale-[1.02]"
                          >
                            Login to Access
                          </button>
                        ) : (
                          <Link
                            to="/vip"
                            className="block w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-black font-bold text-sm text-center no-underline transition-all hover:scale-[1.02]"
                          >
                            Purchase — GHS {Number(pkg.price).toFixed(2)}
                          </Link>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest mb-2">Booking Code</p>
                        <div
                          onClick={() => handleCopy(code, pkg.id)}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/30 cursor-pointer hover:bg-green-500/20 transition-colors mb-2"
                        >
                          <span className="text-green-400 font-mono font-black text-sm tracking-[0.2em]">{code}</span>
                          <span className="text-green-400 shrink-0">
                            {copiedId === pkg.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-600 text-center">Tap to copy · Use on your platform</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!user && (
          <div className="mt-8 text-center">
            <Link to="/login" className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 font-bold text-sm no-underline transition-colors">
              Sign in to access free codes <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
