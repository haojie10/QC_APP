/**
 * Netlify Function: 生成 Excel 验货报告
 * 使用 exceljs 处理模版并嵌入图片
 */
import type { Context, Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

function getEnv(key: string): string {
  const val = Netlify.env.get(key);
  if (!val) throw new Error(`缺少环境变量: ${key}`);
  return val;
}

// 步骤名称与 Excel 坐标的映射 (1-based, 但 tl 使用 0-indexed)
// NOTE: 根据模版分析，奇数行为标签，偶数行为图片区域
const STEP_MAPPING: Record<string, { col: number, row: number }> = {
  "1.1": { col: 1, row: 9 },  // A9: 大货
  "1.2": { col: 6, row: 9 },  // F9: 外箱
  "1.3": { col: 1, row: 11 }, // A11: 开箱
  "2.1": { col: 1, row: 14 }, // A14: 外箱长度
  "2.2": { col: 6, row: 14 }, // F14: 外箱宽度
  "2.3": { col: 1, row: 16 }, // A16: 外箱高度
  "2.4": { col: 6, row: 16 }, // F16: 外箱毛重
  "3.1": { col: 1, row: 19 }, // A19: 正唛
  "3.2": { col: 6, row: 19 }, // F19: 侧唛
  "4.1": { col: 1, row: 22 }, // A22: 产品带包装
  "4.2": { col: 6, row: 22 }, // F22: 产品裸机
  "4.3": { col: 1, row: 24 }, // A24: 产品标识
  "4.4": { col: 6, row: 24 }, // F24: 产品附件
  "5.1": { col: 1, row: 27 }, // A27: 产品长度
  "5.2": { col: 6, row: 27 }, // F27: 产品宽度
  "5.3": { col: 1, row: 29 }, // A29: 产品高度
  "5.4": { col: 6, row: 29 }, // F29: 产品净重
};

/** 校验 JWT Token */
function verifyToken(req: Request): { sub: string; factoryName: string } {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("未提供有效 Token");
  }
  const decoded = jwt.verify(authHeader.slice(7), getEnv("JWT_SECRET_KEY")) as any;
  return { 
    sub: decoded.sub, 
    factoryName: decoded.factory_name 
  };
}

/** 将本地文件读为 Buffer/Uint8Array */
function getLocalAssetAsBuffer(fileName: string): Uint8Array {
  const assetPath = path.resolve(__dirname, `assets/${fileName}`);
  if (!fs.existsSync(assetPath)) throw new Error(`资产不存在: ${assetPath}`);
  return new Uint8Array(fs.readFileSync(assetPath));
}

/** 下载图片并转为 Buffer */
async function fetchImageAsBuffer(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    // NOTE: 使用 Uint8Array 以兼容更多的运行环境并解决类型识别问题
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error(`图片下载失败: ${url}`, error);
    return null;
  }
}

export default async (req: Request, _context: Context) => {
  // ... (方法检查代码保持不变)
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ detail: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { sub, factoryName } = verifyToken(req);

    // 解析 itemId
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const itemId = pathParts[pathParts.length - 2];

    if (!itemId) {
      return new Response(JSON.stringify({ detail: "无效的货号 ID" }), { status: 400 });
    }

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_KEY")
    );

    // 1. 查询基础数据
    const { data: item, error: itemErr } = await supabase
      .from("order_items")
      .select("*, orders(*)")
      .eq("id", itemId)
      .single();

    if (itemErr || !item) {
      throw new Error(`货号查询失败: ${itemErr?.message}`);
    }

    const { data: photos, error: photoErr } = await supabase
      .from("photos")
      .select("*")
      .eq("item_id", itemId);

    if (photoErr) throw new Error(`照片查询失败: ${photoErr.message}`);

    // 2. 加载 Excel 模版
    // NOTE: Netlify 环境下资产文件需随函数一起打包，路径需通过 __dirname 定位
    const templatePath = path.resolve(__dirname, "assets/template.xlsx");
    if (!fs.existsSync(templatePath)) {
      throw new Error(`模版文件不存在: ${templatePath}`);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) throw new Error("无法读取模版 Sheet1");

    // 2.1 替换 Logo (A2:E5 区域)
    const logoBuffer = getLocalAssetAsBuffer("brand-logo.png");
    const logoId = workbook.addImage({
      buffer: logoBuffer as any,
      extension: "png",
    });
    worksheet.addImage(logoId, {
      tl: { col: 0.1, row: 1.1 }, // 略微偏移以避免压线
      ext: { width: 330, height: 80 }, // Logo 适配区域
      editAs: 'oneCell'
    });

    const order = item.orders;
    // 3. 填充基础信息
    worksheet.getCell("H2").value = order.inspection_date || "";
    worksheet.getCell("H3").value = order.factory_name || "";
    worksheet.getCell("H4").value = order.order_number || "";
    worksheet.getCell("H5").value = item.model_name || "";

    // 4. 插入图片
    const uploadedPhotos = (photos || []).filter(p => p.status === "uploaded" && p.image_path);
    
    // 并行下载所有图片
    const photoTasks = uploadedPhotos.map(async (photo) => {
      const mapping = STEP_MAPPING[photo.step_id];
      if (!mapping) return;

      const { data: signData } = await supabase.storage
        .from("qc-photos")
        .createSignedUrl(photo.image_path, 60);

      if (signData?.signedUrl) {
        const buffer = await fetchImageAsBuffer(signData.signedUrl);
        if (buffer) {
          const imageId = workbook.addImage({
            buffer: buffer as any,
            extension: "jpeg",
          });

          // NOTE: 根据用户反馈，图片缩小 20% (基于原 330x235 -> 264x188)
          // 并微调偏移量实现居中感
          worksheet.addImage(imageId, {
            tl: { col: mapping.col - 0.8, row: mapping.row - 0.9 },
            ext: { width: 264, height: 188 }, 
            editAs: 'oneCell'
          });
        }
      }
    });

    await Promise.all(photoTasks);

    // 5. 生成 buffer 并上传
    const excelBuffer = await workbook.xlsx.writeBuffer();
    const fileName = `excel_reports/${order.order_number}_${item.model_name}_${Date.now()}.xlsx`;

    const { error: uploadErr } = await supabase.storage
      .from("qc-reports")
      .upload(fileName, excelBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true
      });

    if (uploadErr) throw new Error(`Excel 上传失败: ${uploadErr.message}`);

    const { data: publicUrl } = supabase.storage
      .from("qc-reports")
      .getPublicUrl(fileName);

    // 更新货号状态
    await supabase
      .from("order_items")
      .update({ status: "completed" })
      .eq("id", itemId);

    return new Response(JSON.stringify({ excel_url: publicUrl.publicUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Excel 生成失败:", err);
    return new Response(JSON.stringify({ detail: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/reports/:itemId/generate-excel",
};
