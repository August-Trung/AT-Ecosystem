
import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Download, Upload, Sliders } from 'lucide-react';

const ImageTools = () => {
  const [image, setImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [format, setFormat] = useState('image/jpeg');
  const [quality, setQuality] = useState(0.8);
  const [width, setWidth] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                setImage(ev.target?.result as string);
                setWidth(img.width);
                setProcessedImage(null); // Reset prev result
            };
            img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
    }
  };

  const processImage = () => {
    if (!image) return;
    setLoading(true);
    
    setTimeout(() => {
        const canvas = canvasRef.current;
        const img = new Image();
        img.src = image;
        
        img.onload = () => {
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            // Calculate height keeping aspect ratio
            const aspectRatio = img.height / img.width;
            const newHeight = width * aspectRatio;

            canvas.width = width;
            canvas.height = newHeight;

            if (ctx) {
                // Fill white background for JPEGs (remove transparency)
                if (format === 'image/jpeg') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                ctx.drawImage(img, 0, 0, width, newHeight);
                
                const dataUrl = canvas.toDataURL(format, quality);
                setProcessedImage(dataUrl);
                setLoading(false);
            }
        };
    }, 100);
  };

  const download = () => {
    if (!processedImage) return;
    const ext = format.split('/')[1];
    const link = document.createElement('a');
    link.download = `converted_image.${ext}`;
    link.href = processedImage;
    link.click();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><ImageIcon className="text-pink-500" /> Image Converter & Compressor</h2>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Controls */}
        <div className="space-y-6">
            <div className="bg-dark-800 p-6 rounded-xl border border-dark-700">
                <label className="block w-full cursor-pointer bg-dark-900 border-2 border-dashed border-dark-600 hover:border-pink-500 rounded-xl p-8 text-center transition-colors group">
                    <Upload className="mx-auto mb-2 text-gray-500 group-hover:text-pink-500" />
                    <span className="text-sm font-bold text-gray-400">Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                </label>
            </div>

            {image && (
                <div className="bg-dark-800 p-6 rounded-xl border border-dark-700 space-y-4 animate-in fade-in">
                    <h3 className="font-bold flex items-center gap-2 text-white"><Sliders size={18}/> Settings</h3>
                    
                    <div>
                        <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Format</label>
                        <select 
                            value={format} 
                            onChange={(e) => setFormat(e.target.value)}
                            className="w-full bg-dark-900 border border-dark-600 rounded-lg p-2 text-white outline-none"
                        >
                            <option value="image/jpeg">JPG (JPEG)</option>
                            <option value="image/png">PNG</option>
                            <option value="image/webp">WebP (Modern)</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Quality ({Math.round(quality * 100)}%)</label>
                        <input 
                            type="range" min="0.1" max="1" step="0.1" 
                            value={quality} 
                            onChange={(e) => setQuality(parseFloat(e.target.value))}
                            className="w-full accent-pink-500"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Width (px)</label>
                        <input 
                            type="number"
                            value={width}
                            onChange={(e) => setWidth(parseInt(e.target.value))}
                            className="w-full bg-dark-900 border border-dark-600 rounded-lg p-2 text-white outline-none"
                        />
                    </div>

                    <button 
                        onClick={processImage}
                        disabled={loading}
                        className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl transition-colors"
                    >
                        {loading ? 'Processing...' : 'Convert / Compress'}
                    </button>
                </div>
            )}
        </div>

        {/* Preview Area */}
        <div className="md:col-span-2 bg-dark-900/50 rounded-xl border border-dark-700 p-8 flex flex-col items-center justify-center relative min-h-[400px]">
            {!image && <div className="text-gray-600 text-center">Preview will appear here</div>}
            
            {/* Hidden Canvas for Processing */}
            <canvas ref={canvasRef} className="hidden" />

            {processedImage ? (
                <div className="w-full flex flex-col items-center animate-in zoom-in">
                    <img src={processedImage} alt="Result" className="max-h-[400px] object-contain rounded-lg border border-dark-600 shadow-xl mb-6" />
                    <button 
                        onClick={download}
                        className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-lg shadow-white/10"
                    >
                        <Download size={20} /> Download Result
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

export default ImageTools;
