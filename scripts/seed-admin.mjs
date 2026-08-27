/**
 * seed-admin.mjs
 * ──────────────
 * Creates the admin user in Supabase Auth and sets their role to "admin"
 * via app_metadata (requires the service_role key — never use anon key).
 *
 * Usage:
 *   1. Add your SUPABASE_SERVICE_ROLE_KEY to .env
 *   2. Run: node scripts/seed-admin.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ── Load .env manually (no dotenv dependency needed) ──────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env");

const envVars = {};
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    envVars[key] = value;
  }
} catch {
  console.error("Could not read .env file");
  process.exit(1);
}

const SUPABASE_URL = envVars["VITE_SUPABASE_URL"] || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY =
  envVars["SUPABASE_SERVICE_ROLE_KEY"] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("VITE_SUPABASE_URL is not set in .env");
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is not set in .env\n" +
      "Get it from: Supabase Dashboard → Settings → API → service_role (secret key)"
  );
  process.exit(1);
}

// ── Admin credentials to seed (set these in .env) ────────────────────────────
const ADMIN_EMAIL = envVars["ADMIN_EMAIL"] || process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = envVars["ADMIN_PASSWORD"] || process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL) {
  console.error("ADMIN_EMAIL is not set in .env");
  process.exit(1);
}
if (!ADMIN_PASSWORD) {
  console.error("ADMIN_PASSWORD is not set in .env");
  process.exit(1);
}

// ── Supabase Admin client (uses service_role key) ─────────────────────────────
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seedAdmin() {
  console.log("Seeding admin user...");
  console.log("  Email   :", ADMIN_EMAIL);
  console.log("  Role    : admin");
  console.log();

  // ── Step 1: Try to create the user ──────────────────────────────────────────
  const { data: createData, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // skip email verification
      app_metadata: {
        role: "admin",
      },
    });

  if (createError) {
    // If user already exists, look them up and update instead
    if (
      createError.message?.toLowerCase().includes("already") ||
      createError.message?.toLowerCase().includes("exists")
    ) {
      console.log("User already exists — updating role to admin...");

      const { data: listData, error: listError } =
        await supabaseAdmin.auth.admin.listUsers();

      if (listError) {
        console.error("Failed to list users:", listError.message);
        process.exit(1);
      }

      const existingUser = listData.users.find((u) => u.email === ADMIN_EMAIL);
      if (!existingUser) {
        console.error("Could not find existing user with that email.");
        process.exit(1);
      }

      const { data: updateData, error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          email_confirm: true,
          app_metadata: { role: "admin" },
          password: ADMIN_PASSWORD,
        });

      if (updateError) {
        console.error("Failed to update user:", updateError.message);
        process.exit(1);
      }

      console.log("Admin role set on existing user!");
      console.log("  User ID :", updateData.user.id);
      console.log("  Email   :", updateData.user.email);
      console.log("  Role    :", updateData.user.app_metadata?.role);
      return;
    }

    console.error("Failed to create user:", createError.message);
    process.exit(1);
  }

  console.log("Admin user created successfully!");
  console.log("  User ID  :", createData.user.id);
  console.log("  Email    :", createData.user.email);
  console.log("  Role     :", createData.user.app_metadata?.role);
  console.log("  Confirmed:", createData.user.email_confirmed_at ? "Yes" : "No");
}

seedAdmin().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
