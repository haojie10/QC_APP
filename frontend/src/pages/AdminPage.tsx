/**
 * 管理员控制中心
 * 创建临时账号 + 搜索/管理报告
 */
import { useState, useEffect, type FormEvent } from 'react';
import * as api from '../services/api';
import { searchReports, deleteInspection, getAccounts } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import {
  Plus, Search, FileText, Trash2, Copy,
  CheckCircle2, LogOut, Download, AlertCircle, Users
} from 'lucide-react';
import './AdminPage.css';

export default function AdminPage() {
  const { logout } = useAuth();

  // 创建账号
  const [factoryName, setFactoryName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [modelNames, setModelNames] = useState('');
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<api.CreateAccountResult | null>(null);
  const [createError, setCreateError] = useState('');

  // 报告列表
  const [searchQuery, setSearchQuery] = useState('');
  const [reports, setReports] = useState<Array<{
    order_number: string;
    factory_name: string;
    model_name: string;
    inspection_date: string;
    created_at: string;
    status: string;
    item_id: string;
    order_id: string;
    pdf_url: string | null;
  }>>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  // NOTE: 记录正在生成报告的货号 ID，防止重复点击
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // 账号管理
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  useEffect(() => {
    loadReports();
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const data = await getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('加载账号失败:', err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadReports = async (query = '') => {
    try {
      setLoadingReports(true);
      const data = await searchReports(query);
      setReports(data);
    } catch (err) {
      console.error('加载报告失败:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!factoryName || !orderNumber || !modelNames) {
      setCreateError('请填写工厂名称、订单号和至少一个货号');
      return;
    }

    try {
      setCreating(true);
      setCreateError('');
      const result = await api.createAccount({
        factory_name: factoryName.trim(),
        order_number: orderNumber.trim(),
        model_names: modelNames.split(/[,，\s]+/).filter(Boolean),
        inspection_date: inspectionDate,
      });
      setCreateResult(result);
      loadAccounts();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyPassword = () => {
    if (createResult?.password) {
      navigator.clipboard.writeText(createResult.password);
    }
  };

  const handleDeleteReport = async (itemId: string) => {
    if (!confirm('确认删除此报告？此操作不可撤销。')) return;
    try {
      await deleteInspection(itemId);
      loadReports(searchQuery);
    } catch (err) {
      alert('删除失败');
    }
  };

  /**
   * 生成并下载验货报告
   * 调用后端 Netlify Function 生成 PDF，成功后在新窗口打开
   */
  const handleDownloadReport = async (itemId: string) => {
    try {
      setGeneratingId(itemId);
      const result = await api.generateExcelReport(itemId);
      if (result.excel_url) {
        window.open(result.excel_url, '_blank');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '生成报告失败');
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="admin-page">
      <header className="tasks-header glass">
        <div className="tasks-header-inner container">
          <div className="tasks-header-left">
            <img src="/brand/Howstoday logo  orange.png" alt="HOWSTODAY" className="tasks-logo" />
            <span className="admin-tag">管理后台</span>
          </div>
          <button className="btn-ghost tasks-logout-btn" onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="admin-main container">
        {/* 创建账号区域 */}
        <section className="admin-section">
          <h2 className="admin-section-title">
            <Plus size={20} />
            创建临时账号
          </h2>

          <form className="admin-form card" onSubmit={handleCreateAccount}>
            <div className="admin-form-grid">
              <div className="login-field">
                <label className="input-label">工厂简称</label>
                <input
                  className="input-field"
                  placeholder="如：瑞安工厂"
                  value={factoryName}
                  onChange={(e) => setFactoryName(e.target.value)}
                />
              </div>
              <div className="login-field">
                <label className="input-label">订单号</label>
                <input
                  className="input-field"
                  placeholder="如：HT-2026-001"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                />
              </div>
              <div className="login-field">
                <label className="input-label">货号（逗号分隔）</label>
                <input
                  className="input-field"
                  placeholder="如：SKU-001, SKU-002, SKU-003"
                  value={modelNames}
                  onChange={(e) => setModelNames(e.target.value)}
                />
              </div>
              <div className="login-field">
                <label className="input-label">验货日期</label>
                <input
                  className="input-field"
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                />
              </div>
            </div>

            {createError && (
              <div className="login-error">
                <AlertCircle size={14} />
                {createError}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? '创建中...' : '创建账号'}
            </button>
          </form>

          {/* 创建成功结果 */}
          {createResult && (
            <div className="admin-result card">
              <div className="admin-result-header">
                <CheckCircle2 size={20} className="admin-result-icon" />
                <span>{createResult.password_changed ? '账号创建成功' : '新任务已追加'}</span>
              </div>
              <div className="admin-result-info">
                <div className="admin-result-row">
                  <span>工厂名称</span>
                  <strong>{createResult.factory_name}</strong>
                </div>
                <div className="admin-result-row admin-result-row--password">
                  <span>{createResult.password_changed ? '新密码' : '密码（沿用原密码）'}</span>
                  <div className="admin-password-display">
                    <code className="admin-password-code">{createResult.password}</code>
                    <button className="btn-ghost admin-copy-btn" onClick={handleCopyPassword}>
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <div className="admin-result-row">
                  <span>有效期至</span>
                  <strong>{new Date(createResult.expires_at).toLocaleString('zh-CN')}</strong>
                </div>
                <div className="admin-result-row">
                  <span>货号数量</span>
                  <strong>{createResult.item_count} 个</strong>
                </div>
                {!createResult.password_changed && (
                  <div className="admin-result-row" style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
                    <span></span>
                    <span>该工厂账号已存在，密码未更改，有效期已延长</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 账号管理区域 */}
        <section className="admin-section">
          <h2 className="admin-section-title">
            <Users size={20} />
            账号管理
          </h2>
          <div className="admin-accounts-list">
            {loadingAccounts ? (
              <div className="tasks-loading" style={{ padding: 'var(--space-8) 0' }}>
                <div className="tasks-spinner" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="tasks-empty" style={{ padding: 'var(--space-8) 0' }}>
                <Users size={32} strokeWidth={1.2} />
                <p>暂无账号</p>
              </div>
            ) : (
              <div className="admin-reports-list">
                {accounts.map((acc: any) => {
                  const isValid = new Date(acc.expires_at) > new Date();
                  return (
                    <div key={acc.id} className="admin-report-card card" style={{ opacity: isValid ? 1 : 0.6 }}>
                      <div className="admin-report-info">
                        <div className="admin-report-order">{acc.factory_name}</div>
                        <div className="admin-report-meta" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: 4 }}>
                          <span>密码: <code style={{ userSelect: 'all', background: 'var(--surface-sunken)', padding: '2px 4px', borderRadius: 4 }}>{acc.plain_password || '已加密不可见'}</code></span>
                          <span>有效期至: {new Date(acc.expires_at).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                      <div className="admin-report-actions">
                        <span className={`status-badge ${isValid ? 'status-badge--success' : 'status-badge--pending'}`}>
                          {isValid ? '有效' : '已过期'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* 报告管理区域 */}
        <section className="admin-section">
          <h2 className="admin-section-title">
            <FileText size={20} />
            验货报告
          </h2>

          <div className="admin-search">
            <Search size={16} className="admin-search-icon" />
            <input
              className="input-field admin-search-input"
              placeholder="搜索订单号或工厂名..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                loadReports(e.target.value);
              }}
            />
          </div>

          <div className="admin-reports-list">
            {loadingReports ? (
              <div className="tasks-loading" style={{ padding: 'var(--space-8) 0' }}>
                <div className="tasks-spinner" />
              </div>
            ) : reports.length === 0 ? (
              <div className="tasks-empty" style={{ padding: 'var(--space-8) 0' }}>
                <FileText size={32} strokeWidth={1.2} />
                <p>暂无报告</p>
              </div>
            ) : (
              reports.map((report) => {
                // 判断是否超过 7 天
                const MS_PER_DAY = 24 * 60 * 60 * 1000;
                let isExpired = false;
                if (report.created_at) {
                  isExpired = new Date(report.created_at).getTime() + 7 * MS_PER_DAY < Date.now();
                }

                return (
                  <div key={report.item_id} className="admin-report-card card" style={{ opacity: isExpired ? 0.6 : 1 }}>
                    <div className="admin-report-info">
                      <div className="admin-report-order">{report.order_number}</div>
                      <div className="admin-report-meta">
                        {report.factory_name} · {report.model_name} · {report.inspection_date}
                      </div>
                      {isExpired && (
                        <div className="admin-report-meta" style={{ color: 'var(--danger)', marginTop: 4 }}>
                          该报告已超过7天，文件已被自动清理
                        </div>
                      )}
                    </div>
                    <div className="admin-report-actions">
                      <span className={`status-badge ${isExpired ? 'status-badge--pending' : (report.status === 'completed' ? 'status-badge--success' : 'status-badge--pending')}`}>
                        {isExpired ? '已过期' : (report.status === 'completed' ? '已完成' : '进行中')}
                      </span>
                      {report.status === 'completed' && !isExpired && (
                        <button
                          className="btn-ghost admin-action-btn"
                          onClick={() => handleDownloadReport(report.item_id)}
                          disabled={generatingId === report.item_id}
                          title="生成并下载报告"
                        >
                          {generatingId === report.item_id ? (
                            <div className="tasks-spinner" style={{ width: 14, height: 14 }} />
                          ) : (
                            <Download size={14} />
                          )}
                        </button>
                      )}
                      <button
                        className="btn-ghost admin-action-btn admin-action-btn--danger"
                        onClick={() => handleDeleteReport(report.item_id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
