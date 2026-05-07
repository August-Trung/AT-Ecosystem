import React, { useState } from 'react';
import { Upload, Cloud, Share2, HardDrive, AlertTriangle, RefreshCw, Copy, ExternalLink } from 'lucide-react';

const FileUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('gofile'); // 'gofile' | 'transfersh' | 'fileio'

  const providers = [
    { id: 'gofile', name: 'Gofile.io', icon: Cloud, desc: 'Best for large files. Persistent.', color: 'text-indigo-400', bg: 'bg-indigo-600/20', border: 'border-indigo-500', limit: 'Unlimited Size' },
    { id: 'transfersh', name: 'Transfer.sh', icon: Share2, desc: 'Reliable. 14 days storage.', color: 'text-blue-400', bg: 'bg-blue-600/20', border: 'border-blue-500', limit: 'Max 10GB' },
    { id: 'fileio', name: 'File.io', icon: HardDrive, desc: 'One-time download. Auto delete.', color: 'text-pink-400', bg: 'bg-pink-600/20', border: 'border-pink-500', limit: 'Max 2GB (Free)' }
  ];

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setLink('');
    setError('');
    
    try {
      if (provider === 'gofile') {
        // Gofile Strategy
        const serverRes = await fetch('https://api.gofile.io/getServer');
        const serverData = await serverRes.json();
        
        if (serverData.status !== 'ok') throw new Error('Gofile Servers Busy');
        const server = serverData.data.server;
        
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadRes = await fetch(`https://${server}.gofile.io/uploadFile`, {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        
        if (uploadData.status === 'ok') {
          setLink(uploadData.data.downloadPage);
        } else {
          throw new Error('Upload Failed');
        }

      } else if (provider === 'transfersh') {
        // Transfer.sh Strategy (PUT request, usually CORS friendly)
        // Note: Filename must be part of URL
        const res = await fetch(`https://transfer.sh/${file.name}`, {
          method: 'PUT',
          body: file
        });
        
        if (res.ok) {
          const text = await res.text();
          setLink(text.trim());
        } else {
          throw new Error('Transfer.sh Error');
        }

      } else if (provider === 'fileio') {
        // File.io Strategy (POST FormData)
        const formData = new FormData();
        formData.append('file', file);
        // Note: Expires defaults to 14 days or 1 download
        const res = await fetch('https://file.io', {
          method: 'POST',
          body: formData
        });
        
        if (res.ok) {
           const data = await res.json();
           if (data.success) {
             setLink(data.link);
           } else {
             throw new Error(data.message || 'File.io Error');
           }
        } else {
          throw new Error('File.io Error');
        }
      }
    } catch(e) { 
        console.error(e);
        setError(`Upload failed (${provider}). If using AdBlock, please disable it and try again.`); 
    } finally {
        setLoading(false);
    }
  };

  const activeProvider = providers.find(p => p.id === provider);

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Upload className="text-indigo-500" /> Secure File Share</h2>
      
      {/* Provider Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
         {providers.map((p) => (
           <div 
             key={p.id}
             onClick={() => setProvider(p.id)}
             className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between h-full ${provider === p.id ? `${p.bg} ${p.border} ring-1 ring-opacity-50` : 'bg-dark-800 border-dark-700 hover:bg-dark-700'}`}
           >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p.icon size={20} className={provider === p.id ? p.color : 'text-gray-500'} />
                  <span className={`font-bold ${provider === p.id ? 'text-white' : 'text-gray-300'}`}>{p.name}</span>
                </div>
                <p className="text-xs text-gray-400">{p.desc}</p>
              </div>
              {provider === p.id && <div className={`w-2 h-2 rounded-full ${p.color.replace('text', 'bg')} mt-2 self-end animate-pulse`}></div>}
           </div>
         ))}
      </div>
      
      <div className="bg-dark-800 p-8 rounded-2xl border border-dark-700 shadow-xl">
        <div className="space-y-6">
          <label className="block relative group cursor-pointer">
            <span className="sr-only">Choose file</span>
            <div className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors ${file ? 'border-green-500/50 bg-green-500/5' : 'border-dark-600 hover:border-indigo-500 hover:bg-dark-700/50'}`}>
              <Upload size={32} className={`mb-3 ${file ? 'text-green-500' : 'text-gray-500 group-hover:text-indigo-400'}`} />
              <p className="font-bold text-gray-200">{file ? file.name : 'Click to Select File'}</p>
              <p className="text-xs text-gray-500 mt-1">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : activeProvider?.limit || 'Max 100MB'}</p>
            </div>
            <input 
              type="file" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
          
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2 animate-in fade-in">
              <AlertTriangle size={16} className="flex-shrink-0" /> 
              <span>{error}</span>
            </div>
          )}
          
          <button 
            onClick={upload}
            disabled={!file || loading}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2
              ${loading 
                ? 'bg-dark-700 cursor-wait' 
                : `bg-gradient-to-r ${provider === 'gofile' ? 'from-indigo-600 to-indigo-500' : provider === 'transfersh' ? 'from-blue-600 to-blue-500' : 'from-pink-600 to-pink-500'} hover:opacity-90`
              }
              ${(!file || loading) ? 'opacity-50' : ''}
            `}
          >
            {loading ? <RefreshCw className="animate-spin" /> : <Upload size={20} />}
            {loading ? 'Uploading...' : `Upload to ${activeProvider?.name}`}
          </button>

          {link && (
            <div className="bg-dark-900 p-6 rounded-xl border border-dark-600 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Your Download Link</span>
              <div className="flex items-center gap-2 bg-black/30 p-3 rounded-lg border border-dark-700">
                 <input readOnly value={link} className="flex-1 bg-transparent text-white font-mono outline-none text-sm" />
                 <button onClick={() => navigator.clipboard.writeText(link)} className="p-2 hover:bg-dark-700 rounded-lg text-gray-400 hover:text-white transition-colors"><Copy size={18}/></button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <a href={link} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                   Open Link <ExternalLink size={12}/>
                </a>
                <span className="text-xs text-gray-600 italic">
                  {provider === 'transfersh' ? 'Expires in 14 days' : provider === 'fileio' ? 'Auto-delete after download' : 'Persistent Storage'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;