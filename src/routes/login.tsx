import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthShell, AuthField } from "@/components/auth-shell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — A1 GROUP INSIGHTS" },
      {
        name: "description",
        content: "Log in to your A1 GROUP INSIGHTS account to access daily VIP sports analytics.",
      },
      { property: "og:title", content: "Log in — A1 GROUP INSIGHTS" },
      {
        property: "og:description",
        content: "Access your A1 GROUP INSIGHTS dashboard and today's expert football tips.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(72),
});

function LoginPage() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setLoading(true);
    void supabase.auth
      .signInWithPassword({ email: parsed.data.email, password: parsed.data.password })
      .then(({ data, error }) => {
        if (error) throw error;
        toast.success("Welcome back!");
        if (data.user?.app_metadata?.role === "admin") {
          navigate({ to: "/admin" });
        } else {
          navigate({ to: "/predictions" });
        }
      })
      .catch((err: any) => {
        const msg = err?.message === "Email not confirmed"
          ? "Please verify your email address before logging in."
          : "Invalid email or password";
        toast.error(msg);
        setErrors({ form: msg });
      })
      .finally(() => setLoading(false));
  }

  return (
    <AuthShell
      title="Log in"
      subtitle="Enter your details to access your tips dashboard."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-[#22c55e] hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {errors.form && (
          <div className="rounded-md bg-red-500/10 p-3 text-sm font-medium text-red-500">
            {errors.form}
          </div>
        )}
        <AuthField label="Email" error={errors["email"]}>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#22c55e]"
          />
        </AuthField>

        <AuthField label="Password" error={errors["password"]}>
          <div className="relative">
            <input
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-[#22c55e]"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </AuthField>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="remember" className="size-4 accent-[#22c55e]" />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="text-sm font-semibold text-[#22c55e] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#22c55e] px-4 py-3 text-sm font-bold uppercase tracking-wide text-black transition-transform hover:-translate-y-0.5 disabled:opacity-70"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          Log in
        </button>
      </form>
    </AuthShell>
  );
}

