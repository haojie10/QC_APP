"""
任务 API 路由
订单列表、货号列表、步骤进度
"""
import logging
from fastapi import APIRouter, Depends
from supabase import Client

from dependencies import get_supabase, get_current_user
from service import task_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/tasks")
async def get_tasks(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """获取当前用户的任务列表（按工厂名关联）"""
    orders = task_service.get_user_orders(supabase, current_user["factory_name"])
    return {"orders": orders}


@router.get("/tasks/{order_id}/items")
async def get_order_items(
    order_id: str,
    _user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """获取订单下所有货号及进度"""
    items = task_service.get_order_items(supabase, order_id)
    return {"items": items}


@router.get("/items/{item_id}/progress")
async def get_item_progress(
    item_id: str,
    _user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """获取某货号的步骤进度（断点续传用）"""
    progress = task_service.get_item_progress(supabase, item_id)
    return {"progress": progress}
