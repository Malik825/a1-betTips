import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── Load .env manually (no dotenv dependency needed) ─────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');

const envVars = {};
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    envVars[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim();
  }
} catch {
  console.warn('Could not read .env file — falling back to process.env');
}

const SUPABASE_URL = envVars['VITE_SUPABASE_URL'] || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY'] || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
  console.log('Clearing all tickets from user_tickets...');

  const { error: err } = await supabase.from('user_tickets').delete().neq('id', '0');

  if (err) {
    console.error('Error clearing user_tickets:', err);
  } else {
    console.log('Successfully cleared all tickets.');
  }
}
run();
