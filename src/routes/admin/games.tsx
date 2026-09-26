import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState, useEffect, Fragment } from "react";
import { Edit2, Upload, Plus, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/admin/games")({ component: AdminGamesPage });

type PackageTab = "free" | "vip_1" | "vip_2" | "vip_3";
type ResultStatus = "pending" | "won" | "lost";
type AvailabilityStatus = "draft" | "available" | "sold_out";

const RESULT_COLORS: Record<ResultStatus, { bg: string; color: string }> = {
  pending: { bg: "rgba(34, 197, 94, 0.15)", color: "#16a34a" },
  won: { bg: "rgba(16, 185, 129, 0.15)", color: "#059669" },
  lost: { bg: "rgba(239, 68, 68, 0.15)", color: "#dc2626" },
};

const AVAIL_COLORS: Record<AvailabilityStatus, { bg: string; color: string }> = {
  draft: { bg: "var(--secondary)", color: "var(--muted-foreground)" },
  available: { bg: "rgba(16, 185, 129, 0.15)", color: "#059669" },
  sold_out: { bg: "rgba(239, 68, 68, 0.15)", color: "#dc2626" },
};

function Badge({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 20,
      fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px",
      ...style
    }}>{label}</span>
  );
}

function AdminGamesPage() {
  const [activeTab, setActiveTab] = useState<PackageTab>("free");
  const [editingPkg, setEditingPkg] = useState<string | null>(null);
  const [pkgEdits, setPkgEdits] = useState<Record<string, any>>({});
  const [sportybetCode, setSportybetCode] = useState("");
  const [freeDailyCode, setFreeDailyCode] = useState("");
  const [freeDailyStatus, setFreeDailyStatus] = useState<"draft" | "available" | "sold_out">("draft");
  const [dailySettingsSaving, setDailySettingsSaving] = useState(false);
  const [actionDrawerId, setActionDrawerId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Queries Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const { data: fixtures = [] } = useQuery({
    queryKey: ["fixtures"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fixtures").select("*").order("match_time").limit(10000);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: vipPackages = [] } = useQuery({
    queryKey: ["vip_packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vip_packages").select("*").order("id");
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
          *,
          fixture:fixtures (id, home_team, away_team, competition, match_time, match_date_iso)
        `);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: freePredictions = [] } = useQuery({
    queryKey: ["predictions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("predictions").select(`
        *,
        fixture:fixtures (id, home_team, away_team, competition, match_time, match_date_iso, sport)
      `);
      if (error) throw error;
      return data || [];
    },
  });

  const today = new Date().toISOString().split("T")[0];

  // Load today's daily settings
  const { data: dailySettings, refetch: refetchDailySettings } = useQuery({
    queryKey: ["daily_settings", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_settings")
        .select("*")
        .eq("date", today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Sync DB data into local state when query loads (replaces deprecated onSuccess)
  // This runs whenever dailySettings changes â€” including on page load/refresh
  useEffect(() => {
    if (dailySettings) {
      setFreeDailyStatus((dailySettings as any).status || "draft");
      setFreeDailyCode((dailySettings as any).free_booking_code || "");
    }
  }, [dailySettings]);

  // Save daily settings
  const saveDailySettings = async () => {
    setDailySettingsSaving(true);
    const { error } = await supabase.from("daily_settings").upsert({
      date: today,
      status: freeDailyStatus,
      free_booking_code: freeDailyCode.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "date" });
    setDailySettingsSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      refetchDailySettings();
      toast.success("Daily settings saved!");
    }
  };

  const getPackageSelections = (pkgId: string) =>
    vipSelections.filter((s) => s.package_id === pkgId);

  const getFixtureById = (id: string) => fixtures.find((f: any) => f.id === id);

  // Remove fixture from VIP package
  const removeSelectionMutation = useMutation({
    mutationFn: async ({ id, packageId, remainingCount }: { id: string; packageId: string; remainingCount: number }) => {
      const { error } = await supabase.from("vip_package_fixtures").delete().eq("id", id);
      if (error) throw error;
      
      if (packageId && remainingCount === 0) {
        await supabase.from("vip_packages").update({ availability_status: "draft" }).eq("id", packageId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip_package_fixtures"] });
      queryClient.invalidateQueries({ queryKey: ["vip_packages"] });
      toast.success("Removed from package.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Update per-selection result
  const updateSelectionResult = useMutation({
    mutationFn: async ({ id, result_status }: { id: string; result_status: ResultStatus }) => {
      const { error } = await supabase
        .from("vip_package_fixtures")
        .update({ result_status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip_package_fixtures"] });
      toast.success("Result updated.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Update VIP package settings (booking code, combined odds, price, status, publish)
  const updatePackageMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("vip_packages").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip_packages"] });
      toast.success("Package updated!");
      setEditingPkg(null);
    },
    onError: (err: any) => toast.error(err.message),
  });



  // Update free prediction result
  const updateFreePredResult = useMutation({
    mutationFn: async ({ id, result }: { id: string; result: ResultStatus }) => {
      const { error } = await supabase.from("predictions").update({ result }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
      toast.success("Result updated.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Delete free prediction
  const deleteFreePred = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("predictions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
      toast.success("Removed.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Import from Sportybet
  const importSportybetMutation = useMutation({
    mutationFn: async ({ code, packageId }: { code: string; packageId: string }) => {
      // Strip all whitespace & invisible chars that may come from copy-paste
      const cleanCode = code.replace(/\s/g, "").toUpperCase();
      if (!cleanCode) throw new Error("Enter a booking code.");

      // Call the Supabase Edge Function (runs server-side with the stored cookie)
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "sportybet-proxy",
        { body: { shareCode: cleanCode } }
      );

      if (fnError) throw new Error(fnError.message || "Edge function error.");

      // fnData is the raw Sportybet JSON
      const json = fnData;
      if (!json || json.error) throw new Error(json?.error || "Unknown error from proxy.");
      if (json.bizCode !== 10000) throw new Error(`Invalid or expired code "${cleanCode}". ${json.message || json.innerMsg || ""}`);

      // Handle both known Sportybet response shapes:
      // json.data.betList[].events[] OR json.data.outcomes[]
      const betList = json.data?.betList || [];
      const matches: any[] = betList.length > 0
        ? betList.flatMap((bet: any) => bet.events || bet.outcomes || [])
        : (json.data?.outcomes || json.data?.events || []);

      if (matches.length === 0) throw new Error("No matches found in booking code.");

      let totalAdded = 0;
      const allOdds: number[] = [];

      for (const match of matches) {
        const homeTeam =
          match.homeTeamName || match.home?.name || match.homeTeam || match.home || "Home";
        const awayTeam = match.awayTeamName || "Away";
        let odds = match.odds;
        let prediction = `${match.marketName || ""} ${match.outcomeName || match.desc || ""}`.trim();

        if (!odds && match.markets && match.markets.length > 0) {
          const firstMarket = match.markets[0];
          const firstOutcome = firstMarket.outcomes && firstMarket.outcomes[0];
          if (firstOutcome) {
            odds = firstOutcome.odds;
            prediction = `${firstMarket.desc || ""} ${firstOutcome.desc || ""}`.trim();
          }
        }

        const parsedOdds = parseFloat(odds);
        if (!isNaN(parsedOdds) && parsedOdds > 0) allOdds.push(parsedOdds);

        const externalId = match.eventId || Math.random().toString().substring(2, 10);

        // Parse time
        let matchDateStr = new Date().toISOString().split("T")[0];
        let matchTimeStr = "00:00";
        if (match.estimateStartTime) {
          const d = new Date(match.estimateStartTime);
          matchDateStr = d.toISOString().split("T")[0];
          matchTimeStr = d.toISOString().split("T")[1].substring(0, 5);
        }

        const fixtureId = `sb_${externalId}`;

        // Upsert fixture
        const { error: fixError } = await supabase.from("fixtures").upsert({
          id: fixtureId,
          external_api_id: parseInt(externalId.toString().replace(/\D/g, "")) || Math.floor(Math.random() * 1000000),
          home_team: homeTeam,
          away_team: awayTeam,
          competition: match.sport?.category?.tournament?.name || match.tournamentName || "Sportybet Match",
          sport: match.sport?.name || match.sportName || "Football",
          match_date_iso: matchDateStr,
          match_time: matchTimeStr,
          status: "Not Started",
        }, { onConflict: "id" });

        if (fixError) continue;

        // Insert or Update selection
        if (packageId === "free") {
          const existing = freePredictions.find(p => p.fixture_id === fixtureId);
          if (!existing) {
            const { error: predError } = await supabase.from("predictions").insert({
              id: `pred_sb_${externalId}_${Date.now()}`,
              fixture_id: fixtureId,
              tip: prediction || "Prediction",
              odds: parsedOdds || null,
              result: "pending",
            });
            if (!predError) totalAdded++;
          } else {
            await supabase.from("predictions").update({
              tip: prediction || "Prediction",
              odds: parsedOdds || null
            }).eq("id", existing.id);
            totalAdded++;
          }
        } else {
          const existing = vipSelections.find(s => s.package_id === packageId && s.fixture_id === fixtureId);
          if (!existing) {
            const { error: pkgError } = await supabase.from("vip_package_fixtures").insert({
              id: `vpf_sb_${externalId}_${Date.now()}`,
              package_id: packageId,
              fixture_id: fixtureId,
              prediction: prediction || "Prediction",
              odds: parsedOdds || null,
              result_status: "pending",
            });
            if (!pkgError) totalAdded++;
          } else {
            await supabase.from("vip_package_fixtures").update({
              prediction: prediction || "Prediction",
              odds: parsedOdds || null
            }).eq("id", existing.id);
            totalAdded++;
          }
        }
      }

      if (totalAdded === 0) throw new Error("No new matches added (they may already be in the package).");

      // Auto-save booking code to the right place
      if (packageId === "free") {
        // Save booking code + set status to 'available' in daily_settings
        const todayDate = new Date().toISOString().split("T")[0];
        await supabase.from("daily_settings").upsert({
          date: todayDate,
          free_booking_code: cleanCode,
          status: "available",
          updated_at: new Date().toISOString(),
        }, { onConflict: "date" });
      } else {
        // Save booking code + computed combined odds to the VIP package
        const combinedOdds = allOdds.length > 0
          ? parseFloat(allOdds.reduce((acc, o) => acc * o, 1).toFixed(2))
          : null;
        await supabase.from("vip_packages").update({
          booking_code: cleanCode,
          ...(combinedOdds !== null ? { combined_odds: combinedOdds } : {}),
        }).eq("id", packageId);
      }

      return totalAdded;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["fixtures"] });
      queryClient.invalidateQueries({ queryKey: ["vip_package_fixtures"] });
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
      queryClient.invalidateQueries({ queryKey: ["vip_packages"] });
      queryClient.invalidateQueries({ queryKey: ["daily_settings"] });
      refetchDailySettings();
      toast.success(`Imported! ${count} games loaded and booking code saved.`);
      setSportybetCode("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const computePackageResult = (pkgId: string): ResultStatus => {
    const sels = getPackageSelections(pkgId);
    if (!sels.length) return "pending";
    if (sels.some((s) => s.result_status === "lost")) return "lost";
    if (sels.every((s) => s.result_status === "won")) return "won";
    return "pending";
  };

  const computeFreeResult = (): ResultStatus => {
    if (!freePredictions.length) return "pending";
    if (freePredictions.some((s) => s.result === "lost")) return "lost";
    if (freePredictions.every((s) => s.result === "won")) return "won";
    return "pending";
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Shared styles (theme-aware) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const card: React.CSSProperties = {
    background: "var(--card)", borderRadius: 12,
    border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    overflow: "hidden",
  };
  const inputStyle: React.CSSProperties = {
    padding: "9px 13px", borderRadius: 8, border: "1px solid var(--border)",
    fontSize: 13, color: "var(--foreground)", background: "var(--card)",
    outline: "none", width: "100%",
  };
  const btnPrimary: React.CSSProperties = {
    padding: "9px 18px", background: "var(--foreground)", color: "var(--background)",
    border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13,
    cursor: "pointer", fontFamily: "'Montserrat', sans-serif",
    transition: "all 0.2s ease",
    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  };
  const btnAmber: React.CSSProperties = {
    ...btnPrimary, background: "linear-gradient(135deg, #4ade80 0%, #22c55e 100%)", color: "#fff", boxShadow: "0 4px 12px rgba(34, 197, 94, 0.25)",
  };
  const btnRed: React.CSSProperties = { 
    ...btnPrimary, background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", color: "#fff",
    boxShadow: "0 4px 12px rgba(239, 68, 68, 0.25)",
  };
  const btnGhost: React.CSSProperties = {
    ...btnPrimary, background: "var(--secondary)", color: "var(--foreground)",
    border: "1px solid var(--border)", boxShadow: "none",
  };
  const btnGreen: React.CSSProperties = {
    ...btnPrimary, background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", color: "#fff",
    boxShadow: "0 4px 12px rgba(34, 197, 94, 0.25)",
  };

  // Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Render Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const tabs: { key: PackageTab; label: string }[] = [
    { key: "free", label: "Free Tips" },
    { key: "vip_1", label: "VIP 1" },
    { key: "vip_2", label: "VIP 2" },
    { key: "vip_3", label: "VIP 3" },
  ];

  const activeVipPkg = vipPackages.find((p) => p.id === activeTab);

  const sortSelections = (list: any[]) => {
    return [...list].sort((a, b) => {
      const resA = a.result || a.result_status;
      const resB = b.result || b.result_status;
      if (resA === "pending" && resB !== "pending") return -1;
      if (resA !== "pending" && resB === "pending") return 1;
      return 0;
    });
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 0 80px", fontFamily: "'Montserrat', sans-serif" }}>

      {/* â”€â”€ Page Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{ padding: "32px 0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>Games Control</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--muted-foreground)" }}>
            Manage predictions, VIP packages and results
          </p>
        </div>
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Package Tabs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="hide-scrollbar" style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)", overflowX: "auto", whiteSpace: "nowrap" }}>
        {tabs.map((t) => {
          const isActive = activeTab === t.key;
          const matchCount = t.key !== "free" ? getPackageSelections(t.key).length : freePredictions.length;
          const labelWithCount = t.key !== "free" ? `${t.label} (${matchCount})` : t.label;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "12px 24px", border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 14, fontFamily: "'Montserrat', sans-serif",
                borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                background: "transparent",
                color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {labelWithCount}
            </button>
          );
        })}
      </div>

      {/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
          FREE PREDICTIONS TAB
      Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */}
      {activeTab === "free" && (() => {
        const overallResult = computeFreeResult();
        const avail = (freeDailyStatus || "draft") as AvailabilityStatus;
        const isEditing = editingPkg === "free";
        const dynamicCombinedOdds = freePredictions.length > 0
          ? freePredictions.reduce((acc, pred) => acc * (Number(pred.odds) || 1), 1)
          : null;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Daily Settings Card */}
            <div style={card}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--secondary)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--foreground)" }}>Today's Free Bet</h2>
                  <Badge label={avail} style={{ background: AVAIL_COLORS[avail].bg, color: AVAIL_COLORS[avail].color }} />
                  <Badge label={overallResult} style={{ background: RESULT_COLORS[overallResult].bg, color: RESULT_COLORS[overallResult].color }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!isEditing ? (
                    <button style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => { setEditingPkg("free"); setPkgEdits({ availability_status: freeDailyStatus }); }}>
                      <Edit2 size={14} /> Edit Settings
                    </button>
                  ) : (
                    <>
                      <button style={{...btnGreen, opacity: dailySettingsSaving ? 0.7 : 1}} disabled={dailySettingsSaving} onClick={async () => {
                        setDailySettingsSaving(true);
                        const { error } = await supabase.from("daily_settings").upsert({
                          date: today,
                          status: pkgEdits.availability_status,
                          free_booking_code: freeDailyCode.trim() || null,
                          updated_at: new Date().toISOString(),
                        }, { onConflict: "date" });
                        setDailySettingsSaving(false);
                        if (error) {
                          toast.error(error.message);
                        } else {
                          setFreeDailyStatus(pkgEdits.availability_status);
                          refetchDailySettings();
                          toast.success("Settings saved!");
                          setEditingPkg(null);
                        }
                      }}>
                        Save
                      </button>
                      <button style={btnGhost} onClick={() => setEditingPkg(null)}>Cancel</button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", margin: "0 0 6px", letterSpacing: "0.4px" }}>Combined Odds</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", margin: 0, fontFamily: "'Montserrat', sans-serif" }}>
                    {dynamicCombinedOdds ? Number(dynamicCombinedOdds).toFixed(2) : <span style={{ color: "var(--muted)" }}>Auto-calc</span>}
                  </p>
                </div>

                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", margin: "0 0 6px", letterSpacing: "0.4px" }}>Booking Code</p>
                  {isEditing ? (
                    <input
                      style={{ ...inputStyle, fontFamily: "monospace", width: "100%" }}
                      placeholder="e.g. BC34A8"
                      value={freeDailyCode}
                      onChange={(e) => setFreeDailyCode(e.target.value.replace(/\s/g, "").toUpperCase())}
                    />
                  ) : (
                    <p style={{ fontSize: 20, fontWeight: 800, color: "#22c55e", margin: 0, fontFamily: "monospace" }}>
                      {freeDailyCode || <span style={{ color: "var(--muted)" }}>Import below</span>}
                    </p>
                  )}
                </div>

                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", margin: "0 0 6px", letterSpacing: "0.4px" }}>Availability</p>
                  {isEditing ? (
                    <select
                      style={{ ...inputStyle }}
                      value={pkgEdits.availability_status}
                      onChange={(e) => setPkgEdits((prev: any) => ({ ...prev, availability_status: e.target.value as AvailabilityStatus }))}
                    >
                      <option value="draft">Draft</option>
                      <option value="available">Available</option>
                      <option value="sold_out">Sold Out</option>
                    </select>
                  ) : (
                    <p style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>{avail.replace("_", " ")}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Import from Sportybet */}
            <div style={{ ...card, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Upload size={16} className="text-green-500" />
                  Import from Sportybet
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
                  Paste a Sportybet booking code to instantly auto-fill games and predictions.
                </p>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <input
                  style={{ ...inputStyle, maxWidth: 300, fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}
                  placeholder="e.g. BC12345"
                  value={sportybetCode}
                  onChange={(e) => setSportybetCode(e.target.value.replace(/\s/g, "").toUpperCase())}
                  onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text").replace(/\s/g, "").toUpperCase(); setSportybetCode(t); }}
                  onKeyDown={(e) => e.key === "Enter" && importSportybetMutation.mutate({ code: sportybetCode, packageId: "free" })}
                />
                <button
                  style={{ ...btnAmber, display: "flex", alignItems: "center", gap: 8, opacity: importSportybetMutation.isPending ? 0.7 : 1 }}
                  disabled={!sportybetCode.trim() || importSportybetMutation.isPending}
                  onClick={() => importSportybetMutation.mutate({ code: sportybetCode, packageId: "free" })}
                >
                  {importSportybetMutation.isPending ? "Importing..." : "Load Package"}
                </button>
              </div>
            </div>

            {/* Published Free Predictions */}
            <div className="mobile-no-card" style={card}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
                  Free Predictions ({freePredictions.length} matches)
                </h3>
                <Badge label={overallResult} style={{ background: RESULT_COLORS[overallResult].bg, color: RESULT_COLORS[overallResult].color }} />
              </div>

              {freePredictions.length === 0 ? (
                <div style={{ padding: "36px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>
                  No free predictions yet. Import a booking code above or add manually below.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="responsive-table">
                    {Object.entries(
                      sortSelections(freePredictions).reduce((acc, pred: any) => {
                        const fix = pred.fixture || getFixtureById(pred.fixture_id);
                        const sport = fix?.sport || "Other";
                        if (!acc[sport]) acc[sport] = [];
                        acc[sport].push(pred);
                        return acc;
                      }, {} as Record<string, any[]>)
                    ).map(([sport, preds]) => (
                      <Fragment key={sport}>
                        <thead>
                          <tr><th colSpan={6} style={{ padding: "12px 24px", background: "var(--border)", color: "var(--foreground)", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>{sport}</th></tr>
                          <tr style={{ background: "var(--secondary)", textAlign: "left" }}>
                            <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Match</th>
                            <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Competition</th>
                            <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Tip</th>
                            <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Odds</th>
                            <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Result</th>
                            <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(preds as any[]).map((pred: any) => {
                            const fix = pred.fixture || getFixtureById(pred.fixture_id);
                            const result = pred.result as ResultStatus;
                            return (
                              <tr key={pred.id}>
                                <td data-label="Match" style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                                  {fix ? `${fix.home_team} vs ${fix.away_team}` : pred.fixture_id}
                                  {fix && <div style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 400, marginTop: 2 }}>{fix.match_time}</div>}
                                </td>
                                <td data-label="Competition" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                                  {fix?.competition || "—"}
                                </td>
                                <td data-label="Tip" style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{pred.tip}</td>
                                <td data-label="Odds" style={{ fontSize: 14, color: "var(--muted-foreground)", fontWeight: 600 }}>
                                  {pred.odds ? Number(pred.odds).toFixed(2) : "—"}
                                </td>
                                <td data-label="Result">
                                  <Badge
                                    label={result}
                                    style={{ background: RESULT_COLORS[result].bg, color: RESULT_COLORS[result].color }}
                                  />
                                </td>
                                <td data-label="Actions" style={{ textAlign: "right" }}>
                                  <div className="desktop-actions" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                    {(["won", "pending", "lost"] as ResultStatus[]).map((r) => (
                                      <button
                                        key={r}
                                        onClick={() => updateFreePredResult.mutate({ id: pred.id, result: r })}
                                        disabled={result === r}
                                        style={{
                                          padding: "5px 11px", borderRadius: 6, border: "none",
                                          fontSize: 12, fontWeight: 700, cursor: result === r ? "default" : "pointer",
                                          fontFamily: "'Montserrat', sans-serif",
                                          display: "inline-flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: "6px",
                                          background: result === r ? RESULT_COLORS[r].bg : "var(--secondary)",
                                          color: result === r ? RESULT_COLORS[r].color : "var(--muted-foreground)",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        <span>{r === "pending" ? "?" : r === "won" ? "✓" : "✗"}</span>
                                        <span style={{ textTransform: "capitalize" }}>{r}</span>
                                      </button>
                                    ))}
                                    <button
                                      onClick={() => deleteFreePred.mutate(pred.id)}
                                      style={{ ...btnRed, padding: "5px 12px", fontSize: 12 }}
                                    >
                                      Remove
                                    </button>
                                  </div>

                                  <div className="mobile-actions" style={{ justifyContent: "flex-end" }}>
                                    <button onClick={() => setActionDrawerId(pred.id)} style={{ background: "transparent", color: "var(--muted-foreground)", border: "none", padding: "8px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <ChevronDown size={20} />
                                    </button>
                                  </div>

                                  {actionDrawerId === pred.id && (
                                    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setActionDrawerId(null)}>
                                      <div style={{ background: "var(--card)", padding: 24, paddingBottom: 40, borderTopLeftRadius: 16, borderTopRightRadius: 16, animation: "slideUp 0.2s ease", display: "flex", flexDirection: "column", gap: 12 }} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Update Result</h3>
                                          <button onClick={() => setActionDrawerId(null)} style={{ background: "transparent", border: "none", fontSize: 20, color: "var(--muted-foreground)" }}>✗</button>
                                        </div>
                                        {(["won", "pending", "lost"] as ResultStatus[]).map((r) => (
                                          <button
                                            key={r}
                                            onClick={() => { updateFreePredResult.mutate({ id: pred.id, result: r }); setActionDrawerId(null); }}
                                            disabled={result === r}
                                            style={{
                                              padding: "14px", borderRadius: 8, border: "none",
                                              fontSize: 14, fontWeight: 700, cursor: result === r ? "default" : "pointer",
                                              display: "flex", justifyContent: "center", alignItems: "center", gap: "8px",
                                              background: result === r ? RESULT_COLORS[r].bg : "var(--secondary)",
                                              color: result === r ? RESULT_COLORS[r].color : "var(--foreground)",
                                              opacity: result === r ? 1 : 0.9,
                                            }}
                                          >
                                            <span>{r === "pending" ? "?" : r === "won" ? "✓" : "✗"}</span>
                                            <span style={{ textTransform: "capitalize" }}>{r}</span>
                                          </button>
                                        ))}
                                        <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
                                        <button
                                          onClick={() => { deleteFreePred.mutate(pred.id); setActionDrawerId(null); }}
                                          style={{ ...btnRed, padding: "14px", fontSize: 14 }}
                                        >
                                          Remove Match
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Fragment>
                    ))}
                  </table>
                </div>
              )}
            </div>


          </div>
        );
      })()}

      {/* â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” 
          VIP PACKAGE TABS
      â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€” */}
      {activeTab !== "free" && activeVipPkg && (() => {
        const pkg = activeVipPkg;
        const selections = getPackageSelections(pkg.id);
        const overallResult = computePackageResult(pkg.id);
        const avail = (pkg.availability_status || "draft") as AvailabilityStatus;
        const isEditing = editingPkg === pkg.id;
        const dynamicCombinedOdds = selections.length > 0
          ? selections.reduce((acc, sel) => acc * (Number(sel.odds) || 1), 1)
          : null;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Package Settings Card */}
            <div style={card}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--secondary)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "var(--foreground)" }}>{pkg.name}</h2>
                  <Badge label={avail} style={{ background: AVAIL_COLORS[avail].bg, color: AVAIL_COLORS[avail].color }} />
                  <Badge label={overallResult} style={{ background: RESULT_COLORS[overallResult].bg, color: RESULT_COLORS[overallResult].color }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!isEditing ? (
                    <button style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => { setEditingPkg(pkg.id); setPkgEdits({ price: pkg.price, availability_status: pkg.availability_status }); }}>
                      <Edit2 size={14} /> Edit Package
                    </button>
                  ) : (
                    <>
                      <button style={btnGreen} onClick={() => updatePackageMutation.mutate({ id: pkg.id, updates: { price: Number(pkgEdits.price), availability_status: pkgEdits.availability_status } })}>
                        Save
                      </button>
                      <button style={btnGhost} onClick={() => setEditingPkg(null)}>Cancel</button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 24 }}>
                  <div key="price">
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", margin: "0 0 6px", letterSpacing: "0.4px" }}>Price (GHS)</p>
                    {isEditing ? (
                      <input
                        style={inputStyle}
                        type="number"
                        placeholder="0.00"
                        value={pkgEdits.price ?? ""}
                        onChange={(e) => setPkgEdits((prev: any) => ({ ...prev, price: e.target.value }))}
                      />
                    ) : (
                      <p style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", margin: 0, fontFamily: "'Montserrat', sans-serif" }}>
                        GHS {Number(pkg.price || 0).toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", margin: "0 0 6px", letterSpacing: "0.4px" }}>Combined Odds</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", margin: 0, fontFamily: "'Montserrat', sans-serif" }}>
                      {dynamicCombinedOdds ? Number(dynamicCombinedOdds).toFixed(2) : <span style={{ color: "var(--muted)" }}>Auto-calc</span>}
                    </p>
                  </div>

                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", margin: "0 0 6px", letterSpacing: "0.4px" }}>Booking Code</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: "#22c55e", margin: 0, fontFamily: "monospace" }}>
                      {pkg.booking_code || <span style={{ color: "var(--muted)" }}>Import below</span>}
                    </p>
                  </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", margin: "0 0 6px", letterSpacing: "0.4px" }}>Availability</p>
                  {isEditing ? (
                    <select
                      style={{ ...inputStyle }}
                      value={pkgEdits.availability_status}
                      onChange={(e) => setPkgEdits((prev: any) => ({ ...prev, availability_status: e.target.value }))}
                    >
                      <option value="draft">Draft</option>
                      <option value="available">Available</option>
                      <option value="sold_out">Sold Out</option>
                    </select>
                  ) : (
                    <p style={{ fontSize: 20, fontWeight: 800, color: "var(--foreground)", margin: 0 }}>{avail.replace("_", " ")}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Import from Sportybet */}
            <div style={{ ...card, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Upload size={16} className="text-green-500" />
                  Import from Sportybet
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
                  Paste a Sportybet booking code to instantly auto-fill games and predictions.
                </p>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <input
                  style={{ ...inputStyle, maxWidth: 300, fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}
                  placeholder="e.g. BC12345"
                  value={sportybetCode}
                  onChange={(e) => setSportybetCode(e.target.value.replace(/\s/g, "").toUpperCase())}
                  onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text").replace(/\s/g, "").toUpperCase(); setSportybetCode(t); }}
                  onKeyDown={(e) => e.key === "Enter" && importSportybetMutation.mutate({ code: sportybetCode, packageId: pkg.id })}
                />
                <button
                  style={{ ...btnAmber, display: "flex", alignItems: "center", gap: 8, opacity: importSportybetMutation.isPending ? 0.7 : 1 }}
                  disabled={!sportybetCode.trim() || importSportybetMutation.isPending}
                  onClick={() => importSportybetMutation.mutate({ code: sportybetCode, packageId: pkg.id })}
                >
                  {importSportybetMutation.isPending ? "Importing..." : "Load Package"}
                </button>
              </div>
            </div>

            {/* Selections in this package */}
            <div className="mobile-no-card" style={card}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--secondary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
                  Package Selections ({selections.length} matches)
                </h3>
                <Badge label={overallResult} style={{ background: RESULT_COLORS[overallResult].bg, color: RESULT_COLORS[overallResult].color }} />
              </div>

              {selections.length === 0 ? (
                <div style={{ padding: "36px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>
                  No fixtures loaded yet. Import a booking code above to populate this package.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="responsive-table">
                  {Object.entries(
                    sortSelections(selections).reduce((acc, sel: any) => {
                      const fix = sel.fixture || getFixtureById(sel.fixture_id);
                      const sport = fix?.sport || "Other";
                      if (!acc[sport]) acc[sport] = [];
                      acc[sport].push(sel);
                      return acc;
                    }, {} as Record<string, any[]>)
                  ).map(([sport, sels]) => (
                    <Fragment key={sport}>
                      <thead>
                        <tr><th colSpan={6} style={{ padding: "12px 24px", background: "var(--border)", color: "var(--foreground)", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>{sport}</th></tr>
                        <tr style={{ textAlign: "left", background: "var(--secondary)" }}>
                          <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Match</th>
                          <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Competition</th>
                          <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Prediction</th>
                          <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Odds</th>
                          <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Result</th>
                          <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sels as any[]).map((sel: any) => {
                          const fix = sel.fixture || getFixtureById(sel.fixture_id);
                          const selResult = sel.result_status as ResultStatus;
                          return (
                            <tr key={sel.id}>
                              <td data-label="Match" style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                                {fix ? `${fix.home_team} vs ${fix.away_team}` : sel.fixture_id}
                                {fix && <div style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 400, marginTop: 2 }}>{fix.match_time}</div>}
                              </td>
                              <td data-label="Competition" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{fix?.competition || "—"}</td>
                              <td data-label="Prediction" style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{sel.prediction}</td>
                              <td data-label="Odds" style={{ fontSize: 14, fontWeight: 600, color: "var(--muted-foreground)" }}>
                                {sel.odds ? Number(sel.odds).toFixed(2) : "—"}
                              </td>
                              <td data-label="Result">
                                <Badge label={selResult} style={{ background: RESULT_COLORS[selResult].bg, color: RESULT_COLORS[selResult].color }} />
                              </td>
                              <td data-label="Actions" style={{ textAlign: "right" }}>
                                <div className="desktop-actions" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                  {(["won", "pending", "lost"] as ResultStatus[]).map((r) => (
                                    <button key={r}
                                      onClick={() => updateSelectionResult.mutate({ id: sel.id, result_status: r })}
                                      disabled={selResult === r}
                                      style={{
                                        padding: "5px 11px", borderRadius: 6, border: "none",
                                        fontSize: 12, fontWeight: 700, cursor: selResult === r ? "default" : "pointer",
                                        fontFamily: "'Montserrat', sans-serif",
                                        display: "inline-flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: "6px",
                                        background: selResult === r ? RESULT_COLORS[r].bg : "var(--secondary)",
                                        color: selResult === r ? RESULT_COLORS[r].color : "var(--muted-foreground)",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      <span>{r === "pending" ? "?" : r === "won" ? "✓" : "✗"}</span>
                                      <span style={{ textTransform: "capitalize" }}>{r}</span>
                                    </button>
                                  ))}
                                  <button style={{ ...btnRed, padding: "5px 12px", fontSize: 12 }}
                                    onClick={() => removeSelectionMutation.mutate({ id: sel.id, packageId: sel.package_id, remainingCount: selections.length - 1 })}>
                                    Remove
                                  </button>
                                </div>

                                <div className="mobile-actions" style={{ justifyContent: "flex-end" }}>
                                  <button onClick={() => setActionDrawerId(sel.id)} style={{ background: "transparent", color: "var(--muted-foreground)", border: "none", padding: "8px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <ChevronDown size={20} />
                                  </button>
                                </div>

                                {actionDrawerId === sel.id && (
                                  <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setActionDrawerId(null)}>
                                    <div style={{ background: "var(--card)", padding: 24, paddingBottom: 40, borderTopLeftRadius: 16, borderTopRightRadius: 16, animation: "slideUp 0.2s ease", display: "flex", flexDirection: "column", gap: 12 }} onClick={e => e.stopPropagation()}>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Update Result</h3>
                                        <button onClick={() => setActionDrawerId(null)} style={{ background: "transparent", border: "none", fontSize: 20, color: "var(--muted-foreground)" }}>✗</button>
                                      </div>
                                      {(["won", "pending", "lost"] as ResultStatus[]).map((r) => (
                                        <button
                                          key={r}
                                          onClick={() => { updateSelectionResult.mutate({ id: sel.id, result_status: r }); setActionDrawerId(null); }}
                                          disabled={selResult === r}
                                          style={{
                                            padding: "14px", borderRadius: 8, border: "none",
                                            fontSize: 14, fontWeight: 700, cursor: selResult === r ? "default" : "pointer",
                                            display: "flex", justifyContent: "center", alignItems: "center", gap: "8px",
                                            background: selResult === r ? RESULT_COLORS[r].bg : "var(--secondary)",
                                            color: selResult === r ? RESULT_COLORS[r].color : "var(--foreground)",
                                            opacity: selResult === r ? 1 : 0.9,
                                          }}
                                        >
                                          <span>{r === "pending" ? "?" : r === "won" ? "✓" : "✗"}</span>
                                          <span style={{ textTransform: "capitalize" }}>{r}</span>
                                        </button>
                                      ))}
                                      <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }} />
                                      <button
                                        onClick={() => { removeSelectionMutation.mutate({ id: sel.id, packageId: sel.package_id, remainingCount: selections.length - 1 }); setActionDrawerId(null); }}
                                        style={{ ...btnRed, padding: "14px", fontSize: 14 }}
                                      >
                                        Remove Match
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Fragment>
                  ))}
                </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function BellDot() { return <span className="bell-dot" aria-hidden="true">&bull;</span>; }







