import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(envFile.split('\n').filter(line => line.includes('=')).map(line => line.split('=').map(s => s.trim())));

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

async function check() {
  const res = await fetch(`${supabaseUrl}/rest/v1/predictions?select=*,fixture:fixtures(*)&limit=1`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  const data = await res.json();
  console.log("JOIN RESULT:", JSON.stringify(data, null, 2));
}
check();
