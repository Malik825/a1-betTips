import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Crown, Gift, Save, Search, ShieldCheck, Ticket, Trophy, Upload } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import "../../package-editor.css";

export const Route = createFileRoute("/admin/edit-package")({ component: EditPackagePage });

type GameFilter = "All Games" | "Today" | "Tomorrow" | "Yesterday";

function EditPackagePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const packageId = "vip_1"; // Mocking this to use the first VIP package in the database

  const [filter, setFilter] = useState<GameFilter>("All Games");
  const [search, setSearch] = useState("");
  const [sportybetCode, setSportybetCode] = useState("");
  
  // Local state for the package details while editing
  const [pkg, setPkg] = useState({
    name: "VIP 1",
    price: "0",
    combined_odds: "",
    booking_code: "",
    availability_status: "available",
    expires_at: "",
    description: "Premium package with high-probability games. Higher winning rate, better odds."
  });

  // Fetch package details
  const { data: remotePkg, isLoading: pkgLoading } = useQuery({
    queryKey: ["vip_package", packageId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vip_packages").select("*").eq("id", packageId).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  // Fetch fixtures for this package
  const { data: remoteSelections = [], isLoading: selectionsLoading } = useQuery({
    queryKey: ["vip_package_fixtures", packageId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vip_package_fixtures").select(`
        id, prediction, odds, result_status,
        fixtures (id, home_team, away_team, competition, match_time, match_date)
      `).eq("package_id", packageId);
      if (error) throw error;
      return data;
    }
  });

  // Helper: convert ISO string from DB → value for datetime-local input
  const toDatetimeLocal = (iso: string | null | undefined) => {
    if (!iso) return "";
    // datetime-local needs "YYYY-MM-DDTHH:mm" (no seconds, no Z)
    return iso.slice(0, 16);
  };

  useEffect(() => {
    if (remotePkg) {
      setPkg({
        name: remotePkg.name || "VIP Package",
        price: remotePkg.price?.toString() || "0",
        combined_odds: remotePkg.combined_odds?.toString() || "",
        booking_code: remotePkg.booking_code || "",
        availability_status: remotePkg.availability_status || "draft",
        expires_at: toDatetimeLocal(remotePkg.expires_at),
        description: `Premium package with high-probability games. Higher winning rate, better odds.`
      });
      if (remotePkg.booking_code) {
        setSportybetCode(remotePkg.booking_code);
      }
    }
  }, [remotePkg]);

  // Save Package Mutation
  const savePackageMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vip_packages").update({
        name: pkg.name,
        price: parseFloat(pkg.price) || 0,
        combined_odds: parseFloat(pkg.combined_odds) || null,
        booking_code: pkg.booking_code,
        availability_status: pkg.availability_status,
        // Store as UTC ISO string, or null if cleared
        expires_at: pkg.expires_at ? new Date(pkg.expires_at).toISOString() : null,
      }).eq("id", packageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vip_package", packageId] });
      toast.success(`${pkg.name} saved successfully`);
    },
    onError: (err: any) => toast.error(err.message)
  });

  // Import from Sportybet Mutation (Auto-fill) — routes through the edge function
  const importSportybetMutation = useMutation({
    mutationFn: async (code: string) => {
      const cleanCode = code.replace(/\s/g, "").toUpperCase();
      if (!cleanCode) throw new Error("Enter a booking code.");

      // Use the same Supabase edge function as games.tsx (works in production)
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "sportybet-proxy",
        { body: { shareCode: cleanCode } }
      );

      if (fnError) throw new Error((fnError as FunctionsHttpError | FunctionsFetchError).message || "Edge function error.");

      const json = fnData;
      if (!json || json.error) throw new Error(json?.error || "Unknown error from proxy.");
      if (json.bizCode !== 10000)
        throw new Error(`Invalid or expired code "${cleanCode}". ${json.message || json.innerMsg || ""}`);

      // Handle both known Sportybet response shapes:
      // json.data.betList[].events[]  OR  json.data.outcomes[]
      const betList = json.data?.betList || [];
      const matches: any[] =
        betList.length > 0
          ? betList.flatMap((bet: any) => bet.events || bet.outcomes || [])
          : (json.data?.outcomes || json.data?.events || []);

      if (matches.length === 0) throw new Error("No matches found in booking code.");

      let totalAdded = 0;
      for (const match of matches) {
        const homeTeam = match.homeTeamName || match.home?.name || match.homeTeam || "Home";
        const awayTeam = match.awayTeamName || match.away?.name || match.awayTeam || "Away";
        const odds = match.odds;
        const prediction = `${match.marketName || ""} ${match.outcomeName || match.desc || ""}`.trim();
        const externalId = match.eventId || Math.random().toString().substring(2, 10);

        let matchDateStr = new Date().toISOString().split("T")[0];
        let matchTimeStr = "00:00";
        if (match.estimateStartTime) {
          const d = new Date(match.estimateStartTime);
          matchDateStr = d.toISOString().split("T")[0];
          matchTimeStr = d.toISOString().split("T")[1].substring(0, 5);
        }

        const fixtureId = `sb_${externalId}`;

        const { error: fixError } = await supabase.from("fixtures").upsert({
          id: fixtureId,
          external_api_id: parseInt(externalId) || 0,
          home_team: homeTeam,
          away_team: awayTeam,
          competition: match.tournamentName || "Sportybet Match",
          match_date: matchDateStr,
          match_date_iso: matchDateStr,
          match_time: matchTimeStr,
          status: "Not Started",
        }, { onConflict: "id" });

        if (fixError) continue;

        const { error: pkgError } = await supabase.from("vip_package_fixtures").insert({
          id: `vpf_sb_${externalId}_${Date.now()}`,
          package_id: packageId,
          fixture_id: fixtureId,
          prediction: prediction || "Prediction",
          odds: parseFloat(odds) || null,
          result_status: "pending",
        });

        if (!pkgError) totalAdded++;
      }

      return totalAdded;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["vip_package_fixtures"] });
      toast.success(`Successfully imported and auto-filled ${count} games!`);
      // Auto-save the booking code to the package
      setPkg(prev => ({ ...prev, booking_code: sportybetCode }));
    },
    onError: (err: any) => toast.error(err.message),
  });

  const save = () => savePackageMutation.mutate();
  const update = (patch: Partial<typeof pkg>) => setPkg((current) => ({ ...current, ...patch }));

  if (pkgLoading) return <div style={{ padding: 40, textAlign: "center" }}>Loading package...</div>;

  return <main className="package-editor-page">
    <header className="editor-header">
      <div className="editor-title">
        <button className="back-button" aria-label="Back to games" onClick={() => navigate({ to: "/admin/games" })}><ArrowLeft size={19} /></button>
        <div><h1>Edit Package</h1><p>Configure package settings and auto-fill games using a booking code</p></div>
      </div>
      <button className="save-button" onClick={save} disabled={savePackageMutation.isPending}>
        <Save size={14} /> {savePackageMutation.isPending ? "Saving..." : "Save Package"}
      </button>
    </header>
    
    <section className="editor-top-grid">
      <div className="editor-panel details-panel">
        <PanelHeading title="Package Details" description="Set up the package information" />
        <div className="details-grid">
          <label>Package Name<input value={pkg.name} onChange={(event) => update({ name: event.target.value })} /></label>
          <label>Availability
            <div className="input-icon">
              <select value={pkg.availability_status} onChange={(e) => update({ availability_status: e.target.value })}>
                <option value="draft">Draft</option>
                <option value="available">Available</option>
                <option value="sold_out">Sold Out</option>
              </select>
            </div>
          </label>
          <label>Price (GH₵)<input type="number" value={pkg.price} onChange={(event) => update({ price: event.target.value })} /></label>
          <label>Total Odds (Target)<input value={pkg.combined_odds} onChange={(e) => update({ combined_odds: e.target.value })} /><small>Target combined odds (optional)</small></label>
          <label>
            Expires At
            <input
              type="datetime-local"
              value={pkg.expires_at}
              onChange={(e) => update({ expires_at: e.target.value })}
            />
            <small>
              {pkg.expires_at
                ? `Package auto-expires ${new Date(pkg.expires_at) < new Date() ? "(already expired)" : `on ${new Date(pkg.expires_at).toLocaleString()}`}`
                : "Leave blank — package never auto-expires"}
            </small>
          </label>
          <label>Number of Games<input value={remoteSelections.length} readOnly /><small>Currently selected games</small></label>
          <label className="description-field">Package Description<textarea value={pkg.description} onChange={(e) => update({ description: e.target.value })} /><small>{pkg.description.length} / 200</small></label>
        </div>

        {/* Auto-fill section */}
        <div style={{ marginTop: "24px", padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", margin: "0 0 12px" }}>
            <Upload size={16} color="#22c55e" /> Sportybet Auto-fill
          </h3>
          <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px" }}>Paste a booking code to automatically fetch matches and add them to this package.</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <input 
              style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              placeholder="e.g. BC12345"
              value={sportybetCode}
              onChange={(e) => setSportybetCode(e.target.value)}
            />
            <button 
              onClick={() => importSportybetMutation.mutate(sportybetCode)}
              disabled={importSportybetMutation.isPending || !sportybetCode.trim()}
              style={{ padding: "8px 16px", background: "#22c55e", color: "white", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer", opacity: importSportybetMutation.isPending ? 0.7 : 1 }}
            >
              {importSportybetMutation.isPending ? "Fetching..." : "Auto-fill Games"}
            </button>
          </div>
        </div>

      </div>
      
      <aside className="editor-panel preview-panel">
        <PanelHeading title="Package Preview" />
        <div className="preview-card">
          <div className="preview-card-title">
            <div className="preview-icon"><Crown size={20} /></div>
            <div>
              <h2>{pkg.name}</h2>
              <p>{remoteSelections.length} Games · Target Odds: {pkg.combined_odds || "N/A"}</p>
            </div>
            <span className="active-pill" style={{ background: pkg.availability_status === 'available' ? '#dcfce7' : '#fee2e2', color: pkg.availability_status === 'available' ? '#166534' : '#991b1b' }}>
              {pkg.availability_status}
            </span>
          </div>
          <ul>
            {[`${remoteSelections.length} selected games`, "Higher winning rate", "Priority support", "Mystery bonus"].map((item) => <li key={item}><Check size={14} />{item}</li>)}
          </ul>
          <strong>GH₵{pkg.price}</strong>
          <button className="save-button" onClick={save} disabled={savePackageMutation.isPending}><Save size={13} /> Save Package</button>
        </div>
      </aside>
    </section>
    
    <section className="editor-panel games-picker">
      <div className="picker-header">
        <div className="editor-title">
          <div className="football-icon"><Trophy size={19} /></div>
          <div><h2>Package Games</h2><p>Matches assigned to this package</p></div>
        </div>
        <div className="fetch-status">
          <button className="secondary-button" onClick={() => queryClient.invalidateQueries({ queryKey: ["vip_package_fixtures"] })}>
            <ShieldCheck size={14} /> Refresh Games
          </button>
        </div>
      </div>
      
      <div className="games-table-wrap">
        <table className="games-table">
          <thead>
            <tr>
              <th>Match</th>
              <th>League</th>
              <th>Time</th>
              <th>Prediction</th>
              <th>Odds</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {selectionsLoading ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>Loading games...</td></tr>
            ) : remoteSelections.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>No games added yet. Use the Auto-fill tool above!</td></tr>
            ) : remoteSelections.map((sel: any, index: number) => {
              const fix = sel.fixtures;
              return (
                <tr key={sel.id}>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="club-ball">{index % 2 ? <Gift size={13} /> : <Ticket size={13} />}</span>
                      {fix ? `${fix.home_team} vs ${fix.away_team}` : "Unknown"}
                    </span>
                  </td>
                  <td>{fix?.competition}</td>
                  <td>{fix?.match_time}</td>
                  <td><span className="odds-pill" style={{ background: "#f1f5f9", color: "#111827" }}>{sel.prediction}</span></td>
                  <td><span className="odds-pill">{sel.odds || "—"}</span></td>
                  <td>
                    <span className="today-pill" style={{ background: sel.result_status === "pending" ? "#dcfce7" : sel.result_status === "won" ? "#dcfce7" : "#fee2e2", color: sel.result_status === "pending" ? "#166534" : sel.result_status === "won" ? "#166534" : "#991b1b" }}>
                      {sel.result_status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  </main>;
}

function PanelHeading({ title, description }: { title: string; description?: string }) { return <div className="panel-heading"><h2>{title}</h2>{description && <p>{description}</p>}</div>; }


