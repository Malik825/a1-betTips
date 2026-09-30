import { createServerFn } from "@tanstack/react-start";

export interface ContactEmailPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const sendContactEmail = createServerFn({ method: "POST" })
  .validator((data: ContactEmailPayload) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    const recipient = process.env.CONTACT_NOTIFICATION_EMAIL || "aone1group00@gmail.com";
    const from = process.env.RESEND_FROM_EMAIL || "A1-TipsDeck <onboarding@resend.dev>";

    if (!apiKey) {
      console.warn("[Resend] RESEND_API_KEY is not configured yet in .env. Message logged locally.");
      return {
        success: true,
        simulated: true,
        message: "Message received. (Configure RESEND_API_KEY in .env to send real emails)",
      };
    }

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #22c55e; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 800;">A1-TIPSDECK</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">New inquiry received from website contact form</p>
        </div>

        <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px; border: 1px solid #f1f5f9;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #334155;"><strong>Sender:</strong> ${data.name}</p>
          <p style="margin: 0 0 8px; font-size: 14px; color: #334155;"><strong>Email:</strong> <a href="mailto:${data.email}" style="color: #16a34a; text-decoration: underline;">${data.email}</a></p>
          <p style="margin: 0; font-size: 14px; color: #334155;"><strong>Subject:</strong> ${data.subject}</p>
        </div>

        <div style="margin-bottom: 24px;">
          <p style="font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">Message:</p>
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">
${data.message}
          </div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
          Sent to <strong>${recipient}</strong> via A1-TipsDeck Contact Form &bull; Reply directly to this email to respond to ${data.name}.
        </div>
      </div>
    `;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [recipient],
          reply_to: data.email,
          subject: `[Contact Inquiry] ${data.subject} — ${data.name}`,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Resend Error]", errorData);
        throw new Error(errorData?.message || `Failed to dispatch email (HTTP ${response.status})`);
      }

      const resData = await response.json();
      return { success: true, id: resData.id };
    } catch (err: any) {
      console.error("[Resend Dispatch Error]", err);
      throw new Error(err.message || "Unable to send message via Resend.");
    }
  });
