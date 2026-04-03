/**
 * Netlify Function: 登录验证
 * 校验工厂账号密码 + 48h 有效期 + 签发 JWT
 */
import type { Context, Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

/** 从环境变量中读取敏感配置 */
function getEnv(key: string): string {
  const val = Netlify.env.get(key);
  if (!val) throw new Error(`缺少环境变量: ${key}`);
  return val;
}

export default async (req: Request, _context: Context) => {
  // 仅允许 POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ detail: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { factory_name, password } = await req.json();

    if (!factory_name || !password) {
      return new Response(
        JSON.stringify({ detail: "请输入工厂名称和密码" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_KEY"),
    );

    // 查询用户
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("factory_name", factory_name)
      .limit(1);

    if (error || !users?.length) {
      return new Response(
        JSON.stringify({ detail: "账号不存在" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const user = users[0];

    // 校验密码
    const passwordValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordValid) {
      return new Response(
        JSON.stringify({ detail: "密码错误" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // 校验有效期（管理员不受限）
    if (!user.is_admin && user.expires_at) {
      const expiresAt = new Date(user.expires_at);
      if (new Date() > expiresAt) {
        return new Response(
          JSON.stringify({ detail: "账号已过期，请联系管理员获取新密码" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // 签发 JWT（48h 有效）
    const token = jwt.sign(
      { sub: user.id, factory_name: user.factory_name, is_admin: user.is_admin },
      getEnv("JWT_SECRET_KEY"),
      { expiresIn: "48h" },
    );

    return new Response(
      JSON.stringify({
        token,
        factory_name: user.factory_name,
        is_admin: user.is_admin || false,
        expires_at: user.expires_at,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "登录失败";
    return new Response(
      JSON.stringify({ detail: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

export const config: Config = {
  path: "/api/login",
};
