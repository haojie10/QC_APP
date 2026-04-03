/**
 * Netlify Function: 生成 PDF 验货报告
 * 使用 jsPDF 生成报告，上传到 Supabase Storage
 * NOTE: 由于 Netlify Function 10s 超时，使用轻量级 PDF 方案
 */
import type { Context, Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { jsPDF } from "jspdf";

function getEnv(key: string): string {
  const val = Netlify.env.get(key);
  if (!val) throw new Error(`缺少环境变量: ${key}`);
  return val;
}

// 步骤名称映射
const STEP_NAMES: Record<string, string> = {
  "1.1": "Bulk Goods",
  "1.2": "Outer Carton",
  "1.3": "Carton Opening",
  "2.1": "Carton Length",
  "2.2": "Carton Width",
  "2.3": "Carton Height",
  "2.4": "Carton Weight",
  "3.1": "Shipping Mark (Front)",
  "3.2": "Shipping Mark (Side)",
  "4.1": "Product w/ Packaging",
  "4.2": "Product (Bare)",
  "4.3": "Product Label",
  "4.4": "Accessories",
  "5.1": "Product Length",
  "5.2": "Product Width",
  "5.3": "Product Height",
  "5.4": "Product Net Weight",
};

/** 校验 JWT Token */
function verifyToken(req: Request): { sub: string; factory_name: string } {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("未提供有效 Token");
  }
  return jwt.verify(authHeader.slice(7), getEnv("JWT_SECRET_KEY")) as {
    sub: string;
    factory_name: string;
  };
}

/** 下载图片并转为 base64 data URL */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ detail: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    verifyToken(req);

    // 增加对末尾斜杠的处理
    const url = new URL(req.url);
    const sanitizedPath = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
    const pathParts = sanitizedPath.split("/");
    // 兼容解析：如果是 /api/reports/ID/generate，则 ID 是倒数第二个；如果是部署后的函数路径，可能不同
    const generateIdx = pathParts.indexOf("generate");
    const itemId = generateIdx > 0 ? pathParts[generateIdx - 1] : pathParts[pathParts.length - 2];

    if (!itemId || itemId === "reports") {
      return new Response(
        JSON.stringify({ detail: "无效的货号 ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_KEY"),
    );

    // 查询货号信息
    const { data: item, error: itemError } = await supabase
      .from("order_items")
      .select("*, orders(*)")
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      return new Response(
        JSON.stringify({ detail: `货号 [${itemId}] 不存在或查询失败: ${itemError?.message}` }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // 查询所有照片记录
    const { data: photos, error: photoError } = await supabase
      .from("photos")
      .select("*")
      .eq("item_id", itemId);

    // 强行写入本地文件调试 (仅在本地开发环境有效)
    try {
      const fs = await import("node:fs");
      const details = photos?.map((p: any) => `${p.step_id}:${p.status}`).join(", ");
      const logMsg = `[${new Date().toISOString()}] Gen Report - itemId: ${itemId}, details: [${details}]\n`;
      fs.appendFileSync("backend_debug.log", logMsg);
    } catch (e) {
      // 忽略日志写入错误
    }

    const order = item.orders;
    const orderNumber = order?.order_number || "N/A";
    const factoryName = order?.factory_name || "N/A";
    const modelName = item.model_name;
    const inspectionDate = order?.inspection_date || "N/A";

    // 生成 PDF
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    // 品牌色
    const brandR = 234, brandG = 85, brandB = 4;

    // 页眉
    doc.setFontSize(24);
    doc.setTextColor(brandR, brandG, brandB);
    doc.text("HOWSTODAY", margin, 25);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Quality Control Inspection Report", margin, 32);

    // 信息表格
    doc.setDrawColor(brandR, brandG, brandB);
    doc.setLineWidth(0.5);
    doc.line(margin, 36, pageWidth - margin, 36);

    doc.setFontSize(10);
    doc.setTextColor(60);
    const infoY = 44;
    doc.text(`Order: ${orderNumber}`, margin, infoY);
    doc.text(`Factory: ${factoryName}`, pageWidth / 2, infoY);
    doc.text(`Model: ${modelName}`, margin, infoY + 6);
    doc.text(`Date: ${inspectionDate}`, pageWidth / 2, infoY + 6);

    doc.line(margin, infoY + 10, pageWidth - margin, infoY + 10);

    // 按步骤添加图片
    let currentY = infoY + 18;

    const sortedSteps = Object.keys(STEP_NAMES);
    for (const stepId of sortedSteps) {
      // 容错匹配：移除空格并转为字符串
      const photo = photos?.find((p: any) => 
        String(p.step_id || "").trim() === String(stepId).trim()
      );
      const stepName = STEP_NAMES[stepId];

      // 检查是否需要换页
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // 步骤标题
      doc.setFontSize(12);
      doc.setTextColor(brandR, brandG, brandB);
      doc.text(`${stepId}  ${stepName}`, margin, currentY);
      currentY += 6;

      if (photo?.status === "skipped") {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text("N/A (Skipped)", margin + 5, currentY + 4);
        currentY += 12;
      } else if (photo?.status === "uploaded" && photo.image_path) {
        // 使用签名 URL 获取图片（更安全，绕过公放权限问题）
        const { data: signData } = await supabase.storage
          .from("qc-photos")
          .createSignedUrl(photo.image_path, 60);

        if (signData?.signedUrl) {
          const imgData = await fetchImageAsBase64(signData.signedUrl);
          if (imgData) {
            try {
              const imgW = contentWidth * 0.8;
              const imgH = imgW * 0.75;

              if (currentY + imgH > 280) {
                doc.addPage();
                currentY = 20;
              }

              doc.addImage(imgData, "JPEG", margin + 5, currentY, imgW, imgH);
              currentY += imgH + 8;
            } catch (e) {
              doc.setFontSize(10);
              doc.setTextColor(150);
              doc.text("(Image format error)", margin + 5, currentY + 4);
              currentY += 12;
            }
          } else {
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text("(Image download failed)", margin + 5, currentY + 4);
            currentY += 12;
          }
        } else {
          doc.setFontSize(10);
          doc.setTextColor(150);
          doc.text("(Signed URL failed)", margin + 5, currentY + 4);
          currentY += 12;
        }
      } else {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text("(Not uploaded)", margin + 5, currentY + 4);
        currentY += 12;
      }
    }

    // 调试日志输出
    const debugInfo = {
      itemId,
      photosCount: photos?.length || 0,
      photoIds: photos?.map((p: any) => p.step_id),
      photoError: photoError?.message,
    };
    console.log("Debug Info:", debugInfo);

    // 导出 PDF
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const pdfPath = `reports/${orderNumber}_${modelName}_${Date.now()}.pdf`;

    // 上传到 Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("qc-reports")
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw new Error(`PDF 上传失败: ${uploadError.message}`);

    const { data: publicUrl } = supabase.storage
      .from("qc-reports")
      .getPublicUrl(pdfPath);

    // 更新货号状态为 completed
    await supabase
      .from("order_items")
      .update({ status: "completed" })
      .eq("id", itemId);

    return new Response(
      JSON.stringify({ pdf_url: publicUrl.publicUrl }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "报告生成失败";
    return new Response(
      JSON.stringify({ detail: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

export const config: Config = {
  path: "/api/reports/:itemId/generate",
};
