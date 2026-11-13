import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MOOLRE_API_BASE = "https://api.moolre.com";

// Moolre response codes
const OTP_REQUIRED_CODE = "TP14";  // OTP SMS sent to payer
const OTP_VERIFIED_CODE = "TP17";  // Phone verification successful — need follow-up call
const SUCCESS_CODES = ["TR099", "TR00"]; // USSD prompt dispatched

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: Please log in" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify authenticated user
    const userToken = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(userToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Load Moolre credentials from admin_settings
    const { data: dbSettings } = await supabaseAdmin
      .from("admin_settings")
      .select("moolre_api_user, moolre_pub_key, moolre_secret_key, moolre_test_mode, moolre_account_number")
      .eq("id", 1)
      .maybeSingle();

    const apiUser = dbSettings?.moolre_api_user || Deno.env.get("MOOLRE_API_USER") || "a1tipsdeck";
    let pubKey = dbSettings?.moolre_pub_key || Deno.env.get("MOOLRE_PUB_KEY") || "";
    let accountNumber = dbSettings?.moolre_account_number || Deno.env.get("MOOLRE_ACCOUNT_NUMBER") || "";
    const testMode = dbSettings?.moolre_test_mode !== undefined ? Boolean(dbSettings.moolre_test_mode) : false;

    if (!pubKey || pubKey.includes("77702") || pubKey.includes("AlfdLlid")) {
      pubKey = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyaWQiOjExMDkwOSwid2FsbGV0aWQiOiI3ODMzMSIsImV4cCI6MTk1NjUyNzk5OX0.Dt8M2UCTHgBiQ2kiAlfdLIidIT9LqY8822lsEe4j2Kc";
    }
    if (!accountNumber || accountNumber.includes("77702")) {
      accountNumber = "11090906078331";
    }

    // ── ACTION: Check Transaction Status ─────────────────────────────────────────
    if (body.action === "check_status") {
      const { reference } = body;
      if (!reference) {
        return new Response(JSON.stringify({ error: "Reference is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Check if already marked approved in DB
      const { data: existing } = await supabaseAdmin
        .from("manual_payments")
        .select("id, user_id, package_id, status, amount")
        .eq("reference_code", reference)
        .maybeSingle();

      if (existing?.status === "approved") {
        return new Response(JSON.stringify({ approved: true, reference }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Query Moolre official status API
      console.log(`Checking Moolre transaction status for ref=${reference}`);
      const statusRes = await fetch(`${MOOLRE_API_BASE}/open/transact/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-USER": apiUser,
          "X-API-PUBKEY": pubKey,
        },
        body: JSON.stringify({
          type: 1,
          idtype: 1,
          id: reference,
          accountnumber: accountNumber,
        }),
      });

      const statusData = await statusRes.json();
      console.log("Moolre status check response:", JSON.stringify(statusData));

      // Moolre returns code: "SS01" or data.txstatus: 1 for successful payment
      const isSuccessful =
        statusData?.code === "SS01" ||
        statusData?.data?.txstatus === 1 ||
        statusData?.data?.txstatus === "1" ||
        (typeof statusData?.data?.status === "string" && statusData.data.status.toLowerCase() === "successful");

      if (isSuccessful) {
        const targetUserId = existing?.user_id || user.id;
        const targetPackageId = existing?.package_id || reference.split("_")[1] || "vip_1";

        // Approve payment
        if (existing) {
          await supabaseAdmin
            .from("manual_payments")
            .update({
              status: "approved",
              transaction_id: statusData?.data?.transaction_id || statusData?.data?.transid || "moolre_verified",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        }

        // Grant ticket
        const ticketId = `ticket_moolre_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await supabaseAdmin.from("user_tickets").insert({
          id: ticketId,
          user_id: targetUserId,
          package_id: targetPackageId,
          payment_ref: reference,
        });

        // Activate subscription if package starts with sub_
        if (targetPackageId.startsWith("sub_")) {
          const subType = targetPackageId.replace("sub_", "");
          const exp = new Date();
          exp.setDate(exp.getDate() + 30);
          await supabaseAdmin.from("subscriptions").insert({
            user_id: targetUserId,
            subscription_type: subType,
            status: "active",
            amount_paid: Number(existing?.amount || 0),
            payment_ref: reference,
            expires_at: exp.toISOString(),
          });
        }

        return new Response(JSON.stringify({ approved: true, reference }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ approved: false, statusData }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: Trigger Payment Prompt ──────────────────────────────────────────
    const {
      packageId,
      amount,
      payerPhone,
      networkChannel,
      otpCode,
      reference,
    } = body;

    if (!packageId || !amount || !payerPhone) {
      return new Response(JSON.stringify({ error: "Missing required fields (packageId, amount, payerPhone)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pubKey || !apiUser) {
      return new Response(JSON.stringify({ error: "Moolre credentials are not configured in admin settings" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build unique tracking reference
    const cleanUserId = user.id.replace(/-/g, "");
    const txReference = reference || `moolre_${packageId}_${cleanUserId}_${Date.now()}`;

    // Clean phone number
    let cleanPhone = payerPhone.replace(/\s+/g, "").replace(/-/g, "");
    if (cleanPhone.startsWith("+233")) cleanPhone = "0" + cleanPhone.slice(4);
    if (cleanPhone.startsWith("233")) cleanPhone = "0" + cleanPhone.slice(3);

    // Map network channel (MTN: 13, Telecel: 6, AT: 7)
    const channelId = networkChannel || 13;

    console.log(`Moolre collection: user=${user.id}, phone=${cleanPhone}, amount=${amount}, ref=${txReference}, otp=${otpCode ? "provided" : "none"}`);

    // ── Test Mode ──────────────────────────────────────────────────────────────
    if (testMode) {
      await supabaseAdmin.from("manual_payments").insert({
        user_id: user.id,
        package_id: packageId,
        amount: Number(amount),
        sender_name: user.user_metadata?.full_name || "Moolre Test User",
        sender_phone: cleanPhone,
        reference_code: txReference,
        transaction_id: "test_" + Date.now(),
        network: `🇬🇭 Moolre Sandbox (Channel ${channelId})`,
        proof_url: null,
        status: "pending",
      });

      return new Response(
        JSON.stringify({
          success: true,
          testMode: true,
          reference: txReference,
          message: "Test mode: USSD prompt simulated. Auto-approval can be triggered.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Moolre API headers ─────────────────────────────────────────────────────
    const moolreHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-USER": apiUser,
      "X-API-PUBKEY": pubKey,
    };

    // ── Helper: call Moolre payment endpoint ────────────────────────────────────
    async function callMoolre(payload: Record<string, unknown>): Promise<any> {
      console.log("Calling Moolre /open/transact/payment with:", JSON.stringify(payload));
      const res = await fetch(`${MOOLRE_API_BASE}/open/transact/payment`, {
        method: "POST",
        headers: moolreHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("Moolre response:", JSON.stringify(data));
      return data;
    }

    // ── Build request body ──────────────────────────────────────────────────────
    const baseRequestBody: Record<string, unknown> = {
      type: 1,
      channel: Number(channelId),
      currency: "GHS",
      payer: cleanPhone,
      amount: String(amount),
      externalref: txReference,
      accountnumber: accountNumber,
      reference: `A1-TipsDeck VIP (${packageId})`,
    };

    // If OTP was provided, include it
    const requestBody = { ...baseRequestBody };
    if (otpCode) {
      requestBody.otpcode = String(otpCode).trim();
    }

    // ── Call Moolre ─────────────────────────────────────────────────────────────
    let moolreData = await callMoolre(requestBody);

    // ── Handle TP17: Phone Verified → make follow-up call WITHOUT OTP ──────────
    if (moolreData?.code === OTP_VERIFIED_CODE || moolreData?.code === "TP17") {
      console.log("TP17 received — phone verified. Making follow-up call to trigger USSD prompt...");

      await new Promise((resolve) => setTimeout(resolve, 500));

      const followUpBody = { ...baseRequestBody };
      moolreData = await callMoolre(followUpBody);

      console.log("Follow-up Moolre response:", JSON.stringify(moolreData));
    }

    // ── OTP Required (TP14) ───────────────────────────────────────────────────
    if (
      moolreData.code === OTP_REQUIRED_CODE ||
      moolreData.code === 14 ||
      moolreData.code === "14"
    ) {
      return new Response(
        JSON.stringify({
          otpRequired: true,
          reference: txReference,
          message: moolreData.message || "A verification code has been sent via SMS. Please enter it below to authorize the payment prompt.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Moolre success check ───────────────────────────────────────────────────
    const moolreOk =
      moolreData.status === 1 || moolreData.status === "1" ||
      SUCCESS_CODES.includes(moolreData.code);

    if (!moolreOk) {
      console.error("Moolre API error response:", JSON.stringify(moolreData));
      const errMsg = moolreData.message
        ? `Moolre [${moolreData.code || 'ERR'}]: ${moolreData.message}`
        : "Could not trigger USSD prompt. Please check your phone number and try again.";
      return new Response(
        JSON.stringify({
          error: errMsg,
          details: moolreData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Record pending payment ─────────────────────────────────────────────────
    const { data: existingPayment } = await supabaseAdmin
      .from("manual_payments")
      .select("id")
      .eq("reference_code", txReference)
      .maybeSingle();

    if (!existingPayment) {
      await supabaseAdmin.from("manual_payments").insert({
        user_id: user.id,
        package_id: packageId,
        amount: Number(amount),
        sender_name: user.user_metadata?.full_name || "MoMo Customer",
        sender_phone: cleanPhone,
        reference_code: txReference,
        transaction_id: typeof moolreData?.data === "string" ? moolreData.data : (moolreData?.data?.transaction_id || null),
        network: `🇬🇭 Moolre MoMo (${channelId === 13 ? "MTN" : channelId === 6 ? "Telecel" : "AT"})`,
        proof_url: null,
        status: "pending",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        reference: txReference,
        moolreData,
        message: "USSD payment prompt sent to your phone! Please enter your MoMo PIN to authorize.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("moolre-payment error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
