import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSettings() {
  console.log("Checking daily_settings...");
  const { data: rawData, error: rawError } = await supabase.from("daily_settings").select("*");
  console.log("Raw table:", rawData, rawError);

  console.log("Checking secure_daily_settings...");
  const { data: secureData, error: secureError } = await supabase.from("secure_daily_settings").select("*");
  console.log("Secure view (anon):", secureData, secureError);
}

checkSettings();
