import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Name, email, and message are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const recipient = Deno.env.get("CONTACT_NOTIFICATION_EMAIL") || "aone1group00@gmail.com";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "A1 Group Insights <onboarding@resend.dev>";

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY is not configured in Supabase secrets.");
      return new Response(
        JSON.stringify({
          success: true,
          simulated: true,
          message: "RESEND_API_KEY not configured. Message simulated.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #22c55e; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 20px;">A1 GROUP INSIGHTS</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">New inquiry received from website contact form</p>
        </div>

        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #334155;"><strong>Sender:</strong> ${name}</p>
          <p style="margin: 0 0 8px; font-size: 14px; color: #334155;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #16a34a; text-decoration: underline;">${email}</a></p>
          <p style="margin: 0; font-size: 14px; color: #334155;"><strong>Subject:</strong> ${subject || "General Inquiry"}</p>
        </div>

        <div style="margin-bottom: 24px;">
          <p style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">Message:</p>
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">
${message}
          </div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
          Sent to <strong>${recipient}</strong> via A1 Group Insights Contact Form &bull; Reply directly to this email to respond to ${name}.
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        reply_to: email,
        subject: `[Contact Inquiry] ${subject || "General Inquiry"} — ${name}`,
        html: htmlContent,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
