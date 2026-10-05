import { useEffect } from "react";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Check, X, Ticket, ExternalLink, Clock } from "lucide-react";
import { isTicketValidForPackage } from "@/lib/ticket-utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard — A1-TIPSDECK" },
      { name: "description", content: "View your purchased VIP packages and booking codes." },
    ],
  }),
  component: DashboardPage,
});

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { bg: string; color: string; label: string; border: string }> = {
    pending:   { bg: "bg-green-100 dark:bg-green-500/10", color: "text-green-700 dark:text-green-500", border: "border-green-200 dark:border-green-500/20", label: "Pending" },
    won:       { bg: "bg-green-100 dark:bg-green-500/10", color: "text-green-800 dark:text-green-500", border: "border-green-200 dark:border-green-500/20", label: "Won" },
    lost:      { bg: "bg-red-100 dark:bg-red-500/10", color: "text-red-800 dark:text-red-500", border: "border-red-200 dark:border-red-500/20", label: "Lost" },
    completed: { bg: "bg-slate-100 dark:bg-slate-700/30", color: "text-slate-500 dark:text-slate-400", border: "border-slate-200 dark:border-slate-600/30", label: "Completed" },
    expired:   { bg: "bg-amber-100 dark:bg-amber-500/10", color: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/20", label: "Expired" },
  };
  const s = map[result] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.bg} ${s.color} ${s.border}`}>
      {result === "won" && <Check className="w-3 h-3" strokeWidth={3} />}
      {result === "lost" && <X className="w-3 h-3" strokeWidth={3} />}
      {result === "pending" && <Clock className="w-3 h-3" />}
      {s.label}
    </span>
  );
}

import { useNavigate } from "@tanstack/react-router";

function DashboardPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: "/login", replace: true });
    }
  }, [user, isLoading, navigate]);

  const { data: userTickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["user_tickets", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: userPendingPayments = [] } = useQuery({
    queryKey: ["user_manual_payments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("manual_payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
  });

  const activePendingPayments = userPendingPayments.filter((p: any) => p.status === "pending");

  const { data: vipPackages = [] } = useQuery({
    queryKey: ["vip_packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("secure_vip_packages").select("id, name, price, availability_status, result_status, booking_code, combined_odds, expires_at, updated_at");
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

  const { data: fixtures = [] } = useQuery({
    queryKey: ["fixtures"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fixtures").select("*").limit(10000);
      if (error) throw error;
      return data || [];
    },
  });

  // Prefer joined fixture data, fall back to separate fixtures query
  const resolveFixture = (sel: any) =>
    sel.fixtures ?? fixtures.find((f: any) => f.id === sel.fixture_id) ?? null;

  const overallResult = (pkgId: string): string => {
    const sels = vipSelections.filter((s) => s.package_id === pkgId);
    if (!sels.length) return "pending";
    if (sels.some((s) => s.result_status === "lost")) return "lost";
    if (sels.every((s) => s.result_status === "won")) return "won";
    return "pending";
  };

  const displayName = user?.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors">
      <SiteHeader />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 dark:bg-black py-12 px-6 border-b border-transparent dark:border-white/10">
        <div className="w-[95%] sm:w-[92%] max-w-7xl mx-auto">
          <h1 className="text-[1.8rem] text-white font-extrabold mb-1.5">
            Welcome back, <span className="text-green-500">{displayName}!</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium m-0">
            Your purchased VIP packages and booking codes are here.
          </p>
        </div>
      </div>

      <main className="flex-1 w-[95%] sm:w-[92%] max-w-7xl mx-auto py-8 px-5 pb-20">

        {/* ── Pending Manual Payments Banner ──────────────────────────── */}
        {activePendingPayments.length > 0 && (
          <div className="mb-8 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5 mb-2">
              <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white m-0">
                Payment Verification in Progress ({activePendingPayments.length})
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              We received your Mobile Money transfer details. Once confirmed by our admin team (usually within 5-15 minutes), your package access and booking codes will unlock automatically.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activePendingPayments.map((p: any) => {
                const pkg = vipPackages.find((pkgItem: any) => pkgItem.id === p.package_id);
                return (
                  <div key={p.id} className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/20 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">
                        {pkg?.name || p.package_id}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Ref: <strong className="font-mono text-green-600 dark:text-green-400">{p.reference_code}</strong> • GHS {Number(p.amount).toFixed(2)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Pending
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Section title ───────────────────────────────────────────── */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white m-0 flex items-center gap-2.5">
            <Ticket className="w-5 h-5 text-green-500" />
            My Tickets
          </h2>
          <Link to="/predictions" className="text-[11px] font-bold text-green-600 dark:text-green-500 flex items-center gap-1 hover:underline">
            Browse packages <ExternalLink className="w-[13px] h-[13px]" />
          </Link>
        </div>

        {/* ── Empty state ─────────────────────────────────────────────── */}
        {ticketsLoading ? (
          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-14 text-center border border-slate-200 dark:border-white/10 shadow-sm">
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium m-0">Loading your tickets...</p>
          </div>
        ) : userTickets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-14 text-center border border-slate-200 dark:border-white/10 shadow-sm">
            <Ticket className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="font-bold text-slate-700 dark:text-slate-200 text-[13px] mb-1.5">No tickets yet</p>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-5">
              Purchase a VIP package and your booking code will appear here.
            </p>
            <Link to="/predictions" className="inline-block py-2.5 px-7 bg-slate-900 dark:bg-green-500 text-white dark:text-black rounded-lg font-bold text-sm transition-colors hover:bg-slate-800 dark:hover:bg-green-600">
              View Packages
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {userTickets.map((ticket) => {
              const pkg = vipPackages.find((p) => p.id === ticket.package_id);
              if (!pkg) return null;
              const isValidTicket = isTicketValidForPackage(ticket, pkg);
              // Get selections: if valid batch with selections, use live selections; else use ticket snapshot
              const rawSels = (isValidTicket && vipSelections.filter((s) => s.package_id === pkg.id).length > 0)
                ? vipSelections.filter((s) => s.package_id === pkg.id)
                : (ticket.snapshot || []);

              // Resolve latest live result status for each selection
              const sels = rawSels.map((sel: any) => {
                const live = vipSelections.find((s) => s.id === sel.id || (s.fixture_id && s.fixture_id === sel.fixture_id));
                const status = live?.result_status || sel.result_status || "pending";
                return {
                  ...sel,
                  result_status: status,
                };
              });

              // Compute the true ticket result
              let result = "pending";
              if (sels.length > 0) {
                if (sels.some((s: any) => s.result_status === "lost")) {
                  result = "lost";
                } else if (sels.every((s: any) => s.result_status === "won")) {
                  result = "won";
                } else {
                  result = "pending";
                }
              } else if (!isValidTicket) {
                result = "completed";
              }

              // The booking code the user actually bought (snapshot), falls back to current pkg code if still valid
              const displayBookingCode = ticket.booking_code || (isValidTicket ? pkg.booking_code : null);

              return (
                <div key={ticket.id} className="bg-white dark:bg-slate-900/60 backdrop-blur-xl rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shadow-lg dark:shadow-2xl dark:shadow-black/50 transition-colors">
                  {/* Card top bar */}
                  <div className={`h-1 ${result === "won" ? "bg-green-500" : result === "lost" ? "bg-red-500" : "bg-green-500"}`} />

                  {/* Header */}
                  <div className="px-7 py-5 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/20 flex justify-between items-center flex-wrap gap-3">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1">{pkg.name}</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium m-0">
                        Purchased: {new Date(ticket.purchased_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <ResultBadge result={result} />
                  </div>

                  <div className="p-7">

                    {/* Booking code */}
                    <div className="mb-7">
                      <div className="p-5 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-500/20">
                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Booking Code</p>
                        {displayBookingCode ? (
                          <p className="text-2xl font-black text-green-800 dark:text-green-400 m-0 font-mono tracking-widest">{displayBookingCode}</p>
                        ) : (
                          <p className="text-[13px] text-slate-400 dark:text-slate-500 m-0">{isValidTicket ? "Not set yet" : "This package has been updated — your booking code was for the previous batch."}</p>
                        )}
                      </div>
                    </div>

                    {/* Selections table */}
                    <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3.5">
                      Selections ({sels.length})
                    </h4>

                    <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-transparent">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-black/40 text-left border-b border-slate-200 dark:border-white/10">
                              <th className="p-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400">Match</th>
                              <th className="p-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400">Prediction</th>
                              <th className="p-3 text-[10px] font-semibold text-slate-500 dark:text-slate-400 text-right">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sels.map((sel: any, i: number) => {
                              const fix = resolveFixture(sel);
                              const matchLabel = sel.match || (fix ? `${fix.home_team} vs ${fix.away_team}` : "—");
                              const compLabel = sel.competition || fix?.competition || "";
                              const timeLabel = sel.match_time || fix?.match_time || "";
                              return (
                                <tr key={sel.id} className={`${i < sels.length - 1 ? 'border-b border-slate-100 dark:border-white/5' : ''}`}>
                                  <td className="p-3.5 text-[12px] font-semibold text-slate-900 dark:text-slate-200">
                                    {matchLabel}
                                    {(compLabel || timeLabel) && <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">{compLabel}{compLabel && timeLabel ? " • " : ""}{timeLabel}</div>}
                                  </td>
                                  <td className="p-3.5 text-[12px] font-bold text-green-600 dark:text-green-500">
                                    {sel.prediction}
                                  </td>
                                  <td className="p-3.5 text-right">
                                    <ResultBadge result={sel.result_status || "completed"} />
                                  </td>
                                </tr>
                              );
                            })}
                            {sels.length === 0 && (
                              <tr>
                                <td colSpan={4} className="p-5 text-center text-slate-400 dark:text-slate-500 text-[12px]">
                                  Selections will appear here once added.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}


