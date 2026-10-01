import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell, AuthField } from "@/components/auth-shell";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — A1-TIPSDECK" },
      {
        name: "description",
        content: "Request a password reset link for your A1-TIPSDECK account.",
      },
      { property: "og:title", content: "Reset your password — A1-TIPSDECK" },
      {
        property: "og:description",
        content: "Request a password reset link for your A1-TIPSDECK account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
});

function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setError(undefined);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 700);
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We'll email you a secure link to set a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="font-semibold text-[#22c55e] hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-md border border-[#22c55e]/40 bg-[#22c55e]/10 p-5">
          <MailCheck className="size-6 text-[#22c55e]" />
          <p className="mt-3 font-semibold text-foreground">Check your inbox</p>
          <p className="mt-1 text-sm text-muted-foreground">
            If an account exists for that email, a reset link is on its way.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <AuthField label="Email" error={error}>
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-lg border border-border bg-card px-4 py-3.5 text-base text-foreground outline-none placeholder:text-base placeholder:text-muted-foreground/60 transition-all focus:border-[#22c55e] focus:ring-2 focus:ring-[#22c55e]/20"
            />
          </AuthField>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#22c55e] px-5 py-3.5 text-base font-extrabold uppercase tracking-wide text-black transition-all hover:bg-[#16a34a] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 cursor-pointer shadow-lg shadow-[#22c55e]/20"
          >
            {loading ? <Loader2 className="size-5 animate-spin" /> : null}
            Send reset link
          </button>
        </form>
      )}
    </AuthShell>
  );
}
