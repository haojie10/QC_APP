/**
 * Netlify Scheduled Function: 每日自动清理过期数据 (方案 A)
 * 自动删除超过 7 天的订单相关的照片和验货报告文件
 */
import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

function getEnv(key: string): string {
  const val = Netlify.env.get(key);
  if (!val) throw new Error(`缺少环境变量: ${key}`);
  return val;
}

export default async (req: Request) => {
  try {
    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_KEY"),
    );

    // 计算 7 天前的时间点
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const expireThreshold = sevenDaysAgo.toISOString();

    console.log(`[Cron] 开始清理 ${expireThreshold} 之前的数据...`);

    // 1. 获取超过 7 天的 orders
    const { data: oldOrders, error: ordersErr } = await supabase
      .from('orders')
      .select('id')
      .lt('created_at', expireThreshold);

    if (ordersErr) throw ordersErr;

    if (!oldOrders?.length) {
      console.log('[Cron] 没有超过7天的订单，无需清理。');
      return new Response("OK");
    }

    const orderIds = oldOrders.map(o => o.id);

    // 2. 获取这些 order 对应的 order_items
    const { data: oldItems, error: itemsErr } = await supabase
      .from('order_items')
      .select('id')
      .in('order_id', orderIds);

    if (itemsErr) throw itemsErr;

    const itemIds = (oldItems || []).map(i => i.id);

    if (itemIds.length > 0) {
      // 3. 删除照片文件
      const { data: photos, error: photosErr } = await supabase
        .from('photos')
        .select('image_path')
        .in('item_id', itemIds);
      
      if (!photosErr && photos?.length) {
        const photoPaths = photos.map(p => p.image_path).filter(Boolean);
        if (photoPaths.length > 0) {
          const { error: removePhotosErr } = await supabase.storage.from('qc-photos').remove(photoPaths);
          if (removePhotosErr) {
            console.error('[Cron] 删除照片存储失败:', removePhotosErr);
          } else {
            console.log(`[Cron] 成功删除 ${photoPaths.length} 张照片`);
          }
        }
      }

      // 4. 删除数据库中的照片记录
      const { error: delPhotosErr } = await supabase
        .from('photos')
        .delete()
        .in('item_id', itemIds);
      if (delPhotosErr) {
        console.error('[Cron] 删除照片记录失败:', delPhotosErr);
      }

      // 5. 删除验货报告文件
      const reportPaths = itemIds.map(id => `report_${id}.pdf`);
      // Storage remove() max list length might apply, but deleting directly is fine for this scale
      const { error: removeReportsErr } = await supabase.storage.from('qc-reports').remove(reportPaths);
      if (removeReportsErr) {
        console.error('[Cron] 删除验货报告存储失败:', removeReportsErr);
      } else {
        console.log(`[Cron] 尝试删除了过期的验货报告文件`);
      }

      // 6. 物理删除订单（由于数据库设置了 CASCADE，会自动删除关联的 order_items 和 photos 记录）
      const { error: delOrdersErr } = await supabase
        .from('orders')
        .delete()
        .in('id', orderIds);
      
      if (delOrdersErr) {
        console.error('[Cron] 删除过期订单失败:', delOrdersErr);
      } else {
        console.log(`[Cron] 已成功物理删除 ${orderIds.length} 个过期订单及其关联数据`);
      }
    }

    // 6. 清理已经超时的废弃临时账号 (超过 7 天的 users, is_admin=false)
    const { error: delUsersErr } = await supabase
       .from('users')
       .delete()
       .eq('is_admin', false)
       .lt('created_at', expireThreshold);
    
    if (delUsersErr) {
      console.error('[Cron] 删除过期临时账号失败:', delUsersErr);
    } else {
      console.log('[Cron] 已清理过期的临时账号');
    }

    console.log('[Cron] 清理任务完成。');
    return new Response("Cleanup completed");
  } catch (err) {
    console.error('[Cron] 自动清理任务异常:', err);
    return new Response("Internal Server Error", { status: 500 });
  }
};

export const config: Config = {
  schedule: "@daily"
};
