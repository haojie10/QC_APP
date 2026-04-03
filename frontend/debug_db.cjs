const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 手写解析 .env 以避免依赖
const envPath = 'd:/我的APP/QC APP/frontend/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.+)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = env['SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_KEY'];

console.log("URL:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("--- Users Table ---");
  const { data, error } = await supabase.from('users').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
  } else if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
    console.log("Sample Data:", data[0]);
  } else {
    console.log("Table empty or no access");
  }

  console.log("\n--- Orders Table ---");
  const { data: oData, error: oErr } = await supabase.from('orders').select('*').limit(1);
  if (oErr) console.error("Error:", oErr);
  else if (oData && oData.length > 0) console.log("Columns:", Object.keys(oData[0]));
}

run();
