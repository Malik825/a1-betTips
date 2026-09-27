import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Mail, MessageCircle, MapPin, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function ContactPage() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate sending email
    setTimeout(() => {
      setLoading(false);
      toast.success("Message sent! We'll get back to you shortly.");
      (e.target as HTMLFormElement).reset();
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans transition-colors">
      <SiteHeader />
      <main className="flex-1 w-[95%] max-w-5xl mx-auto py-16 px-4">
        
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
            Get in <span className="text-green-500">Touch</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg">
            Have questions about our VIP packages, sports analytics, or billing? Our support team is here to help you win.
          </p>
        </div>

        <div className="grid md:grid-cols-[1fr_1.5fr] gap-12">
          {/* Contact Information */}
          <div className="space-y-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Contact Information</h3>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">Email Support</p>
                    <a href="mailto:support@a1-groupinsights.com" className="text-slate-500 dark:text-slate-400 hover:text-green-500 text-sm transition-colors">
                      support@a1-groupinsights.com
                    </a>
                  </div>
                </div>


                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <Send className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">Telegram</p>
                    <a target="_blank" rel="noopener noreferrer" href="https://t.me/+S6zQhRKDOV02YjJk" className="text-slate-500 dark:text-slate-400 hover:text-green-500 text-sm transition-colors">
                      Follow our Channel
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-bold text-slate-700 dark:text-slate-300">Your Name</label>
                  <input
                    id="name"
                    required
                    type="text"
                    placeholder="John Doe"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                  <input
                    id="email"
                    required
                    type="email"
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-bold text-slate-700 dark:text-slate-300">Subject</label>
                <input
                  id="subject"
                  required
                  type="text"
                  placeholder="How can we help?"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-bold text-slate-700 dark:text-slate-300">Message</label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  placeholder="Type your message here..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all resize-none"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-green-500 hover:bg-green-600 text-white font-extrabold transition-all shadow-lg shadow-green-500/25 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
