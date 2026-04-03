"""
认证 API 路由
登录和管理员创建账号
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from dependencies import get_supabase, get_admin_user
from schema.auth import (
    LoginRequest, LoginResponse,
    CreateAccountRequest, CreateAccountResponse,
)
from service import auth_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    supabase: Client = Depends(get_supabase),
):
    """验货员登录（校验 48h 有效期）"""
    try:
        result = auth_service.login(supabase, request.factory_name, request.password)
        return result
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/admin/accounts", response_model=CreateAccountResponse)
async def create_account(
    request: CreateAccountRequest,
    supabase: Client = Depends(get_supabase),
    _admin: dict = Depends(get_admin_user),
):
    """管理员创建临时账号 + 关联订单 + 多个货号"""
    try:
        result = auth_service.create_account(
            supabase=supabase,
            factory_name=request.factory_name,
            order_number=request.order_number,
            model_names=request.model_names,
            inspection_date=request.inspection_date,
        )
        return result
    except Exception as e:
        logger.error("创建账号失败: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
