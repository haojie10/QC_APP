"""
依赖注入：Supabase 客户端、当前用户验证
"""
import logging
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from supabase import create_client, Client

from config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer()


def get_supabase() -> Client:
    """获取 Supabase 客户端（使用 service_role key 绕过 RLS）"""
    return create_client(settings.supabase_url, settings.supabase_service_key)


def get_supabase_anon() -> Client:
    """获取 Supabase 客户端（使用 anon key，受 RLS 约束）"""
    return create_client(settings.supabase_url, settings.supabase_key)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """
    从 JWT Token 中提取当前用户信息
    校验 Token 有效性和账号过期状态
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证凭据",
            )
    except JWTError as e:
        logger.warning("JWT 解码失败: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭据",
        )

    # 从数据库获取用户信息
    result = supabase.table("users").select("*").eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )

    user = result.data[0]

    # 检查账号是否过期（管理员不受限）
    if not user.get("is_admin"):
        expires_at = datetime.fromisoformat(user["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="账号已过期，请联系管理员",
            )

    return user


async def get_admin_user(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """验证当前用户是否为管理员"""
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限",
        )
    return current_user
