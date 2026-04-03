/**
 * 货号列表页面
 * 展示某订单下所有货号及验货进度
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { OrderItem } from '../services/api';
import { generateReport } from '../services/api';
import { getOrderItems } from '../lib/supabase';
import {
  ArrowLeft, Package, CheckCircle2, Clock,
  AlertCircle, ChevronRight, Camera, Download,
} from 'lucide-react';
import './ItemsPage.css';

export default function ItemsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      loadItems(orderId);
    }
  }, [orderId]);

  const loadItems = async (id: string) => {
    try {
      setLoading(true);
      const data = await getOrderItems(id);
      setItems(data);
    } catch (err) {
      console.error('加载货号失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle2, label: '已完成', cls: 'status-badge--success' };
      case 'in_progress':
        return { icon: Clock, label: '验货中', cls: 'status-badge--progress' };
      default:
        return { icon: AlertCircle, label: '待开始', cls: 'status-badge--pending' };
    }
  };

  const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null);

  const handleDownloadReport = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    try {
      setDownloadingItemId(itemId);
      const result = await generateReport(itemId);
      if (result.pdf_url) {
        window.open(result.pdf_url, '_blank');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '生成报告失败');
    } finally {
      setDownloadingItemId(null);
    }
  };

  return (
    <div className="items-page">
      <header className="items-header glass">
        <div className="items-header-inner container">
          <button className="btn-ghost items-back-btn" onClick={() => navigate('/tasks')}>
            <ArrowLeft size={18} />
          </button>
          <h2 className="items-header-title">货号列表</h2>
          <div style={{ width: 40 }} />
        </div>
      </header>

      <main className="items-main container">
        {loading ? (
          <div className="tasks-loading">
            <div className="tasks-spinner" />
            <p>加载中...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="tasks-empty">
            <Package size={48} strokeWidth={1.2} />
            <p>暂无货号</p>
          </div>
        ) : (
          <div className="items-list">
            {items.map((item, idx) => {
              const statusCfg = getStatusConfig(item.status);
              const StatusIcon = statusCfg.icon;
              const progress = item.total_steps > 0
                ? Math.round((item.completed_steps / item.total_steps) * 100)
                : 0;

              return (
                <div
                  key={item.id}
                  className="item-card card"
                  onClick={() => navigate(`/inspect/${item.id}`)}
                >
                  <div className="item-card-index">{idx + 1}</div>
                  <div className="item-card-body">
                    <div className="item-card-top">
                      <h3 className="item-card-name">{item.model_name}</h3>
                      <span className={`status-badge ${statusCfg.cls}`}>
                        <StatusIcon size={12} />
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="task-card-progress">
                      <div className="task-progress-bar">
                        <div className="task-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="task-progress-text">
                        {item.completed_steps}/{item.total_steps} 步
                      </span>
                    </div>
                    {item.status !== 'completed' && (
                      <div className="item-card-action">
                        <Camera size={14} />
                        <span>{item.status === 'in_progress' ? '继续验货' : '开始验货'}</span>
                      </div>
                    )}
                  </div>
                  <div className="task-card-arrow">
                    {item.status === 'completed' && (
                      <button
                        className="btn-ghost task-download-btn"
                        style={{ marginRight: '8px', zIndex: 10, position: 'relative' }}
                        onClick={(e) => handleDownloadReport(e, item.id)}
                        disabled={downloadingItemId === item.id}
                        title="下载报告"
                      >
                        {downloadingItemId === item.id ? (
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
        )}
      </main>
    </div>
  );
}
