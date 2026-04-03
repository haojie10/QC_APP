/**
 * 登录态管理 Hook
 * 处理 Token 缓存、用户信息存取、登出清理
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';

interface AuthUser {
  factoryName: string;
  isAdmin: boolean;
  expiresAt: string;
}

/**
 * 登录态管理
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 应用启动时从 localStorage 恢复登录态
  useEffect(() => {
    const token = localStorage.getItem('qc_token');
    const userStr = localStorage.getItem('qc_user');
    if (token && userStr) {
      try {
        const parsed = JSON.parse(userStr);
        // 检查是否已过期（如果设置了过期时间且已过时间点）
        const isExpired = parsed.expiresAt && new Date(parsed.expiresAt) < new Date();
        if (!isExpired) {
          setUser(parsed);
        } else {
          // 过期清理
          localStorage.removeItem('qc_token');
          localStorage.removeItem('qc_user');
        }
      } catch {
        localStorage.removeItem('qc_token');
        localStorage.removeItem('qc_user');
      }
    }
    setLoading(false);
  }, []);

  const doLogin = useCallback(async (factoryName: string, password: string) => {
    const result = await api.login(factoryName, password);
    const authUser: AuthUser = {
      factoryName: result.factory_name,
      isAdmin: result.is_admin,
      expiresAt: result.expires_at,
    };
    localStorage.setItem('qc_token', result.token);
    localStorage.setItem('qc_user', JSON.stringify(authUser));
    setUser(authUser);
    return authUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('qc_token');
    localStorage.removeItem('qc_user');
    setUser(null);
    navigate('/login');
  }, [navigate]);

  return { user, loading, login: doLogin, logout };
}
