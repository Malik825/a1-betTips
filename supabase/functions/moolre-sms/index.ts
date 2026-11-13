import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ============================================================
// Moolre SMS Dispatcher
//
// Called from the admin /admin/sms UI to dispatch real SMS
// campaigns via the Moolre SMS API.
//
// Reads credentials directly from admin_settings table, with
// fallback to Supabase Secrets (Deno.env):
//   MOOLRE_API_USER
//   MOOLRE_PUB_KEY
//   MOOLRE_SECRET_KEY
//   MOOLRE_SENDER_ID
//   MOOLRE_TEST_MODE
//
// POST body:
//   { audience: "all" | "vip" | "free", message: string }
//
// Returns:
//   { success: true, dispatched: number, results: [...] }
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MOOLRE_SMS_BASE = "https://api.moolre.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // ── Auth: must be called by an authenticated Supabase user ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is an admin
    const userToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(userToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.is_admin === true || ["admin", "superadmin"].includes(profile?.role || "");

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admins only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse request body ──────────────────────────────────────
    const body = await req.json();
    const audience: string = body.audience || "all";
    const message: string = body.message?.trim();

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Moolre credentials: check DB admin_settings first, then Deno.env ──
    const { data: dbSettings } = await supabaseAdmin
      .from("admin_settings")
      .select("moolre_api_user, moolre_pub_key, moolre_secret_key, moolre_sender_id, moolre_test_mode")
      .eq("id", 1)
      .maybeSingle();

    const apiUser = dbSettings?.moolre_api_user || Deno.env.get("MOOLRE_API_USER") || "a1tipsdeck";
    let pubKey = dbSettings?.moolre_pub_key || Deno.env.get("MOOLRE_PUB_KEY") || "";
    let secretKey = dbSettings?.moolre_secret_key || Deno.env.get("MOOLRE_SECRET_KEY") || "";
    const senderId = dbSettings?.moolre_sender_id || Deno.env.get("MOOLRE_SENDER_ID") || "A1TIPS";
    const testMode = dbSettings?.moolre_test_mode !== undefined
      ? Boolean(dbSettings.moolre_test_mode)
      : Deno.env.get("MOOLRE_TEST_MODE") === "true";

    if (!pubKey || pubKey.includes("77702") || pubKey.includes("AlfdLlid")) {
      pubKey = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyaWQiOjExMDkwOSwid2FsbGV0aWQiOiI3ODMzMSIsImV4cCI6MTk1NjUyNzk5OX0.Dt8M2UCTHgBiQ2kiAlfdLIidIT9LqY8822lsEe4j2Kc";
    }
    if (!secretKey || secretKey.startsWith("frIolb") || secretKey.startsWith("CrGfp")) {
      secretKey = "bOYwB4Buu8zCZ9zDiscmwHKyH4C8abeBfdIp5rvvtTlrfjuv4k3PcR8eUkAkcT2l";
    }

    if (!secretKey) {
      return new Response(JSON.stringify({ error: "Moolre Secret Key is not configured yet" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch target phone numbers from profiles ────────────────
    let query = supabaseAdmin
      .from("profiles")
      .select("id, phone, email, is_vip")
      .not("phone", "is", null)
      .neq("phone", "");

    if (audience === "vip") {
      query = query.eq("is_vip", true);
    } else if (audience === "free") {
      query = query.eq("is_vip", false);
    }

    const { data: recipients, error: fetchError } = await query;

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, dispatched: 0, message: "No recipients with phone numbers found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Dispatch SMS via Moolre ─────────────────────────────────
    const phoneList = recipients.map((r: any) => r.phone).filter(Boolean).join(",");

    const smsPayload = {
      recipient: phoneList,
      sender: senderId,
      message: message,
      type: "0",  // 0 = plain text SMS
    };

    let dispatchedCount = 0;
    let moolreResponse: any = null;

    if (testMode) {
      // Test mode: simulate success, don't call Moolre API
      console.log("[TEST MODE] Would send to:", phoneList);
      console.log("[TEST MODE] Message:", message);
      dispatchedCount = recipients.length;
      moolreResponse = { status: 200, message: "Test mode — not actually sent" };
    } else {
      const res = await fetch(`${MOOLRE_SMS_BASE}/open/sms/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-USER": apiUser,
          "X-API-PUBKEY": pubKey,
          "X-API-KEY": secretKey,
        },
        body: JSON.stringify(smsPayload),
      });

      moolreResponse = await res.json();
      console.log("Moolre SMS response:", JSON.stringify(moolreResponse));

      if (res.ok && (moolreResponse.status === 200 || moolreResponse.status === "200")) {
        dispatchedCount = recipients.length;
      } else {
        return new Response(
          JSON.stringify({ error: moolreResponse.message || "Moolre SMS dispatch failed", details: moolreResponse }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Log campaign to database ────────────────────────────────
    const { error: logError } = await supabaseAdmin.from("sms_campaigns").insert({
      audience,
      message,
      sent_count: dispatchedCount,
      gateway: "moolre",
      test_mode: testMode,
    });

    if (logError) {
      console.warn("Could not log SMS campaign:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dispatched: dispatchedCount,
        testMode,
        moolreResponse,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("moolre-sms error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
