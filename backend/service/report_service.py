"""
报告业务逻辑
调用 PDF 生成器，管理报告的生成和存储
"""
import logging
from supabase import Client

from config import settings
from report.generator import generate_pdf_report
from service.task_service import ALL_STEPS

logger = logging.getLogger(__name__)


def generate_report(supabase: Client, item_id: str) -> str:
    """
    按货号生成 PDF 验货报告
    返回报告的访问 URL
    """
    # 获取货号信息
    item_result = supabase.table("order_items").select("*").eq("id", item_id).execute()
    if not item_result.data:
        raise ValueError("货号不存在")
    item = item_result.data[0]

    # 获取订单信息
    order_result = supabase.table("orders").select("*").eq("id", item["order_id"]).execute()
    if not order_result.data:
        raise ValueError("订单不存在")
    order = order_result.data[0]

    # 获取所有照片记录
    photos = (
        supabase.table("photos")
        .select("*")
        .eq("item_id", item_id)
        .execute()
    )
    photo_map = {p["step_id"]: p for p in photos.data}

    # 构建步骤数据（含图片 URL）
    steps_data = []
    for step_id in ALL_STEPS:
        photo = photo_map.get(step_id)
        image_url = None
        if photo and photo["status"] == "uploaded" and photo["image_path"]:
            # 生成 Supabase Storage 公开 URL
            image_url = supabase.storage.from_(settings.storage_bucket).get_public_url(photo["image_path"])

        steps_data.append({
            "step_id": step_id,
            "status": photo["status"] if photo else "pending",
            "image_url": image_url,
        })

    # 生成 PDF
    pdf_bytes = generate_pdf_report(
        order_number=order["order_number"],
        factory_name=order["factory_name"],
        model_name=item["model_name"],
        inspection_date=order["inspection_date"],
        steps_data=steps_data,
    )

    # 上传 PDF 到 Supabase Storage
    pdf_path = f"{order['id']}/{item_id}/report.pdf"
    supabase.storage.from_(settings.report_bucket).upload(
        pdf_path,
        pdf_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )

    pdf_url = supabase.storage.from_(settings.report_bucket).get_public_url(pdf_path)
    logger.info("生成报告: order=%s item=%s", order["order_number"], item["model_name"])

    return pdf_url


def search_reports(supabase: Client, query: str = "") -> list[dict]:
    """管理员搜索报告（按订单号或工厂名）"""
    orders_query = supabase.table("orders").select("*")
    if query:
        # Supabase 使用 or 过滤
        orders_query = orders_query.or_(
            f"order_number.ilike.%{query}%,factory_name.ilike.%{query}%"
        )
    orders = orders_query.order("created_at", desc=True).execute()

    results = []
    for order in orders.data:
        items = (
            supabase.table("order_items")
            .select("*")
            .eq("order_id", order["id"])
            .order("sort_order")
            .execute()
        )
        for item in items.data:
            pdf_path = f"{order['id']}/{item['id']}/report.pdf"
            pdf_url = None
            if item["status"] == "completed":
                pdf_url = supabase.storage.from_(settings.report_bucket).get_public_url(pdf_path)

            results.append({
                "order_number": order["order_number"],
                "factory_name": order["factory_name"],
                "model_name": item["model_name"],
                "inspection_date": order["inspection_date"],
                "status": item["status"],
                "item_id": item["id"],
                "order_id": order["id"],
                "pdf_url": pdf_url,
            })

    return results


def delete_report(supabase: Client, item_id: str) -> None:
    """删除货号关联的报告、照片和记录"""
    # 获取货号和订单信息
    item = supabase.table("order_items").select("*").eq("id", item_id).execute()
    if not item.data:
        raise ValueError("货号不存在")

    order_id = item.data[0]["order_id"]

    # 删除照片记录
    supabase.table("photos").delete().eq("item_id", item_id).execute()

    # 删除 Storage 中的文件
    try:
        # 列出并删除图片文件
        files = supabase.storage.from_(settings.storage_bucket).list(f"{order_id}/{item_id}")
        if files:
            paths = [f"{order_id}/{item_id}/{f['name']}" for f in files]
            supabase.storage.from_(settings.storage_bucket).remove(paths)

        # 删除 PDF
        supabase.storage.from_(settings.report_bucket).remove([f"{order_id}/{item_id}/report.pdf"])
    except Exception as e:
        logger.warning("清理 Storage 文件时出错: %s", e)

    # 删除货号记录
    supabase.table("order_items").delete().eq("id", item_id).execute()

    # 检查是否需要删除空订单
    remaining = supabase.table("order_items").select("id").eq("order_id", order_id).execute()
    if not remaining.data:
        supabase.table("orders").delete().eq("id", order_id).execute()
        logger.info("空订单已删除: %s", order_id)

    logger.info("已删除货号及报告: %s", item_id)
