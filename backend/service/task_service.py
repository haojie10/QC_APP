"""
任务业务逻辑
处理订单查询、货号管理、进度统计
"""
import logging
from supabase import Client

logger = logging.getLogger(__name__)

# 18 个验货步骤定义
ALL_STEPS = [
    "1.1", "1.2", "1.3",
    "2.1", "2.2", "2.3", "2.4",
    "3.1", "3.2",
    "4.1", "4.2", "4.3", "4.4",
    "5.1", "5.2", "5.3", "5.4",
]
# NOTE: 步骤 1.1 比步骤列表少 1 个，实际是 17 个文件但 18 个数据步骤
# 原始文件名对应见 steps.ts（前端配置）


def get_user_orders(supabase: Client, factory_name: str) -> list[dict]:
    """获取某工厂账号下的所有订单（含进度统计）"""
    orders = (
        supabase.table("orders")
        .select("*")
        .eq("factory_name", factory_name)
        .order("created_at", desc=True)
        .execute()
    )

    result = []
    for order in orders.data:
        # 统计货号数量和完成数
        items = (
            supabase.table("order_items")
            .select("id, status")
            .eq("order_id", order["id"])
            .execute()
        )
        total_items = len(items.data)
        completed_items = sum(1 for i in items.data if i["status"] == "completed")

        result.append({
            **order,
            "item_count": total_items,
            "completed_items": completed_items,
        })

    return result


def get_order_items(supabase: Client, order_id: str) -> list[dict]:
    """获取订单下的所有货号及其验货进度"""
    items = (
        supabase.table("order_items")
        .select("*")
        .eq("order_id", order_id)
        .order("sort_order")
        .execute()
    )

    result = []
    for item in items.data:
        # 统计已完成步骤
        photos = (
            supabase.table("photos")
            .select("step_id")
            .eq("item_id", item["id"])
            .execute()
        )
        completed_steps = len(photos.data)

        result.append({
            **item,
            "completed_steps": completed_steps,
            "total_steps": len(ALL_STEPS),
        })

    return result


def get_item_progress(supabase: Client, item_id: str) -> list[dict]:
    """获取某货号的所有步骤进度（用于断点续传）"""
    photos = (
        supabase.table("photos")
        .select("*")
        .eq("item_id", item_id)
        .execute()
    )

    # 构建已完成的步骤映射
    done_map = {p["step_id"]: p for p in photos.data}

    progress = []
    for step in ALL_STEPS:
        if step in done_map:
            record = done_map[step]
            progress.append({
                "step_id": step,
                "status": record["status"],
                "image_url": record.get("image_path"),
            })
        else:
            progress.append({
                "step_id": step,
                "status": "pending",
                "image_url": None,
            })

    return progress


def update_item_status(supabase: Client, item_id: str) -> None:
    """检查并更新货号状态（如 18 步全完成则标记 completed）"""
    photos = (
        supabase.table("photos")
        .select("step_id")
        .eq("item_id", item_id)
        .execute()
    )

    if len(photos.data) >= len(ALL_STEPS):
        supabase.table("order_items").update({"status": "completed"}).eq("id", item_id).execute()
        logger.info("货号 %s 已完成全部步骤", item_id)

        # 同时检查订单是否全部完成
        item = supabase.table("order_items").select("order_id").eq("id", item_id).execute()
        if item.data:
            order_id = item.data[0]["order_id"]
            all_items = supabase.table("order_items").select("status").eq("order_id", order_id).execute()
            all_done = all(i["status"] == "completed" for i in all_items.data)
            if all_done:
                supabase.table("orders").update({"status": "completed"}).eq("id", order_id).execute()
                logger.info("订单 %s 全部货号已完成", order_id)
    else:
        # 有进度但未完成
        supabase.table("order_items").update({"status": "in_progress"}).eq("id", item_id).execute()
        # 更新订单状态
        item = supabase.table("order_items").select("order_id").eq("id", item_id).execute()
        if item.data:
            supabase.table("orders").update({"status": "in_progress"}).eq("id", item.data[0]["order_id"]).execute()
