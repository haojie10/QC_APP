/**
 * API 请求封装
 * 登录/创建账号/生成报告 → Netlify Functions
 * 其他查询操作 → 直连 Supabase（见 supabase.ts）
 */

/**
 * 从 localStorage 获取 Token
 */
function getToken(): string | null {
  return localStorage.getItem('qc_token');
}

/**
 * 统一请求 Netlify Functions
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 在 Netlify 部署环境中，Functions 路径是相对的
  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(error.detail || error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * 统一请求 Netlify Functions (FormData 支持)
 */
async function requestFormData<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(error.detail || error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// =================== 认证（Netlify Functions）===================

export interface LoginResult {
  token: string;
  factory_name: string;
  is_admin: boolean;
  expires_at: string;
}

/**
 * 登录：调用 Netlify Function
 */
export function login(factoryName: string, password: string) {
  return request<LoginResult>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ factory_name: factoryName, password }),
  });
}

export interface CreateAccountResult {
  factory_name: string;
  password: string;
  password_changed: boolean;
  expires_at: string;
  order_id: string;
  item_count: number;
}

/**
 * 管理员创建账号：调用 Netlify Function
 */
export function createAccount(data: {
  factory_name: string;
  order_number: string;
  model_names: string[];
  inspection_date: string;
}) {
  return request<CreateAccountResult>('/api/admin/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// =================== 报告（Netlify Function）===================

/**
 * 生成 PDF 报告：调用 Netlify Function
 */
export function generateReport(itemId: string) {
  return request<{ pdf_url: string }>(`/api/reports/${itemId}/generate`, {
    method: 'POST',
  });
}

// =================== 以下类型定义供页面使用（实际查询在 supabase.ts）===================

export interface Order {
  id: string;
  order_number: string;
  factory_name: string;
  inspection_date: string;
  status: string;
  item_count: number;
  completed_items: number;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  model_name: string;
  status: string;
  sort_order: number;
  completed_steps: number;
  total_steps: number;
}

export interface StepProgress {
  step_id: string;
  status: string;
  image_url: string | null;
}
// =================== 验货操作（Netlify Function）===================

export interface UploadPhotoResult {
  success: boolean;
  status: string;
  publicUrl?: string;
}

/**
 * 拍照上传：调用 Netlify Function
 */
export function recordPhotoUpload(itemId: string, stepId: string, file: Blob) {
  const formData = new FormData();
  formData.append('action', 'upload');
  formData.append('itemId', itemId);
  formData.append('stepId', stepId);
  formData.append('file', file);

  return requestFormData<UploadPhotoResult>('/api/upload-photo', formData);
}

/**
 * 跳过步骤：调用 Netlify Function
 */
export function skipStepUpload(itemId: string, stepId: string) {
  const formData = new FormData();
  formData.append('action', 'skip');
  formData.append('itemId', itemId);
  formData.append('stepId', stepId);

  return requestFormData<UploadPhotoResult>('/api/upload-photo', formData);
}
