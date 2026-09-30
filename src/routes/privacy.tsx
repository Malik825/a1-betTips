import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors">
      <SiteHeader />
      <main className="flex-1 w-[95%] max-w-4xl mx-auto py-16 px-4">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-8">Privacy Policy</h1>
        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <p><strong>Effective Date:</strong> January 1, 2024</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">1. Information We Collect</h2>
          <p>We collect information you provide directly to us when you create an account, subscribe to our services, or contact us for support. This may include your name, email address, and payment information (processed securely by third-party providers).</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">2. How We Use Your Information</h2>
          <p>We use the information we collect to provide, maintain, and improve our services, process transactions, send you technical notices and support messages, and communicate with you about products, services, and offers.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">3. Information Sharing</h2>
          <p>We do not sell your personal information. We may share information with third-party vendors, consultants, and other service providers who need access to such information to carry out work on our behalf (such as payment processing via Paystack).</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">4. Data Security</h2>
          <p>We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access, disclosure, alteration, and destruction.</p>

          <h2 className="text-2xl font-bold mt-8 mb-4">5. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at <strong>support@a1-tipsdeck.com</strong>.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
