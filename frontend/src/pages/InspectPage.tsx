/**
 * 验货拍照页面 - 核心工作流
 * 按 18 步引导拍照，支持跳过(N/A)、断点续传
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateExcelReport, recordPhotoUpload, skipStepUpload } from '../services/api';
import { getItemProgress } from '../lib/supabase';
import { ALL_STEPS, STEP_GROUPS, type StepConfig } from '../config/steps';
import { compressImage } from '../utils/imageCompress';
import {
  ArrowLeft, Camera, SkipForward, CheckCircle2,
  ChevronLeft, ChevronRight, Image as ImageIcon,
  Loader2, FileCheck, Download,
} from 'lucide-react';
import './InspectPage.css';

interface StepStatus {
  stepId: string;
  status: 'pending' | 'uploaded' | 'skipped';
  imageUrl: string | null;
  localPreview?: string;
}

export default function InspectPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // NOTE: 报告生成成功后保存 URL，用于展示下载链接
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  // 加载步骤进度（断点续传）
  useEffect(() => {
    if (!itemId) return;
    loadProgress(itemId);
  }, [itemId]);

  const loadProgress = async (id: string) => {
    try {
      setLoading(true);
      const progress = await getItemProgress(id);

      const statuses: StepStatus[] = ALL_STEPS.map((step) => {
        const p = progress.find((item: any) => String(item.step_id).trim() === String(step.id).trim());
        return {
          stepId: step.id,
          status: (p?.status as StepStatus['status']) || 'pending',
          imageUrl: p?.image_url || null,
        };
      });
      setStepStatuses(statuses);

      // 自动跳到第一个未完成的步骤
      const firstPending = statuses.findIndex((s) => s.status === 'pending');
      if (firstPending >= 0) {
        setCurrentIdx(firstPending);
      }
    } catch (err) {
      console.error('加载进度失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentStep: StepConfig = ALL_STEPS[currentIdx];
  const currentStatus = stepStatuses[currentIdx];

  // 拍照/选择图片
  const handleCapture = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !itemId) return;

    try {
      setUploading(true);

      // 压缩图片
      const compressed = await compressImage(file);

      // 本地预览
      const previewUrl = URL.createObjectURL(compressed);
      
      // 发送至 Netlify Function 代理上传及记录 (带 30 秒超时)
      const uploadPromise = recordPhotoUpload(itemId, currentStep.id, compressed);
      const timeoutPromise = new Promise<{ publicUrl?: string }>((_, reject) => {
        setTimeout(() => reject(new Error('上传请求超时响应 (可能被拦截挂起)')), 30000);
      });
      const res = await Promise.race([uploadPromise, timeoutPromise]);

      const finalImageUrl = res.publicUrl || previewUrl;

      // 成功后更新本地状态
      setStepStatuses((prev) => {
        const next = [...prev];
        next[currentIdx] = {
          ...next[currentIdx],
          imageUrl: finalImageUrl,
          status: 'uploaded',
        };
        return next;
      });
      
      setErrorMsg(null); // 上传成功清除报错

      // 自动进入下一步
      if (currentIdx < ALL_STEPS.length - 1) {
        setTimeout(() => {
          setCurrentIdx(idx => idx + 1);
        }, 300);
      }
    } catch (err: any) {
      console.error('上传失败:', err);
      setErrorMsg(`上传超时或失败: ${err.message || '未知错误'}`);
    } finally {
      setUploading(false);
      // 重置 input 以允许重复选择
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 跳过步骤
  const handleSkip = async () => {
    if (!itemId) return;
    try {
      setUploading(true);
      await skipStepUpload(itemId, currentStep.id);
      
      // 使用函数式确保总是获取最新状态
      setStepStatuses((prev) => {
        const next = [...prev];
        next[currentIdx] = {
          ...next[currentIdx],
          status: 'skipped',
          imageUrl: null,
          localPreview: undefined,
        };
        return next;
      });
      
      if (currentIdx < ALL_STEPS.length - 1) {
        setTimeout(() => {
          setCurrentIdx(idx => idx + 1);
        }, 300);
      }
    } catch (err: any) {
      console.error('跳过步骤失败:', err);
      setErrorMsg(`跳过失败: ${err.message || '请重试'}`);
    } finally {
      setUploading(false);
    }
  };

  // 生成报告
  const handleGenerateReport = async () => {
    if (!itemId) return;

    // NOTE: 必须在同步点击事件中调用 window.open，否则浏览器会拦截弹窗
    const excelWindow = window.open('about:blank', '_blank');

    try {
      setUploading(true);
      setReportUrl(null);
      const result = await generateExcelReport(itemId);

      if (result.excel_url) {
        setReportUrl(result.excel_url);
        // 将已打开的空白窗口重定向到 Excel 地址
        if (excelWindow && !excelWindow.closed) {
          excelWindow.location.href = result.excel_url;
        }
      } else {
        // 没有返回 URL，关闭空白窗口
        excelWindow?.close();
        setErrorMsg('报告生成成功但未返回下载地址');
      }
    } catch (err: any) {
      excelWindow?.close();
      console.error('生成报告失败:', err);
      setErrorMsg(`生成报告失败: ${err.message || '请重试'}`);
    } finally {
      setUploading(false);
    }
  };

  // 计算已完成数
  const completedCount = stepStatuses.filter(
    (s) => s.status === 'uploaded' || s.status === 'skipped',
  ).length;
  const allDone = completedCount >= ALL_STEPS.length;

  // 获取当前步骤所在分组
  const currentGroup = STEP_GROUPS.find((g) => g.id === currentStep?.group);

  if (loading) {
    return (
      <div className="inspect-loading">
        <div className="tasks-spinner" />
        <p>加载验货进度...</p>
      </div>
    );
  }

  return (
    <div className="inspect-page">
      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden-input"
        onChange={handleFileChange}
      />

      {/* 顶部导航 */}
      <header className="inspect-header glass">
        <div className="inspect-header-inner container">
          <button className="btn-ghost items-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
          </button>
          <div className="inspect-header-center">
            <span className="inspect-step-badge">
              {currentIdx + 1} / {ALL_STEPS.length}
            </span>
          </div>
          <div className="inspect-progress-mini">
            {completedCount}/{ALL_STEPS.length}
          </div>
        </div>

        {/* 整体进度条 */}
        <div className="inspect-progress-bar">
          <div
            className="inspect-progress-fill"
            style={{ width: `${(completedCount / ALL_STEPS.length) * 100}%` }}
          />
        </div>
      </header>

      <main className="inspect-main container">
        {/* 分组标签 */}
        <div className="inspect-group-label">
          {currentGroup?.name}
        </div>

        {/* 错误提示框 */}
        {errorMsg && (
          <div className="inspect-error-alert" onClick={() => setErrorMsg(null)}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* 步骤标题 */}
        <h2 className="inspect-step-title">
          {currentStep.id} {currentStep.title}
        </h2>
        <p className="inspect-step-desc">{currentStep.description}</p>

        {/* 图片区域 */}
        <div className="inspect-image-area">
          {/* 已拍照片 / 参考图 */}
          {(currentStatus?.status === 'uploaded' && (currentStatus.localPreview || currentStatus.imageUrl)) ? (
            <div className="inspect-photo-preview">
              <img
                src={currentStatus.localPreview || currentStatus.imageUrl || ''}
                alt="已拍照片"
                className="inspect-photo-img"
              />
              <div className="inspect-photo-check">
                <CheckCircle2 size={20} />
              </div>
            </div>
          ) : currentStatus?.status === 'skipped' ? (
            <div className="inspect-skipped">
              <SkipForward size={32} />
              <span>已跳过 (N/A)</span>
            </div>
          ) : (
            <div className="inspect-reference">
              <img
                src={currentStep.referenceImage}
                alt={`${currentStep.title} 示例`}
                className="inspect-reference-img"
              />
              <div className="inspect-reference-label">
                <ImageIcon size={14} />
                <span>参考示例图</span>
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮区 */}
        {!allDone ? (
          <div className="inspect-actions">
            <button
              className="btn-primary inspect-capture-btn"
              onClick={handleCapture}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="spin-icon" size={20} />
              ) : (
                <Camera size={20} />
              )}
              <span>{currentStatus?.status === 'uploaded' ? '重新拍照' : '拍照'}</span>
            </button>

            <button
              className="btn-ghost inspect-skip-btn"
              onClick={handleSkip}
              disabled={uploading}
            >
              <SkipForward size={16} />
              <span>跳过 (N/A)</span>
            </button>
          </div>
        ) : (
          <div className="inspect-actions">
            <button
              className="btn-primary inspect-capture-btn"
              onClick={handleGenerateReport}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="spin-icon" size={20} />
              ) : (
                <FileCheck size={20} />
              )}
              <span>生成验货报告</span>
            </button>
            {reportUrl && (
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost inspect-skip-btn"
                style={{ textDecoration: 'none', color: 'var(--primary)' }}
              >
                <Download size={16} />
                <span>点击下载报告</span>
              </a>
            )}
          </div>
        )}

        {/* 步骤导航 */}
        <div className="inspect-nav">
          <button
            className="btn-ghost inspect-nav-btn"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((prev) => prev - 1)}
          >
            <ChevronLeft size={16} />
            上一步
          </button>
          <button
            className="btn-ghost inspect-nav-btn"
            disabled={currentIdx >= ALL_STEPS.length - 1}
            onClick={() => setCurrentIdx((prev) => prev + 1)}
          >
            下一步
            <ChevronRight size={16} />
          </button>
        </div>

        {/* 步骤缩略图列表 */}
        <div className="inspect-thumbs">
          {ALL_STEPS.map((step, idx) => {
            const st = stepStatuses[idx];
            const isActive = idx === currentIdx;
            let thumbCls = 'inspect-thumb';
            if (isActive) thumbCls += ' inspect-thumb--active';
            if (st?.status === 'uploaded') thumbCls += ' inspect-thumb--done';
            if (st?.status === 'skipped') thumbCls += ' inspect-thumb--skipped';

            return (
              <button
                key={step.id}
                className={thumbCls}
                onClick={() => setCurrentIdx(idx)}
                title={`${step.id} ${step.title}`}
              >
                {step.id}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
