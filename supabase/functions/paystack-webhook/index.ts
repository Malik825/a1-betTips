import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

    // Verify Paystack HMAC-SHA512 Signature if secret key is configured
    if (secretKey && signature) {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secretKey);
      const msgData = encoder.encode(rawBody);

      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-512" },
        false,
        ["sign"]
      );

      const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
      const hashArray = Array.from(new Uint8Array(signatureBuffer));
      const expectedSignature = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      if (expectedSignature !== signature) {
        console.error("Invalid Paystack Webhook Signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data;

    console.log(`Received Paystack Webhook Event: ${event}`);

    if (event === "charge.success") {
      const reference = data.reference; // e.g. pkg_vip_1_1727800000000
      const customerEmail = data.customer?.email;

      // Extract packageId from reference format "pkg_{packageId}_{timestamp}"
      let packageId: string | null = null;
      if (reference && reference.startsWith("pkg_")) {
        const parts = reference.split("_");
        if (parts.length >= 3) {
          packageId = parts.slice(1, parts.length - 1).join("_");
        }
      }

      if (!packageId && data.metadata?.package_id) {
        packageId = data.metadata.package_id;
      }

      if (!packageId || !customerEmail) {
        console.warn("Missing packageId or customerEmail in webhook payload", { reference, customerEmail });
        return new Response(JSON.stringify({ message: "Payload missing required reference data" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!supabaseUrl || !serviceRoleKey) {
        console.error("Supabase service role credentials not set");
        return new Response(JSON.stringify({ error: "Server misconfigured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      // Find user ID by email
      const { data: usersData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
      if (userError) {
        console.error("Error listing users:", userError);
      }

      const targetUser = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === customerEmail.toLowerCase()
      );

      if (!targetUser) {
        console.warn(`User with email ${customerEmail} not found in Supabase Auth`);
        return new Response(JSON.stringify({ message: "User not found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if ticket already exists for this payment reference
      const { data: existingTicket } = await supabaseAdmin
        .from("user_tickets")
        .select("*")
        .eq("payment_ref", reference)
        .maybeSingle();

      if (existingTicket) {
        console.log(`Ticket already exists for payment_ref: ${reference}`);
        return new Response(JSON.stringify({ message: "Ticket already fulfilled" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fulfill ticket
      const { error: insertError } = await supabaseAdmin.from("user_tickets").insert({
        id: `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: targetUser.id,
        package_id: packageId,
        payment_ref: reference,
      });

      if (insertError) {
        console.error("Failed to insert user ticket via webhook:", insertError);
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Successfully fulfilled ticket for user ${targetUser.id}, package ${packageId}`);
    }

    return new Response(JSON.stringify({ status: "success" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
