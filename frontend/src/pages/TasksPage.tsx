import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { generateReport } from '../services/api';
import type { Order } from '../services/api';
import { getOrders, getOrderItems } from '../lib/supabase';
import {
  ClipboardList, Package, CheckCircle2, Clock,
  LogOut, ChevronRight, AlertCircle, Download,
} from 'lucide-react';
import './TasksPage.css';

export default function TasksPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.factoryName) {
      loadTasks();
    }
  }, [user]);

  const handleDownloadReports = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    try {
      setDownloadingOrderId(orderId);
      const items = await getOrderItems(orderId);
      const completedItems = items.filter((item) => item.status === 'completed');
      if (completedItems.length === 0) {
        alert('没有已完成的货号可供下载');
        return;
      }
      for (const item of completedItems) {
        const result = await generateReport(item.id);
        if (result.pdf_url) {
          window.open(result.pdf_url, '_blank');
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '下载报告失败');
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError('');
      // 管理员查看所有订单，普通用户只看自己工厂的
      const data = user?.isAdmin
        ? await getOrders('')
        : await getOrders(user?.factoryName || '');
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle2, label: '已完成', cls: 'status-badge--success' };
      case 'in_progress':
        return { icon: Clock, label: '进行中', cls: 'status-badge--progress' };
      default:
        return { icon: AlertCircle, label: '待验货', cls: 'status-badge--pending' };
    }
  };

  return (
    <div className="tasks-page">
      {/* 顶部导航 */}
      <header className="tasks-header glass">
        <div className="tasks-header-inner container">
          <div className="tasks-header-left">
            <img src="/brand/Howstoday logo  orange.png" alt="HOWSTODAY" className="tasks-logo" />
          </div>
          <div className="tasks-header-right">
            <span className="tasks-user-name">{user?.factoryName}</span>
            <button className="btn-ghost tasks-logout-btn" onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="tasks-main container">
        <div className="tasks-title-row">
          <ClipboardList size={24} className="tasks-title-icon" />
          <h1 className="tasks-title">验货任务</h1>
        </div>

        {loading && (
          <div className="tasks-loading">
            <div className="tasks-spinner" />
            <p>加载中...</p>
          </div>
        )}

        {error && (
          <div className="login-error" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="tasks-empty">
            <Package size={48} strokeWidth={1.2} />
            <p>暂无验货任务</p>
          </div>
        )}

        <div className="tasks-list">
          {orders.map((order) => {
            const statusCfg = getStatusConfig(order.status);
            const StatusIcon = statusCfg.icon;
            const progress = order.item_count > 0
              ? Math.round((order.completed_items / order.item_count) * 100)
              : 0;

            return (
              <div
                key={order.id}
                className="task-card card"
                onClick={() => navigate(`/orders/${order.id}/items`)}
              >
                <div className="task-card-top">
                  <div className="task-card-info">
                    <h3 className="task-card-order">{order.order_number}</h3>
                    <p className="task-card-date">{order.inspection_date}</p>
                  </div>
                  <span className={`status-badge ${statusCfg.cls}`}>
                    <StatusIcon size={12} />
                    {statusCfg.label}
                  </span>
                </div>

                <div className="task-card-progress">
                  <div className="task-progress-bar">
                    <div
                      className="task-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="task-progress-text">
                    {order.completed_items}/{order.item_count} 货号
                  </span>
                </div>

                <div className="task-card-arrow">
                  {statusCfg.label === '已完成' && (
                    <button
                      className="btn-ghost task-download-btn"
                      style={{ marginRight: '8px', zIndex: 10, position: 'relative' }}
                      onClick={(e) => handleDownloadReports(e, order.id)}
                      disabled={downloadingOrderId === order.id}
                      title="下载报告"
                    >
                      {downloadingOrderId === order.id ? (
                        <div className="tasks-spinner" style={{ width: 14, height: 14 }} />
                      ) : (
                        <Download size={18} />
                      )}
                    </button>
                  )}
                  <ChevronRight size={20} />
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
