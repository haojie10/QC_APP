/**
 * Supabase 客户端 + 直接查询函数
 * 前端使用 anon key 直连 Supabase
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =================== Storage ===================

/**
 * 上传图片到 Supabase Storage
 * @param bucket 存储桶名
 * @param path 文件路径
 * @param file 文件内容
 */
export async function uploadImage(
  bucket: string,
  path: string,
  file: Blob,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: '3600',
    });

  if (error || !data) {
    console.error('Upload Error:', error);
    throw new Error(`图片上传失败: ${error?.message || '未知错误'}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  if (!urlData || !urlData.publicUrl) {
    throw new Error('获取图片公开地址失败');
  }

  return urlData.publicUrl;
}

// =================== 订单查询 ===================

export interface OrderRow {
  id: string;
  order_number: string;
  factory_name: string;
  inspection_date: string;
  status: string;
  created_at: string;
}

/**
 * 查询当前工厂的所有订单（含货号统计）
 */
export async function getOrders(factoryName: string) {
  let query = supabase
    .from('orders')
    .select('*, order_items(id, status)')
    .order('created_at', { ascending: false });

  // 管理员传空字符串查看全部，工厂用户只查自己的
  if (factoryName) {
    query = query.eq('factory_name', factoryName);
  }

  const { data, error } = await query;
  if (error) throw new Error(`查询订单失败: ${error.message}`);

  return (data || []).map((order: any) => {
    const items = order.order_items || [];
    const itemCount = items.length;
    const completedCount = items.filter((i: any) => i.status === 'completed').length;
    const inProgressCount = items.filter((i: any) => i.status === 'in_progress').length;

    let computedStatus = 'pending';
    if (itemCount > 0) {
      if (completedCount === itemCount) {
        computedStatus = 'completed';
      } else if (completedCount > 0 || inProgressCount > 0) {
        computedStatus = 'in_progress';
      }
    }

    return {
      id: order.id,
      order_number: order.order_number,
      factory_name: order.factory_name,
      inspection_date: order.inspection_date,
      status: computedStatus,
      created_at: order.created_at,
      item_count: itemCount,
      completed_items: completedCount,
    };
  });
}

// =================== 货号查询 ===================

export interface OrderItemRow {
  id: string;
  order_id: string;
  model_name: string;
  status: string;
  sort_order: number;
}

/**
 * 查询订单的所有货号（含步骤进度）
 */
export async function getOrderItems(orderId: string) {
  const { data, error } = await supabase
    .from('order_items')
    .select('*, photos(id, status)')
    .eq('order_id', orderId)
    .order('sort_order');

  if (error) throw new Error(`查询货号失败: ${error.message}`);

  const totalSteps = 18;
  return (data || []).map((item: OrderItemRow & { photos: Array<{ id: string; status: string }> }) => ({
    id: item.id,
    order_id: item.order_id,
    model_name: item.model_name,
    status: item.status,
    sort_order: item.sort_order,
    completed_steps: item.photos?.filter(
      (p: { status: string }) => p.status === 'uploaded' || p.status === 'skipped',
    ).length || 0,
    total_steps: totalSteps,
  }));
}

// =================== 步骤进度 ===================

const ALL_STEP_IDS = [
  '1.1', '1.2', '1.3',
  '2.1', '2.2', '2.3', '2.4',
  '3.1', '3.2',
  '4.1', '4.2', '4.3', '4.4',
  '5.1', '5.2', '5.3', '5.4',
];

/**
 * 查询货号的步骤进度
 * 如果数据库中没有记录，自动补全为 pending
 */
export async function getItemProgress(itemId: string) {
  const { data, error } = await supabase
    .from('photos')
    .select('step_id, status, image_path')
    .eq('item_id', itemId);

  if (error) throw new Error(`查询进度失败: ${error.message}`);

  const photoMap = new Map(
    (data || []).map((p: { step_id: string; status: string; image_path: string | null }) => [p.step_id, p]),
  );

  return ALL_STEP_IDS.map((stepId) => {
    const photo = photoMap.get(stepId) as { step_id: string; status: string; image_path: string | null } | undefined;
    if (photo) {
      let imageUrl: string | null = null;
      if (photo.image_path) {
        const { data: urlData } = supabase.storage
          .from('qc-photos')
          .getPublicUrl(photo.image_path);
        imageUrl = urlData.publicUrl;
      }
      return {
        step_id: stepId,
        status: photo.status,
        image_url: imageUrl,
      };
    }
    return { step_id: stepId, status: 'pending', image_url: null };
  });
}

// =================== 拍照记录 ===================

/**
 * 记录拍照（upsert: 如果已存在则更新）
 */
export async function recordPhoto(
  itemId: string,
  stepId: string,
  imagePath: string,
) {
  const { error } = await supabase
    .from('photos')
    .upsert(
      {
        item_id: itemId,
        step_id: stepId,
        image_path: imagePath,
        status: 'uploaded',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'item_id,step_id' },
    );

  if (error) throw new Error(`记录照片失败: ${error.message}`);

  // 更新货号状态为 in_progress
  await supabase
    .from('order_items')
    .update({ status: 'in_progress' })
    .eq('id', itemId)
    .neq('status', 'completed');
}

/**
 * 跳过步骤
 */
export async function skipStep(itemId: string, stepId: string) {
  const { error } = await supabase
    .from('photos')
    .upsert(
      {
        item_id: itemId,
        step_id: stepId,
        image_path: null,
        status: 'skipped',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'item_id,step_id' },
    );

  if (error) throw new Error(`跳过步骤失败: ${error.message}`);
}

// =================== 报告管理 ===================

/**
 * 搜索报告（管理员用）
 */
export async function searchReports(query: string = '') {
  let queryBuilder = supabase
    .from('order_items')
    .select('id, model_name, status, order_id, orders(order_number, factory_name, inspection_date, created_at)')
    .order('sort_order');

  if (query) {
    // 模糊搜索：通过订单号或工厂名
    queryBuilder = queryBuilder.or(
      `model_name.ilike.%${query}%,orders.order_number.ilike.%${query}%`,
    );
  }

  const { data, error } = await queryBuilder;
  if (error) throw new Error(`搜索报告失败: ${error.message}`);

  // NOTE: Supabase 联表查询 select('orders(...)') 返回值可能是对象或数组
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((item: any) => {
    // 处理联表返回可能是数组的情况
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return {
      item_id: item.id,
      model_name: item.model_name,
      status: item.status,
      order_id: item.order_id,
      order_number: order?.order_number || '',
      factory_name: order?.factory_name || '',
      inspection_date: order?.inspection_date || '',
      created_at: order?.created_at || '',
      pdf_url: null as string | null,
    };
  });
}

/**
 * 删除验货记录（管理员用）- 级联删除照片
 */
export async function deleteInspection(itemId: string) {
  // 删除 Storage 中的照片
  const { data: photos } = await supabase
    .from('photos')
    .select('image_path')
    .eq('item_id', itemId);

  if (photos?.length) {
    const paths = photos
      .filter((p: { image_path: string | null }) => p.image_path)
      .map((p: { image_path: string }) => p.image_path);
    if (paths.length) {
      await supabase.storage.from('qc-photos').remove(paths);
    }
  }

  // 删除照片记录
  await supabase.from('photos').delete().eq('item_id', itemId);

  // 重置货号状态
  await supabase
    .from('order_items')
    .update({ status: 'pending' })
    .eq('id', itemId);
}

// =================== 账号管理 ===================

/**
 * 获取所有临时账号（管理员用）
 */
export async function getAccounts() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_admin', false)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`获取账号列表失败: ${error.message}`);
  
  return data || [];
}
