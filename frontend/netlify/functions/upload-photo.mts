import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

function getEnv(key: string): string {
  const val = Netlify.env.get(key) || process.env[key];
  if (!val) throw new Error(`缺少环境变量: ${key}`);
  return val;
}

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = getEnv('SUPABASE_SERVICE_KEY');
const JWT_SECRET = getEnv('JWT_SECRET_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export default async (req: Request, context: Context) => {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  try {
    // 验证 Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: '未授权' }), { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    
    try {
      jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Token 无效或已过期' }), { status: 401 });
    }

    // 解析 formData
    // 我们期望收到: file (Blob/File), itemId (string), stepId (string), action (string)
    const formData = await req.formData();
    const action = formData.get('action') as string;
    const itemId = formData.get('itemId') as string;
    const stepId = formData.get('stepId') as string;

    if (!itemId || !stepId || !action) {
      return new Response(JSON.stringify({ error: '缺少必要参数' }), { status: 400 });
    }

    if (action === 'skip') {
      // 执行跳过操作
      const { error: skipErr } = await supabase
        .from('photos')
        .upsert(
          {
            item_id: itemId,
            step_id: stepId,
            image_path: null,
            status: 'skipped',
            created_at: new Date().toISOString(),
          },
          { onConflict: 'item_id,step_id' }
        );

      if (skipErr) throw new Error(skipErr.message);

      return new Response(JSON.stringify({ success: true, status: 'skipped' }), {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }

    if (action === 'upload') {
      const file = formData.get('file') as Blob;
      if (!file) {
        return new Response(JSON.stringify({ error: '未提供文件' }), { status: 400 });
      }

      // 上传文件到 Storage
      const storagePath = `${itemId}/${stepId}.jpg`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('qc-photos')
        .upload(storagePath, file, {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadErr || !uploadData) {
        console.error('Storage Upload Error:', uploadErr);
        throw new Error('Supabase 存储上传失败');
      }

      // 记录到数据库
      const { error: insertErr } = await supabase
        .from('photos')
        .upsert(
          {
            item_id: itemId,
            step_id: stepId,
            image_path: storagePath,
            status: 'uploaded',
            created_at: new Date().toISOString(),
          },
          { onConflict: 'item_id,step_id' }
        );

      if (insertErr) throw new Error(insertErr.message);

      // 顺便更新 item 的状态为 in_progress
      await supabase
        .from('order_items')
        .update({ status: 'in_progress' })
        .eq('id', itemId)
        .neq('status', 'completed');

      // 返回公开路径（供前端即时渲染或核对）
      const { data: urlData } = supabase.storage
        .from('qc-photos')
        .getPublicUrl(storagePath);

      return new Response(JSON.stringify({ 
        success: true, 
        status: 'uploaded', 
        publicUrl: urlData.publicUrl 
      }), {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({ error: '不支持的 action' }), { status: 400 });

  } catch (err: any) {
    console.error('Upload Photo Fn Error:', err);
    return new Response(JSON.stringify({ error: err.message || '内部服务器错误' }), {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    });
  }
};
