/**
 * 登录页面
 * Stitch 设计系统风格：居中表单 + 品牌 Logo + 全屏暖色背景
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader2 } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
  const [factoryName, setFactoryName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!factoryName.trim() || !password.trim()) {
      setError('请输入工厂名称和密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await login(factoryName.trim(), password.trim());
      if (user.isAdmin) {
        navigate('/admin');
      } else {
        navigate('/tasks');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* 背景装饰 */}
      <div className="login-bg-circle login-bg-circle--1" />
      <div className="login-bg-circle login-bg-circle--2" />

      <div className="login-container glass">
        {/* 品牌 Logo */}
        <div className="login-brand">
          <div className="brand-glow" />
          <img
            src="/brand/Howstoday logo  orange.png"
            alt="HOWSTODAY"
            className="login-logo"
          />
          <p className="login-subtitle">Quality Control System</p>
        </div>

        {/* 登录表单 */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="input-label" htmlFor="factory-name">
              工厂名称
            </label>
            <input
              id="factory-name"
              className="input-field"
              type="text"
              placeholder="请输入工厂简称"
              value={factoryName}
              onChange={(e) => setFactoryName(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label className="input-label" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              className="input-field"
              type="password"
              placeholder="请输入临时密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary login-btn"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="spin-icon" size={20} />
            ) : (
              '登录'
            )}
          </button>
        </form>

        <p className="login-hint">
          临时账号有效期为 48 小时，请联系管理员获取
        </p>
      </div>
    </div>
  );
}
