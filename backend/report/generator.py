"""
PDF 验货报告生成器
使用 ReportLab 生成 HOWSTODAY 品牌风格的 PDF
"""
import io
import logging
from typing import Optional

import httpx
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table,
    TableStyle, PageBreak,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

logger = logging.getLogger(__name__)

# HOWSTODAY 品牌色
BRAND_COLOR = colors.HexColor("#EA5504")
TEXT_COLOR = colors.HexColor("#261813")
LIGHT_BG = colors.HexColor("#FFF8F6")
SURFACE = colors.HexColor("#FFE9E2")

# 步骤名称映射（中文）
STEP_NAMES = {
    "1.1": "大货图片",
    "1.2": "外箱图片",
    "1.3": "开箱图片",
    "2.1": "外箱长度",
    "2.2": "外箱宽度",
    "2.3": "外箱高度",
    "2.4": "外箱重量",
    "3.1": "正唛",
    "3.2": "侧唛",
    "4.1": "带包装产品",
    "4.2": "裸产品",
    "4.3": "产品标识",
    "4.4": "其他附件",
    "5.1": "产品长度",
    "5.2": "产品宽度",
    "5.3": "产品高度",
    "5.4": "产品净重",
}


def fetch_image(url: str) -> Optional[io.BytesIO]:
    """从 URL 下载图片，返回字节流"""
    try:
        response = httpx.get(url, timeout=30)
        if response.status_code == 200:
            return io.BytesIO(response.content)
    except Exception as e:
        logger.warning("下载图片失败 %s: %s", url, e)
    return None


def generate_pdf_report(
    order_number: str,
    factory_name: str,
    model_name: str,
    inspection_date: str,
    steps_data: list[dict],
) -> bytes:
    """
    生成 PDF 验货报告
    返回 PDF 文件的字节内容
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
    )

    # 样式定义
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        "BrandTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        textColor=BRAND_COLOR,
        alignment=TA_LEFT,
        spaceAfter=6 * mm,
    ))
    styles.add(ParagraphStyle(
        "InfoText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=TEXT_COLOR,
        spaceAfter=2 * mm,
    ))
    styles.add(ParagraphStyle(
        "StepTitle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        textColor=BRAND_COLOR,
        spaceBefore=8 * mm,
        spaceAfter=4 * mm,
    ))
    styles.add(ParagraphStyle(
        "StatusText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        textColor=colors.HexColor("#5f5e5e"),
        alignment=TA_CENTER,
        spaceBefore=4 * mm,
    ))

    elements = []

    # 页眉：品牌标题
    elements.append(Paragraph("HOWSTODAY", styles["BrandTitle"]))
    elements.append(Paragraph("Quality Control Inspection Report", styles["InfoText"]))
    elements.append(Spacer(1, 4 * mm))

    # 订单信息表
    info_data = [
        ["订单号", order_number, "工厂", factory_name],
        ["货号", model_name, "验货日期", inspection_date],
    ]
    info_table = Table(info_data, colWidths=[25 * mm, 55 * mm, 25 * mm, 55 * mm])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), SURFACE),
        ("BACKGROUND", (2, 0), (2, -1), SURFACE),
        ("TEXTCOLOR", (0, 0), (-1, -1), TEXT_COLOR),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("ROUNDEDCORNERS", [2 * mm, 2 * mm, 2 * mm, 2 * mm]),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 8 * mm))

    # 按步骤排列图片
    for step in steps_data:
        step_id = step["step_id"]
        step_name = STEP_NAMES.get(step_id, step_id)

        elements.append(Paragraph(
            f"步骤 {step_id}: {step_name}",
            styles["StepTitle"],
        ))

        if step["status"] == "skipped":
            elements.append(Paragraph("N/A（已跳过）", styles["StatusText"]))
        elif step["status"] == "uploaded" and step.get("image_url"):
            # 下载并嵌入图片
            img_data = fetch_image(step["image_url"])
            if img_data:
                try:
                    img = Image(img_data, width=160 * mm, height=120 * mm)
                    img.hAlign = "CENTER"
                    elements.append(img)
                except Exception as e:
                    logger.warning("嵌入图片失败 %s: %s", step_id, e)
                    elements.append(Paragraph("（图片加载失败）", styles["StatusText"]))
            else:
                elements.append(Paragraph("（图片加载失败）", styles["StatusText"]))
        else:
            elements.append(Paragraph("（未上传）", styles["StatusText"]))

        elements.append(Spacer(1, 4 * mm))

    # 构建 PDF
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    logger.info("PDF 生成完成: %s - %s (%d 字节)", order_number, model_name, len(pdf_bytes))
    return pdf_bytes
