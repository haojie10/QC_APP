/**
 * Netlify Function: 管理员创建临时验货账号
 * 生成随机密码 + 创建用户/订单/货号记录
 */
import type { Context, Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getEnv(key: string): string {
  const val = Netlify.env.get(key);
  if (!val) throw new Error(`缺少环境变量: ${key}`);
  return val;
}

/** 生成随机密码：大写字母+数字，排除易混淆字符 */
function generatePassword(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** 校验 JWT 并检查管理员权限 */
function verifyAdmin(req: Request): { sub: string; factory_name: string } {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("未提供有效 Token");
  }
  const token = authHeader.slice(7);
  const payload = jwt.verify(token, getEnv("JWT_SECRET_KEY")) as {
    sub: string;
    factory_name: string;
    is_admin: boolean;
  };
  if (!payload.is_admin) {
    throw new Error("需要管理员权限");
  }
  return payload;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ detail: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    verifyAdmin(req);

    const { factory_name, order_number, model_names, inspection_date } =
      await req.json();

    if (!factory_name || !order_number || !model_names?.length || !inspection_date) {
      return new Response(
        JSON.stringify({ detail: "请填写完整信息" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_KEY"),
    );

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // 查找或创建用户
    const { data: existing } = await supabase
      .from("users")
      .select("id, plain_password")
      .eq("factory_name", factory_name)
      .limit(1);

    let userId: string;
    let returnPassword: string;
    let passwordChanged: boolean;

    if (existing?.length) {
      // NOTE: 工厂已存在 → 保留原密码不变，只延长有效期
      userId = existing[0].id;
      returnPassword = existing[0].plain_password || '(原密码不可见)';
      passwordChanged = false;

      await supabase
        .from("users")
        .update({
          expires_at: expiresAt.toISOString(),
        })
        .eq("id", userId);
    } else {
      // 新用户 → 生成新密码
      const rawPassword = generatePassword();
      const passwordHash = bcrypt.hashSync(rawPassword, 10);
      returnPassword = rawPassword;
      passwordChanged = true;

      const { data: newUser, error } = await supabase
        .from("users")
        .insert({
          factory_name,
          password_hash: passwordHash,
          plain_password: rawPassword,
          is_admin: false,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select("id")
        .single();
      if (error || !newUser) throw new Error("创建用户失败");
      userId = newUser.id;
    }

    // 创建订单
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number,
        factory_name,
        inspection_date,
        status: "pending",
        created_at: now.toISOString(),
      })
      .select("id")
      .single();
    if (orderErr || !order) throw new Error("创建订单失败");

    // 批量创建货号
    const items = model_names.map((name: string, idx: number) => ({
      order_id: order.id,
      model_name: name,
      status: "pending",
      sort_order: idx + 1,
    }));
    await supabase.from("order_items").insert(items);

    return new Response(
      JSON.stringify({
        factory_name,
        password: returnPassword,
        password_changed: passwordChanged,
        expires_at: expiresAt.toISOString(),
        order_id: order.id,
        item_count: model_names.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "创建失败";
    const status = message.includes("权限") || message.includes("Token") ? 403 : 500;
    return new Response(
      JSON.stringify({ detail: message }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }
};

export const config: Config = {
  path: "/api/admin/accounts",
};
