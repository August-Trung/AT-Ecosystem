import React, { useState } from 'react';
import { Scan, Image as ImageIcon, Check, ExternalLink } from 'lucide-react';

const QRScanner = () => {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Size check
    if (file.size > 2 * 1024 * 1024) {
      setError('File too large. Max 2MB.');
      return;
    }

    setScanning(true);
    setError(null);
    setResult(null);

    // Prefer native BarcodeDetector if available
    if ('BarcodeDetector' in window) {
      try {
        // @ts-ignore
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const bitmap = await createImageBitmap(file);
        const boxes = await detector.detect(bitmap);
        if (boxes.length > 0) {
          setResult(boxes[0].rawValue);
          setScanning(false);
          return;
        } 
      } catch (err) {
        console.warn('Native scanner failed', err);
      }
    }
    
    // Fallback to API
    fallbackScan(file);
  };

  const fallbackScan = async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
          method: 'POST',
          body: formData,
          referrerPolicy: 'no-referrer'
        });
        
        if (!res.ok) throw new Error("API Error");

        const data = await res.json();
        if(data && data[0] && data[0].symbol && data[0].symbol[0].data) {
           setResult(data[0].symbol[0].data);
        } else {
           setError('Could not decode QR. Try a clearer image.');
        }
      } catch (err) {
        setError('Scanner service unavailable or connection failed.');
      } finally {
        setScanning(false);
      }
  }

  return (
     <div className="max-w-2xl mx-auto text-center">
       <h2 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2"><Scan className="text-purple-500" /> QR Scanner</h2>
       
       <div className="bg-dark-800 p-10 rounded-2xl border-2 border-dashed border-dark-600 hover:border-purple-500 transition-colors group relative overflow-hidden">
         <input 
           type="file" 
           accept="image/*" 
           onChange={handleFileUpload}
           className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
           id="qr-upload"
         />
         <div className="flex flex-col items-center gap-4 group-hover:scale-105 transition-transform">
           <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
             <ImageIcon size={40} />
           </div>
           <div>
             <p className="text-xl font-bold text-white">Upload QR Image</p>
             <p className="text-sm text-gray-500">Drop or click to browse</p>
           </div>
         </div>
       </div>

       {scanning && <div className="mt-6 text-purple-400 animate-pulse font-mono">Decoding image...</div>}
       
       {result && (
         <div className="mt-8 bg-gradient-to-br from-green-900/40 to-dark-800 border border-green-500/30 p-6 rounded-xl break-all shadow-lg animate-in fade-in slide-in-from-bottom-4">
           <div className="flex items-center justify-between mb-2">
             <h3 className="text-green-500 font-bold flex items-center gap-2"><Check size={18} /> Scanned Result</h3>
             <button onClick={() => navigator.clipboard.writeText(result)} className="text-xs bg-green-500/20 hover:bg-green-500/40 text-green-400 px-2 py-1 rounded transition-colors">Copy</button>
           </div>
           <p className="text-white font-mono text-lg bg-black/20 p-4 rounded-lg">{result}</p>
           {result.startsWith('http') && (
             <a href={result} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
               Open Link <ExternalLink size={14}/>
             </a>
           )}
         </div>
       )}
       {error && (
         <div className="mt-8 bg-red-900/20 border border-red-500/50 p-4 rounded-xl text-red-400">
           {error}
         </div>
       )}
     </div>
  );
};

export default QRScanner;