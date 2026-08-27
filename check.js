import fs from 'fs';
const envFile = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(envFile.split('\n').filter(line => line.includes('=')).map(line => line.split('=').map(s => s.trim())));

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

async function check() {
  const res = await fetch(`${supabaseUrl}/rest/v1/fixtures?id=eq.sb_sr:match:72336428`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  const data = await res.json();
  console.log("FIXTURE:", data);

  const res2 = await fetch(`${supabaseUrl}/rest/v1/predictions?fixture_id=eq.sb_sr:match:72336428`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  const data2 = await res2.json();
  console.log("PREDICTION:", data2);
}
check();
