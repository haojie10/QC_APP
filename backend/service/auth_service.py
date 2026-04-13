"""
认证业务逻辑
处理 48h 临时账号创建、登录校验、JWT 签发
"""
import logging
import secrets
import string
from datetime import datetime, timedelta, timezone

from jose import jwt
import bcrypt
from supabase import Client

from config import settings

logger = logging.getLogger(__name__)

# 使用 bcrypt 直接进行哈希和校验
# 注意：bcrypt 只能处理最长 72 位的密码


def generate_random_password(length: int = 8) -> str:
    """生成随机密码：字母+数字组合，便于验货员手动输入"""
    chars = string.ascii_uppercase + string.digits
    # 排除容易混淆的字符 O/0, I/1/l
    chars = chars.replace("O", "").replace("0", "").replace("I", "").replace("l", "")
    return "".join(secrets.choice(chars) for _ in range(length))


def create_jwt_token(user_id: str, is_admin: bool = False) -> str:
    """签发 JWT Token"""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": user_id,
        "is_admin": is_admin,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_account(
    supabase: Client,
    factory_name: str,
    order_number: str,
    model_names: list[str],
    inspection_date: str,
) -> dict:
    """
    管理员创建临时账号 + 关联订单 + 多个货号
    返回临时密码供管理员告知验货员
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=settings.account_expire_hours)
    raw_password = generate_random_password()

    # 检查账号是否已存在
    existing = supabase.table("users").select("id").eq("factory_name", factory_name).execute()
    if existing.data:
        # 账号已存在则更新密码和有效期
        user_id = existing.data[0]["id"]
        supabase.table("users").update({
            "password_hash": bcrypt.hashpw(raw_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
        }).eq("id", user_id).execute()
        logger.info("已更新临时账号: %s", factory_name)
    else:
        # 创建新账号
        user_result = supabase.table("users").insert({
            "factory_name": factory_name,
            "password_hash": bcrypt.hashpw(raw_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "is_admin": False,
        }).execute()
        user_id = user_result.data[0]["id"]
        logger.info("已创建临时账号: %s", factory_name)

    # 创建订单
    order_result = supabase.table("orders").insert({
        "order_number": order_number,
        "factory_name": factory_name,
        "inspection_date": inspection_date,
        "status": "pending",
        "created_at": now.isoformat(),
    }).execute()
    order_id = order_result.data[0]["id"]

    # 批量创建货号
    items = []
    for idx, model_name in enumerate(model_names):
        items.append({
            "order_id": order_id,
            "model_name": model_name,
            "status": "pending",
            "sort_order": idx + 1,
        })
    supabase.table("order_items").insert(items).execute()

    logger.info("创建订单 %s，包含 %d 个货号", order_number, len(model_names))

    return {
        "factory_name": factory_name,
        "password": raw_password,
        "expires_at": expires_at.isoformat(),
        "order_id": order_id,
        "item_count": len(model_names),
    }


def login(supabase: Client, factory_name: str, password: str) -> dict:
    """
    验货员登录：校验密码 + 48h 有效期
    """
    result = supabase.table("users").select("*").eq("factory_name", factory_name).execute()
    if not result.data:
        raise ValueError("账号不存在")

    user = result.data[0]

    # 校验密码
    try:
        if not bcrypt.checkpw(password.encode('utf-8'), user["password_hash"].encode('utf-8')):
            raise ValueError("密码错误")
    except Exception as e:
        logger.error("密码校验失败: %s", e)
        raise ValueError(f"密码校验失败: {str(e)}")

    # 校验有效期（管理员不受限）
    if not user.get("is_admin"):
        expires_at_val = user.get("expires_at")
        if not expires_at_val:
             raise ValueError("账号无效：缺少过期时间")
        
        expires_at = datetime.fromisoformat(str(expires_at_val).replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            raise ValueError("账号已过期，请联系管理员获取新密码")

    # 签发 JWT
    token = create_jwt_token(user["id"], user.get("is_admin", False))

    return {
        "token": token,
        "factory_name": user["factory_name"],
        "is_admin": user.get("is_admin", False),
        "expires_at": user["expires_at"],
    }
