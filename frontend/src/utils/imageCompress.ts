/**
 * 图片压缩工具
 * 将拍摄的照片压缩至 1280px 宽度、70% 质量
 * 避免大容量图片导致上传缓慢
 */

const MAX_WIDTH = 1280;
const QUALITY = 0.7;

/**
 * 压缩图片文件
 * @param file 原始图片文件
 * @returns 压缩后的 Blob
 */
export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // 等比缩放至最大宽度
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 上下文创建失败'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size > 0) {
              resolve(blob);
            } else {
              console.warn('Canvas toBlob 返回了空数据，尝试直接返回原生 File');
              resolve(file); // 优雅降级，如果不成功返回原图
            }
          },
          'image/jpeg',
          QUALITY,
        );
      };
      
      img.onerror = () => {
        console.error('Image 实例加载原始图像失败');
        reject(new Error('图片加载失败'));
      };
      
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      console.error('FileReader 读取失败');
      reject(new Error('文件读取失败'));
    };
    
    reader.readAsDataURL(file);
  });
}
