import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Lock, ShoppingCart, Check, Crown, Gift, ArrowRight, LayoutDashboard, X } from "lucide-react";
import { PAYSTACK_ENABLED, paystackPay } from "@/lib/paystack";

export const Route = createFileRoute("/vip")({
  head: () => ({
    meta: [
      { title: "VIP Packages â€” A1 PREDICTIONS" },
      { name: "description", content: "Premium betting packages with expert selections. Purchase to reveal the booking code." },
    ],
  }),
  component: VipPage,
});

function VipPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [successPkg, setSuccessPkg] = useState<string | null>(null);

  const { data: vipPackages = [], isLoading } = useQuery({
    queryKey: ["vip_packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("secure_vip_packages")
        .select("*")
        .in("availability_status", ["available", "sold_out", "expired"])
        .order("id");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: vipSelections = [] } = useQuery({
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
  });

  // Fallback: fetch all fixtures separately so we can resolve by fixture_id
  // if the PostgREST join doesn't return embedded data
  const { data: allFixtures = [] } = useQuery({
    queryKey: ["fixtures"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fixtures").select("*").limit(10000);
      if (error) throw error;
      return data || [];
    },
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
  });

  // Resolve fixture data: prefer the joined record, fall back to separate query
  const resolveFixture = (sel: any) =>
    sel.fixtures ?? allFixtures.find((f: any) => f.id === sel.fixture_id) ?? null;

  const hasPurchased = (pkgId: string) => userTickets.some((t) => t.package_id === pkgId);

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
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["user_tickets"] });
      setSuccessPkg(vars.packageId);
    },
    onError: (err: any) => toast.error(err.message || "Purchase failed."),
  });

  const handleBuy = (pkgId: string) => {
    if (!user) {
      toast.error("Please log in to secure this package.");
      navigate({ to: "/login" });
      return;
    }
    
    const pkg = vipPackages.find(p => p.id === pkgId);
    if (!pkg) return;

    if (Number(pkg.price) === 0) {
      buyMutation.mutate({ packageId: pkgId });
      return;
    }

    paystackPay(user.email || "", Number(pkg.price), pkgId, (reference) => {
      buyMutation.mutate({ packageId: pkgId, reference });
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors">
      <SiteHeader />

      {/* Hero */}
      <div className="relative text-center px-6 pt-20 pb-16 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4/5 h-[300px] bg-green-500 rounded-full blur-[180px] opacity-10 dark:opacity-15 pointer-events-none" />
        
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-full text-green-600 dark:text-green-500 font-bold text-sm mb-6 border border-green-500/20">
          <Crown className="w-4 h-4" /> Exclusive Access
        </div>
        
        <h1 className="text-[clamp(2.5rem,6vw,4rem)] font-black text-slate-900 dark:text-white mb-4 tracking-tight">
          VIP <span className="text-green-600 dark:text-green-500">Packages</span>
        </h1>
        <p className="mx-auto text-slate-600 dark:text-slate-400 text-base font-medium w-[95%] sm:w-[92%] max-w-4xl leading-relaxed">
          Premium multi-match betting packages with our highest confidence ratings. Purchase to instantly unlock the booking code.
        </p>
      </div>

      <main className="flex-1 w-[95%] sm:w-[92%] max-w-7xl mx-auto px-5 pb-24 relative z-10">
        {isLoading && (
          <div className="text-center py-20 text-slate-500 dark:text-slate-400 text-[13px]">Loading premium packages...</div>
        )}

        {(() => {
          const visiblePackages = vipPackages.filter((pkg) => {
            const pkgSels = vipSelections.filter((s) => s.package_id === pkg.id);
            const purchased = hasPurchased(pkg.id);
            return pkgSels.length > 0 || purchased;
          });

          return (
            <>

        {!isLoading && visiblePackages.length === 0 && (
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-xl p-20 text-center border border-slate-200 dark:border-white/5">
            <Lock className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-5" />
            <p className="font-bold text-slate-800 dark:text-slate-200 text-lg mb-2">No packages available yet</p>
            <p className="text-slate-500 dark:text-slate-400 text-[13px] m-0">Our analysts are preparing today's VIP selections. Check back soon.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {visiblePackages.map((pkg) => {
            const pkgSels = vipSelections.filter((s) => s.package_id === pkg.id);
            const isAvailable = pkg.availability_status === "available";
            const isExpired = pkg.availability_status === "expired";
            const purchased = hasPurchased(pkg.id);
            const isFree = Number(pkg.price || 0) === 0;
            const dynamicOdds = pkgSels.length > 0
              ? pkgSels.reduce((acc, sel) => acc * (Number(sel.odds) || 1), 1)
              : null;
            // Dim the card when expired
            const cardOpacity = isExpired ? 0.6 : 1;

            return (
              <div key={pkg.id} style={{ opacity: cardOpacity }} className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-xl overflow-hidden border border-slate-200 dark:border-white/5 shadow-xl dark:shadow-2xl dark:shadow-black/50 flex flex-col relative transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-green-500/10 dark:hover:shadow-green-500/10">
                {/* Accent glow on top edge */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${
                  isAvailable
                    ? 'bg-gradient-to-r from-transparent via-green-500 to-transparent'
                    : isExpired
                    ? 'bg-gradient-to-r from-transparent via-green-400 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-slate-400 to-transparent'
                }`} />

                <div className="p-8 flex-1 flex flex-col">
                  
                  {/* Title + status */}
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-black m-0 text-slate-900 dark:text-white tracking-tight">{pkg.name}</h2>
                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest border ${
                      isAvailable
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                        : isExpired
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                    }`}>
                      {isAvailable ? "Available" : isExpired ? "Expired" : "Sold Out"}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="mb-6 flex items-baseline gap-2">
                    {isFree ? (
                      <span className="text-[40px] font-black text-green-600 dark:text-green-400 leading-none">FREE</span>
                    ) : (
                      <>
                        <span className="text-xl font-bold text-slate-500 dark:text-slate-400">GHS</span>
                        <span className="text-[40px] font-black text-slate-900 dark:text-white leading-none">{Number(pkg.price).toFixed(2)}</span>
                      </>
                    )}
                  </div>

                  {/* Combined odds */}
                  {dynamicOdds && (
                    <div className="mb-6 inline-flex items-center gap-3 px-4 py-3 bg-slate-100 dark:bg-black/30 rounded-xl border border-slate-200 dark:border-white/5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide">Combined Odds</span>
                      <span className="text-lg font-black text-green-600 dark:text-green-400">{Number(dynamicOdds).toFixed(2)}</span>
                    </div>
                  )}

                  {/* Match list â€” show all matches, blur tips for non-buyers */}
                  <div className="mb-8 flex-1">
                    <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                      Included Matches ({pkgSels.length})
                    </h3>
                    {pkgSels.length > 0 ? (
                      <ul className="m-0 p-0 list-none flex flex-col gap-3">
                        {pkgSels.map((sel: any) => {
                          const fix = resolveFixture(sel);
                          return (
                            <li key={sel.id} className="flex items-start gap-3 text-[12px] text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 mt-[7px] shadow-[0_0_10px_#4ade80]" />
                              <div className="flex-1">
                                <span>{fix ? `${fix.home_team} vs ${fix.away_team}` : "Match TBC"}</span>
                                {fix && (
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex gap-2">
                                    <span>{fix.match_time}</span>
                                    {fix.competition && <span>Â· {fix.competition}</span>}
                                  </div>
                                )}
                                {/* Blur prediction for non-buyers */}
                                <div className={`text-[9px] font-semibold mt-0.5 select-none ${
                                  purchased
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-transparent blur-[4px] bg-green-500/10 rounded px-1 pointer-events-none"
                                }`}>
                                  {sel.prediction}{sel.odds ? ` @ ${Number(sel.odds).toFixed(2)}` : ""}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-[12px] text-slate-500 dark:text-slate-400 italic m-0">
                        {purchased ? "Matches will be added shortly." : "Matches loading..."}
                      </p>
                    )}
                  </div>

                  {/* Booking code teaser */}
                  {!purchased && (
                    <div className="p-4 bg-slate-100 dark:bg-black/20 rounded-xl border border-dashed border-slate-300 dark:border-white/10 mb-6 flex items-center gap-3">
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium m-0">Booking code & full predictions unlocked after purchase</p>
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  {purchased ? (
                    <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30 text-center text-green-700 dark:text-green-400 font-extrabold text-[12px] flex items-center justify-center gap-2">
                      <Check className="w-[18px] h-[18px]" />
                      Secured â€” Check Dashboard
                    </div>
                  ) : isExpired ? (
                    <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20 text-center text-green-700 dark:text-green-400 font-extrabold text-[12px] flex items-center justify-center gap-2">
                      This package has expired â€” check back for new packages
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        disabled={!isAvailable || buyMutation.isPending || (!isFree && !PAYSTACK_ENABLED)}
                        onClick={() => handleBuy(pkg.id)}
                        className={`w-full p-4 rounded-xl border-none font-extrabold text-[13px] flex items-center justify-center gap-2 transition-all shadow-lg ${
                          buyMutation.isPending || !isAvailable || (!isFree && !PAYSTACK_ENABLED)
                            ? "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none opacity-50"
                            : isFree
                              ? "bg-green-600 text-white cursor-pointer hover:scale-[1.02] hover:shadow-green-500/30"
                              : "bg-green-500 text-black cursor-pointer hover:scale-[1.02] hover:shadow-green-500/30"
                        }`}
                      >
                        {buyMutation.isPending ? (
                          "Processing..."
                        ) : !isAvailable ? (
                          "Sold Out"
                        ) : (!isFree && !PAYSTACK_ENABLED) ? (
                          <>
                            <Lock className="w-[16px] h-[16px]" />
                            Payment Coming Soon
                          </>
                        ) : isFree ? (
                          <>
                            <Gift className="w-[18px] h-[18px]" />
                            Claim For Free
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-[18px] h-[18px]" />
                            Buy Ticket Now <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
            </>
          );
        })()}
      </main>

      <SiteFooter />

      {/* â”€â”€ Success Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {successPkg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
          onClick={() => setSuccessPkg(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-xl p-8 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col items-center text-center gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated checkmark */}
            <div className="w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-500" strokeWidth={3} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Payment Successful! ðŸŽ‰</h2>
              <p className="text-slate-500 dark:text-slate-400 text-[13px] leading-relaxed m-0">
                Your VIP package has been secured. Head to your <strong className="text-slate-700 dark:text-slate-300">Dashboard</strong> to view your booking code and full predictions.
              </p>
            </div>

            <button
              onClick={() => { setSuccessPkg(null); navigate({ to: "/dashboard" }); }}
              className="w-full flex items-center justify-center gap-2 p-4 bg-green-500 hover:bg-green-600 text-black font-extrabold text-[13px] rounded-xl transition-all hover:scale-[1.02] shadow-lg shadow-green-500/30 border-none cursor-pointer"
            >
              <LayoutDashboard className="w-5 h-5" /> Go to Dashboard
            </button>

            <button
              onClick={() => setSuccessPkg(null)}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-[12px] font-medium flex items-center gap-1 bg-transparent border-none cursor-pointer transition-colors"
            >
              <X className="w-3 h-3" /> Stay on this page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



