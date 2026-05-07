import React, { useRef, useState } from 'react';
import { Palette, Upload, Download, Sliders } from 'lucide-react';
import { useI18n } from '../i18n';

const DesignCreativeTool = () => {
  const { t } = useI18n();
  const [image, setImage] = useState<string | null>(null);
  const [processed, setProcessed] = useState<string | null>(null);
  const [format, setFormat] = useState('image/jpeg');
  const [quality, setQuality] = useState(0.85);
  const [width, setWidth] = useState(0);
  const [watermark, setWatermark] = useState('© Your Brand');
  const [opacity, setOpacity] = useState(0.6);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setImage(ev.target?.result as string);
        setWidth(img.width);
        setProcessed(null);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const processImage = () => {
    if (!image || !width) return;
    setLoading(true);
    const img = new Image();
    img.src = image;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const aspect = img.height / img.width;
      const height = Math.round(width * aspect);
      canvas.width = width;
      canvas.height = height;
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, width, height);

      if (watermark.trim()) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(14, Math.round(width * 0.02))}px sans-serif`;
        const padding = 16;
        const metrics = ctx.measureText(watermark);
        const x = width - metrics.width - padding;
        const y = height - padding;
        ctx.fillText(watermark, x, y);
        ctx.restore();
      }

      const dataUrl = canvas.toDataURL(format, quality);
      setProcessed(dataUrl);
      setLoading(false);
    };
  };

  const download = () => {
    if (!processed) return;
    const ext = format.split('/')[1];
    const link = document.createElement('a');
    link.download = `creative_export.${ext}`;
    link.href = processed;
    link.click();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Palette className="text-pink-400" /> {t('Design & Creative', 'Thiết kế & Sáng tạo')}
      </h2>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
            <label className="block w-full cursor-pointer bg-dark-900 border-2 border-dashed border-dark-600 hover:border-pink-500 rounded-xl p-8 text-center transition-colors group">
              <Upload className="mx-auto mb-2 text-gray-500 group-hover:text-pink-500" />
              <span className="text-sm font-bold text-gray-400">
                {t('Upload Image', 'Tải ảnh')}
              </span>
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
          </div>

          {image && (
            <div className="bg-dark-800 p-6 rounded-xl border border-dark-700 space-y-4 animate-in fade-in">
              <h3 className="font-bold flex items-center gap-2 text-white">
                <Sliders size={18} /> {t('Settings', 'Cài đặt')}
              </h3>
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase block mb-1">
                  {t('Format', 'Định dạng')}
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg p-2 text-white outline-none"
                >
                  <option value="image/jpeg">JPG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WebP</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase block mb-1">
                  {t('Quality', 'Chất lượng')} ({Math.round(quality * 100)}%)
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase block mb-1">
                  {t('Width (px)', 'Chiều rộng (px)')}
                </label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value))}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg p-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase block mb-1">
                  {t('Watermark', 'Watermark')}
                </label>
                <input
                  value={watermark}
                  onChange={(e) => setWatermark(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-600 rounded-lg p-2 text-white outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase block mb-1">
                  {t('Opacity', 'Độ mờ')} ({Math.round(opacity * 100)}%)
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-pink-500"
                />
              </div>
              <button
                onClick={processImage}
                disabled={loading}
                className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl transition-colors"
              >
                {loading ? t('Processing...', 'Đang xử lý...') : t('Export Image', 'Xuất ảnh')}
              </button>
            </div>
          )}
        </div>

        <div className="md:col-span-2 bg-dark-900/50 rounded-xl border border-dark-700 p-8 flex flex-col items-center justify-center relative min-h-[400px]">
          {!image && (
            <div className="text-gray-600 text-center">
              {t('Preview will appear here', 'Xem trước sẽ hiển thị ở đây')}
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
          {processed ? (
            <div className="w-full flex flex-col items-center animate-in zoom-in">
              <img src={processed} alt="Result" className="max-h-[400px] object-contain rounded-lg border border-dark-600 shadow-xl mb-6" />
              <button
                onClick={download}
                className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-lg shadow-white/10"
              >
                <Download size={20} /> {t('Download Result', 'Tải kết quả')}
              </button>
            </div>
          ) : (
            image && <img src={image} alt="Original" className="max-h-[300px] object-contain opacity-50 grayscale" />
          )}
        </div>
      </div>
    </div>
  );
};

export default DesignCreativeTool;
