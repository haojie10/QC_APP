"""
报告 API 路由
生成、下载、搜索、删除 PDF 报告
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from supabase import Client

from dependencies import get_supabase, get_current_user, get_admin_user
from service import report_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/{item_id}/generate")
async def generate_report(
    item_id: str,
    _user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """按货号生成 PDF 验货报告"""
    try:
        pdf_url = report_service.generate_report(supabase, item_id)
        return {"pdf_url": pdf_url}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("生成报告失败: %s", e)
        raise HTTPException(status_code=500, detail="报告生成失败")


@router.get("/{item_id}/download")
async def download_report(
    item_id: str,
    _user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """下载 PDF 报告（重定向到 Supabase Storage URL）"""
    from config import settings
    # 获取货号关联的订单 ID
    item = supabase.table("order_items").select("order_id").eq("id", item_id).execute()
    if not item.data:
        raise HTTPException(status_code=404, detail="货号不存在")

    order_id = item.data[0]["order_id"]
    pdf_path = f"{order_id}/{item_id}/report.pdf"
    pdf_url = supabase.storage.from_(settings.report_bucket).get_public_url(pdf_path)

    return RedirectResponse(url=pdf_url)


@router.get("/search")
async def search_reports(
    q: str = Query("", description="搜索关键词（订单号或工厂名）"),
    _admin: dict = Depends(get_admin_user),
    supabase: Client = Depends(get_supabase),
):
    """管理员搜索报告"""
    results = report_service.search_reports(supabase, q)
    return {"reports": results}


@router.delete("/{item_id}")
async def delete_report(
    item_id: str,
    _admin: dict = Depends(get_admin_user),
    supabase: Client = Depends(get_supabase),
):
    """管理员删除报告（含图片和数据库记录）"""
    try:
        report_service.delete_report(supabase, item_id)
        return {"message": "已删除"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
