require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('fixtures').select('*').limit(5).order('created_at', { ascending: false });
  console.log(JSON.stringify(data, null, 2));
  console.log(error);
}
test();
