import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkSchema() {
  console.log("正在检查 Supabase 配置和表结构...");

  const tables = ['factory_accounts', 'orders', 'order_items', 'photos'];
  const results: any = {};

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        results[table] = { status: 'ERROR', message: error.message };
      } else {
        results[table] = {
          status: 'OK',
          columns: data && data.length > 0 ? Object.keys(data[0]) : 'Empty table, but accessible'
        };
      }
    } catch (e: any) {
      results[table] = { status: 'EXCEPTION', message: e.message };
    }
  }

  // 检查 Storage 桶
  console.log("\n正在检查 Storage 桶配置...");
  try {
    const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
    if (bucketErr) {
      results['storage'] = { status: 'ERROR', message: bucketErr.message };
    } else {
      results['storage'] = {
        status: 'OK',
        buckets: buckets.map((b) => ({ name: b.name, public: b.public }))
      };
    }
  } catch (e: any) {
    results['storage'] = { status: 'EXCEPTION', message: e.message };
  }

  console.log('\n===== 检查结果 =====');
  console.log(JSON.stringify(results, null, 2));
}

checkSchema();
