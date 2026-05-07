import React, { useRef, useState } from 'react';
import { Camera, Copy, Check } from 'lucide-react';
import { useI18n } from '../i18n';

type PhotoInfo = {
  name: string;
  size: number;
  type: string;
  width: number;
  height: number;
};

const PhotographyTool = () => {
  const { t } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<PhotoInfo | null>(null);
  const [renamePrefix, setRenamePrefix] = useState('photo');
  const [startIndex, setStartIndex] = useState(1);
  const [padding, setPadding] = useState(3);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    setFiles(list);
    if (list.length > 0) {
      const file = list[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          setSelected({
            name: file.name,
            size: file.size,
            type: file.type,
            width: img.width,
            height: img.height,
          });
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const stripMetadata = async () => {
    if (!files[0]) return;
    const file = files[0];
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.readAsDataURL(file);
    });
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const cleaned = canvas.toDataURL('image/jpeg', 0.92);
      const link = document.createElement('a');
      link.download = `clean_${file.name.replace(/\.[^.]+$/, '')}.jpg`;
      link.href = cleaned;
      link.click();
    };
  };

  const renameList = files.map((file, idx) => {
    const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
    const index = (startIndex + idx).toString().padStart(padding, '0');
    return `${renamePrefix}_${index}${ext ? `.${ext}` : ''}`;
  });

  const copyRename = () => {
    navigator.clipboard.writeText(renameList.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Camera className="text-amber-400" /> {t('Photography', 'Photography')}
      </h2>

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          className="block w-full text-sm text-gray-400"
        />
        <canvas ref={canvasRef} className="hidden" />

        {selected && (
          <div className="mt-4 bg-dark-900 border border-dark-700 rounded-lg p-3 text-xs text-gray-400">
            <div>{t('Name', 'Tên')}: {selected.name}</div>
            <div>{t('Size', 'Dung lượng')}: {(selected.size / 1024).toFixed(1)} KB</div>
            <div>{t('Type', 'Định dạng')}: {selected.type || t('unknown', 'không rõ')}</div>
            <div>{t('Dimensions', 'Kích thước')}: {selected.width} x {selected.height}</div>
            <button
              onClick={stripMetadata}
              className="mt-3 px-4 py-2 bg-amber-500 text-black font-bold rounded-lg hover:bg-amber-400"
            >
              {t('Strip Metadata (re-encode)', 'Xóa metadata (re-encode)')}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 bg-dark-800 border border-dark-700 rounded-xl p-4">
        <h3 className="text-sm font-bold text-gray-400 mb-3">
          {t('Batch Rename Preview', 'Xem trước đổi tên hàng loạt')}
        </h3>
        <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-400">
          <label className="flex items-center gap-2">
            {t('Prefix', 'Tiền tố')}
            <input
              value={renamePrefix}
              onChange={(e) => setRenamePrefix(e.target.value)}
              className="bg-dark-900 border border-dark-700 rounded px-2 py-1 text-gray-200"
            />
          </label>
          <label className="flex items-center gap-2">
            {t('Start', 'Bắt đầu')}
            <input
              type="number"
              value={startIndex}
              onChange={(e) => setStartIndex(Number(e.target.value))}
              className="w-16 bg-dark-900 border border-dark-700 rounded px-2 py-1 text-gray-200"
            />
          </label>
          <label className="flex items-center gap-2">
            {t('Padding', 'Độ dài số')}
            <input
              type="number"
              value={padding}
              onChange={(e) => setPadding(Number(e.target.value))}
              className="w-16 bg-dark-900 border border-dark-700 rounded px-2 py-1 text-gray-200"
            />
          </label>
          <button
            onClick={copyRename}
            disabled={renameList.length === 0}
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 disabled:opacity-50"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {t('Copy List', 'Sao chép danh sách')}
          </button>
        </div>
        <textarea
          readOnly
          value={renameList.join('\n')}
          className="w-full h-40 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-amber-300"
          spellCheck={false}
        />
        <div className="text-xs text-gray-500 mt-2">
          {t('Use the list to rename files in your OS or batch renamer.', 'Dùng danh sách để đổi tên file bằng hệ điều hành hoặc công cụ khác.')}
        </div>
      </div>
    </div>
  );
};

export default PhotographyTool;
