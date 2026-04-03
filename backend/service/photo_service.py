"""
拍照业务逻辑
处理图片记录和跳过标记
"""
import logging
from supabase import Client

from service.task_service import update_item_status

logger = logging.getLogger(__name__)


def record_photo(
    supabase: Client,
    item_id: str,
    step_id: str,
    image_path: str,
) -> dict:
    """
    记录图片上传
    前端直传 Supabase Storage 后，调用此接口记录元数据
    """
    # 检查是否已有记录（防止重复上传）
    existing = (
        supabase.table("photos")
        .select("id")
        .eq("item_id", item_id)
        .eq("step_id", step_id)
        .execute()
    )

    if existing.data:
        # 更新已有记录
        result = (
            supabase.table("photos")
            .update({
                "image_path": image_path,
                "status": "uploaded",
            })
            .eq("id", existing.data[0]["id"])
            .execute()
        )
        logger.info("更新照片记录: item=%s step=%s", item_id, step_id)
    else:
        # 创建新记录
        result = (
            supabase.table("photos")
            .insert({
                "item_id": item_id,
                "step_id": step_id,
                "image_path": image_path,
                "status": "uploaded",
            })
            .execute()
        )
        logger.info("新建照片记录: item=%s step=%s", item_id, step_id)

    # 检查并更新货号/订单状态
    update_item_status(supabase, item_id)

    return result.data[0]


def skip_step(supabase: Client, item_id: str, step_id: str) -> dict:
    """
    标记步骤为跳过（N/A）
    跳过的步骤在数据库中 status='skipped'，image_path 为 null
    """
    existing = (
        supabase.table("photos")
        .select("id")
        .eq("item_id", item_id)
        .eq("step_id", step_id)
        .execute()
    )

    if existing.data:
        result = (
            supabase.table("photos")
            .update({
                "image_path": None,
                "status": "skipped",
            })
            .eq("id", existing.data[0]["id"])
            .execute()
        )
    else:
        result = (
            supabase.table("photos")
            .insert({
                "item_id": item_id,
                "step_id": step_id,
                "image_path": None,
                "status": "skipped",
            })
            .execute()
        )

    logger.info("跳过步骤: item=%s step=%s", item_id, step_id)

    # 检查并更新状态
    update_item_status(supabase, item_id)

    return result.data[0]
