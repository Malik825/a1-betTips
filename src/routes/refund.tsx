import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/refund")({
  component: RefundPage,
});

function RefundPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors">
      <SiteHeader />
      <main className="flex-1 w-[95%] max-w-4xl mx-auto py-16 px-4">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-8">Refund Policy</h1>
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <p><strong>Effective Date:</strong> January 1, 2024</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Digital Goods and Final Sales</h2>
          <p>A1-TipsDeck provides digital sports analytics, data, and expert insights. Due to the nature of our digital products and the immediate delivery of proprietary information upon purchase, <strong>all sales are final.</strong></p>
          <p>We do not offer refunds, returns, or exchanges for any digital goods or VIP packages once payment has been successfully processed and access has been granted.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Disputes and Payment Issues</h2>
          <p>If you believe there has been a billing error or an unauthorized transaction, please contact us immediately. We will investigate the issue and, at our sole discretion, determine if a refund or credit is appropriate in cases of technical faults (e.g., being charged twice for a single transaction).</p>
          <p>Filing a chargeback with your bank or payment provider (like Paystack) without contacting us first may result in immediate suspension or termination of your account.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">Contacting Us for Support</h2>
          <p>We want you to be satisfied with our service. If you are experiencing technical difficulties accessing your purchased insights, please reach out to our support team at <strong>support@a1-tipsdeck.com</strong> so we can assist you promptly.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
