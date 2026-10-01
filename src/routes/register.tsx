import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, CheckCircle2, Mail } from "lucide-react";
import { AuthShell, AuthField } from "@/components/auth-shell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your account — A1-TIPSDECK" },
      {
        name: "description",
        content:
          "Sign up for A1-TIPSDECK and get daily expert sports analytics and VIP packages.",
      },
      { property: "og:title", content: "Create your account — A1-TIPSDECK" },
      {
        property: "og:description",
        content: "Join A1-TIPSDECK for daily expert sports analytics and VIP packages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

const schema = z
  .object({
    name: z.string().trim().min(2, { message: "Enter your full name" }).max(100),
    email: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(72),
    confirm: z.string(),
    terms: z.literal("on", { errorMap: () => ({ message: "You must accept the terms" }) }),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

function RegisterPage() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      confirm: String(form.get("confirm") ?? ""),
      terms: String(form.get("terms") ?? ""),
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
      .signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { data: { name: parsed.data.name } },
      })
      .then(({ data, error }) => {
        if (error) throw error;
        if (data?.session) {
          toast.success("Account created successfully! Welcome to A1-TIPSDECK.");
          navigate({ to: "/welcome" });
        } else {
          setSuccess(true);
        }
      })
      .catch((err: any) => {
        setErrors({ form: err?.message || "Unable to create your account" });
        toast.error(err?.message || "Unable to create your account");
      })
      .finally(() => setLoading(false));
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-card px-4 py-3.5 text-base text-foreground outline-none placeholder:text-base placeholder:text-muted-foreground/60 transition-all focus:border-[#22c55e] focus:ring-2 focus:ring-[#22c55e]/20";

  if (success) {
    return (
      <AuthShell title="Check your email" subtitle="We've sent you a verification link to complete your registration." footer={<></>}>
        <div className="flex flex-col items-center justify-center space-y-6 py-6 text-center animate-in fade-in zoom-in duration-500">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#22c55e]/20">
            <Mail className="size-10 text-[#22c55e]" />
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-background">
              <CheckCircle2 className="size-6 text-[#22c55e]" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">You're almost there!</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Please click the link in the email we just sent you to verify your account. 
              Once verified, you can log in to access your dashboard.
            </p>
          </div>

          <Link
            to="/login"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-card border border-border px-5 py-3.5 text-base font-extrabold uppercase tracking-wide text-foreground transition-all hover:bg-muted"
          >
            Return to Log in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="Join A1-TIPSDECK and start winning with expert daily insights."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-[#22c55e] hover:underline">
            Log in
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
        <AuthField label="Full name" error={errors["name"]}>
          <input name="name" autoComplete="name" placeholder="John Mensah" className={inputClass} />
        </AuthField>

        <AuthField label="Email" error={errors["email"]}>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClass}
          />
        </AuthField>

        <AuthField label="Password" error={errors["password"]}>
          <div className="relative">
            <input
              name="password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </AuthField>

        <AuthField label="Confirm password" error={errors["confirm"]}>
          <input
            name="confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repeat your password"
            className={inputClass}
          />
        </AuthField>

        <div className="pt-1">
          <label className="flex items-start gap-2.5 text-sm font-medium text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" name="terms" className="mt-0.5 size-4.5 accent-[#22c55e] rounded shrink-0" />
            <span>I agree to the Terms of Service and confirm I am 18 years or older.</span>
          </label>
          {errors["terms"] ? (
            <p className="mt-1.5 text-xs font-semibold text-destructive">{errors["terms"]}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#22c55e] px-5 py-3.5 text-base font-extrabold uppercase tracking-wide text-black transition-all hover:bg-[#16a34a] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 cursor-pointer shadow-lg shadow-[#22c55e]/20"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : null}
          Create account
        </button>
      </form>
    </AuthShell>
  );
}


