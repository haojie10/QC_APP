-- Supabase 数据库 Schema
-- QC APP: 临时账号 + 订单 + 多货号 + 拍照记录

-- 用户表（管理员 + 临时验货员）
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- 订单表
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL,
  factory_name TEXT NOT NULL,
  inspection_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 货号表（每个订单可含多个货号）
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  sort_order INTEGER DEFAULT 1
);

-- 照片记录表
CREATE TABLE photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  image_path TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (item_id, step_id)
);

-- 索引优化
CREATE INDEX idx_orders_factory ON orders(factory_name);
CREATE INDEX idx_items_order ON order_items(order_id);
CREATE INDEX idx_photos_item ON photos(item_id);

-- 创建 Storage Bucket（需在 Supabase Dashboard 手动创建或通过 API）
-- qc-photos: 验货图片
-- qc-reports: PDF 报告

-- 创建管理员账号（密码: admin123 的 bcrypt 哈希）
-- 请在部署后通过 API 或 SQL 插入管理员记录
