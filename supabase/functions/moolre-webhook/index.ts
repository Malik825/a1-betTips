import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ============================================================
// Moolre Payment Webhook Handler
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-moolre-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    console.log("Moolre webhook payload:", JSON.stringify(payload));

    // ── Status check ──────────────────────────────────────────
    // Moolre sends status: 200 and message: "success" for completed payments.
    // We also check payload.data.status for "successful".
    const isSuccess =
      (payload.status === 200 || payload.status === "200") &&
      (
        payload.message?.toLowerCase()?.includes("success") ||
        payload.data?.status?.toLowerCase() === "successful"
      );

    if (!isSuccess) {
      console.log("Payment not successful, ignoring:", payload.status, payload.message);
      return new Response(JSON.stringify({ message: "Non-success event ignored" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Extract identifiers ───────────────────────────────────
    // We embed the user's internal ref in the "reference" field when initiating
    // the payment. Format: "moolre_{packageId}_{userId}_{timestamp}"
    const reference: string = payload.data?.reference || payload.reference || "";
    const transactionId: string = String(payload.data?.transaction_id || payload.data?.transid || "");
    const amountPaid: number = Number(payload.data?.amount || 0);
    const phoneNumber: string = payload.data?.phone || payload.data?.msisdn || "";

    if (!reference) {
      console.warn("No reference in Moolre webhook payload");
      return new Response(JSON.stringify({ message: "No reference" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse our embedded reference: moolre_{packageId}_{userId}_{timestamp}
    let packageId: string | null = null;
    let userId: string | null = null;

    if (reference.startsWith("moolre_")) {
      const parts = reference.split("_");
      // parts: ["moolre", ...pkgParts, userId(uuid-like), timestamp]
      // userId is a UUID — 5 dash-separated groups when split on "-", but we joined with "_"
      // So we encode as: moolre_{pkgId}_{userId36}_{ts}
      // pkgId can contain underscores (e.g. supreme_vvip), so we use the last two segments
      // as ts + userId, and everything in between as pkgId.
      if (parts.length >= 4) {
        // Last segment = timestamp, second-to-last = short userId hash
        userId = parts[parts.length - 2];
        packageId = parts.slice(1, parts.length - 2).join("_");
      }
    }

    if (!packageId || !userId) {
      console.warn("Could not parse packageId/userId from reference:", reference);
      return new Response(JSON.stringify({ message: "Unparseable reference" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ── Idempotency check ─────────────────────────────────────
    const { data: existingPayment } = await supabaseAdmin
      .from("manual_payments")
      .select("id, user_id, package_id, status, amount")
      .eq("reference_code", reference)
      .maybeSingle();

    if (existingPayment && existingPayment.status === "approved") {
      console.log("Already processed reference:", reference);
      return new Response(JSON.stringify({ message: "Already processed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalUserId = existingPayment?.user_id || userId;
    const finalPackageId = existingPayment?.package_id || packageId;

    if (existingPayment) {
      // Update existing pending payment created by moolre-payment
      await supabaseAdmin
        .from("manual_payments")
        .update({
          status: "approved",
          transaction_id: transactionId || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPayment.id);
    } else {
      // ── Record the payment ────────────────────────────────────
      const { error: paymentError } = await supabaseAdmin.from("manual_payments").insert({
        user_id: finalUserId,
        package_id: finalPackageId,
        amount: amountPaid,
        sender_name: "Moolre MoMo",
        sender_phone: phoneNumber || "N/A",
        reference_code: reference,
        transaction_id: transactionId,
        network: `🇬🇭 Moolre MoMo (GHS ${amountPaid})`,
        proof_url: null,
        status: "approved",  // Auto-approved — Moolre already confirmed payment
      });

      if (paymentError) {
        console.error("Failed to insert manual_payment:", paymentError);
      }
    }

    // ── Grant ticket ──────────────────────────────────────────
    const isSubscription = finalPackageId.startsWith("sub_");
    const ticketId = `ticket_moolre_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const { error: ticketError } = await supabaseAdmin.from("user_tickets").insert({
      id: ticketId,
      user_id: finalUserId,
      package_id: finalPackageId,
      payment_ref: reference,
    });

    if (ticketError) {
      console.error("Failed to insert user_ticket:", ticketError);
      return new Response(JSON.stringify({ error: ticketError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── If subscription — also activate the subscription row ──
    if (isSubscription) {
      const subscriptionType = packageId.replace("sub_", "");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error: subError } = await supabaseAdmin.from("subscriptions").insert({
        user_id: userId,
        subscription_type: subscriptionType,
        status: "active",
        amount_paid: amountPaid,
        payment_ref: reference,
        proof_url: null,
        expires_at: expiresAt.toISOString(),
      });

      if (subError) {
        console.warn("Could not create subscription row:", subError);
      }
    }

    console.log(`✅ Moolre webhook fulfilled: user=${userId}, package=${packageId}, ref=${reference}`);

    return new Response(JSON.stringify({ status: "success", ticketId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Moolre webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

