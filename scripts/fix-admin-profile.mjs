import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

const envVars = {};
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    envVars[key] = value;
  }
} catch {}

const SUPABASE_URL = envVars['VITE_SUPABASE_URL'];
const SERVICE_ROLE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const email = envVars['ADMIN_EMAIL'];
  const { data } = await supabaseAdmin.auth.admin.listUsers();
  const user = data.users.find(u => u.email === email);
  
  if (user) {
    const { error } = await supabaseAdmin.from('profiles').upsert({
      id: user.id,
      email: user.email,
      role: 'admin',
      name: 'Admin'
    });
    if (error) {
      console.log('Error updating profile:', error);
    } else {
      console.log('Profile updated to admin for', email);
    }
  }
}
run();
