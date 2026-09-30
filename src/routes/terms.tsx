import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors">
      <SiteHeader />
      <main className="flex-1 w-[95%] max-w-4xl mx-auto py-16 px-4">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-8">Terms of Service</h1>
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <p><strong>Effective Date:</strong> January 1, 2024</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">1. Introduction</h2>
          <p>Welcome to A1-TipsDeck. By accessing or using our website, you agree to comply with and be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use our website or services.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">2. Description of Service</h2>
          <p>A1-TipsDeck provides sports data, analytics, statistical modeling, and expert opinions. <strong>We do not operate a gambling platform, we do not accept wagers, and we do not guarantee financial returns.</strong> Our service is strictly for informational and entertainment purposes only.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">3. Eligibility</h2>
          <p>You must be at least 18 years old to use our services. By using our services, you represent and warrant that you are of legal age to form a binding contract with us.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">4. Subscriptions and Payments</h2>
          <p>Certain features of our service may require payment. All fees are clearly stated in Ghanaian Cedis (GHS) or other supported currencies. By providing a payment method, you expressly authorize us (and our third-party payment processors like Paystack) to charge the applicable fees.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">5. Intellectual Property</h2>
          <p>All content, including but not limited to data, text, graphics, and logos, is the property of A1-TipsDeck and is protected by copyright laws. You may not reproduce, distribute, or create derivative works without our express written consent.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">6. Limitation of Liability</h2>
          <p>Under no circumstances shall A1-TipsDeck, its directors, or employees be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use our services or data.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">7. Contact Information</h2>
          <p>If you have any questions about these Terms, please contact us at <strong>support@a1-tipsdeck.com</strong>.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
