import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Mail, Send } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — A1-TIPSDECK" },
      {
        name: "description",
        content: "Get in touch with the A1-TIPSDECK team. We're here to help with VIP packages, billing, and sports analytics questions.",
      },
    ],
  }),
  component: ContactPage,
});

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

function ContactPage() {
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject.trim(),
          message: form.message.trim(),
        },
      });

      if (error) throw new Error(error.message || "Failed to send message.");

      toast.success("Message sent! We'll get back to you shortly.", {
        description: "Check your inbox for a confirmation.",
        duration: 5000,
      });
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err: any) {
      toast.error("Couldn't send your message", {
        description: err.message || "Please try again or contact us directly via email.",
      });
    } finally {
      setLoading(false);
    }
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
                    <a href="mailto:support@a1-tipsdeck.com" className="text-slate-500 dark:text-slate-400 hover:text-green-500 text-sm transition-colors">
                      support@a1-tipsdeck.com
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
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-bold text-slate-700 dark:text-slate-300">Your Name</label>
                  <input
                    id="name"
                    name="name"
                    required
                    type="text"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                  <input
                    id="email"
                    name="email"
                    required
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-bold text-slate-700 dark:text-slate-300">Subject</label>
                <input
                  id="subject"
                  name="subject"
                  required
                  type="text"
                  placeholder="How can we help?"
                  value={form.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-bold text-slate-700 dark:text-slate-300">Message</label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Type your message here..."
                  value={form.message}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all resize-none"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-green-500 hover:bg-green-600 text-white font-extrabold transition-all shadow-lg shadow-green-500/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  "Send Message"
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
