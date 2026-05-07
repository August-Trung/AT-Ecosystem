import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, ChevronDown, AlertTriangle, Check, Copy, ExternalLink, Clock, Trash2 } from 'lucide-react';
import { ShortenedLink } from '../../types';

const UrlShortener = () => {
  const [url, setUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState('is.gd'); // 'is.gd' | 'v.gd' | 'tinyurl'
  const [history, setHistory] = useState<ShortenedLink[]>([]);

  const providers = [
    { id: 'is.gd', name: 'is.gd (Direct)', color: 'text-neon-green' },
    { id: 'v.gd', name: 'v.gd (Direct)', color: 'text-yellow-400' },
    { id: 'tinyurl', name: 'TinyURL (Backup)', color: 'text-blue-400' },
  ];

  // Load History
  useEffect(() => {
    const saved = localStorage.getItem('at_url_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history");
      }
    }
  }, []);

  const saveToHistory = (original: string, short: string, provider: string) => {
    const newLink: ShortenedLink = {
      id: Date.now().toString(),
      original,
      short,
      provider,
      createdAt: Date.now()
    };
    const newHistory = [newLink, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem('at_url_history', JSON.stringify(newHistory));
  };

  const deleteFromHistory = (id: string) => {
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('at_url_history', JSON.stringify(newHistory));
  };

  const shorten = async () => {
    if(!url) return;
    setLoading(true);
    setShortUrl('');
    setError('');
    
    // Validate URL basics
    let targetUrl = url;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'http://' + targetUrl;
    }

    try {
      let result = '';

      if (provider === 'is.gd' || provider === 'v.gd') {
        // is.gd and v.gd do not support CORS, so we must use a proxy.
        // We use allorigins.win raw API which is stable for text responses.
        const apiUrl = `https://${provider}/create.php?format=simple&url=${encodeURIComponent(targetUrl)}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`;
        
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error('Service unreachable');
        const text = await res.text();
        
        if (text.startsWith('http')) {
          result = text;
        } else {
          throw new Error('Invalid URL or Service Error');
        }
      } else {
        // TinyURL supports CORS natively
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(targetUrl)}`, {
           referrerPolicy: 'no-referrer'
        });
        if (res.ok) {
          const text = await res.text();
          if (text === 'Error') throw new Error('Invalid URL');
          result = text;
        } else {
          throw new Error('TinyURL Error');
        }
      }
      
      setShortUrl(result);
      saveToHistory(targetUrl, result, provider);

    } catch (e) {
      console.error(e);
      setError('Network error. Check your URL or AdBlock.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto text-center">
      <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2"><LinkIcon className="text-neon-cyan" /> URL Shortener</h2>
      <p className="text-gray-400 mb-8 text-sm">Create direct, tracking-free short links.</p>

      <div className="flex flex-col sm:flex-row gap-3 mb-6 bg-dark-800 p-2 rounded-xl border border-dark-700">
        {/* Provider Select */}
        <div className="relative min-w-[140px]">
          <select 
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full h-full bg-dark-900 border border-dark-600 text-white rounded-lg pl-3 pr-8 py-3 appearance-none outline-none focus:border-neon-cyan cursor-pointer font-bold text-sm"
          >
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
        </div>

        <input 
          type="url" 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste long URL here..."
          className="flex-1 bg-dark-900 border border-dark-600 rounded-lg p-3 focus:border-neon-cyan outline-none transition-all text-white"
          onKeyDown={(e) => e.key === 'Enter' && shorten()}
        />
        
        <button 
          onClick={shorten}
          disabled={loading}
          className="px-6 py-3 bg-neon-cyan text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? '...' : 'Shorten'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center justify-center gap-2 animate-in fade-in">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {shortUrl && (
        <div className="bg-dark-800 p-6 rounded-xl border border-neon-cyan/30 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-4 shadow-lg shadow-neon-cyan/5 mb-8">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider text-left">Your Short Link</span>
          <div className="flex items-center gap-2">
            <input 
              readOnly 
              value={shortUrl} 
              className="flex-1 bg-dark-900 border border-dark-700 rounded-lg p-3 text-neon-cyan font-mono text-lg outline-none"
            />
            <button 
              onClick={() => copyToClipboard(shortUrl)}
              className={`p-3 rounded-lg transition-colors text-white font-bold flex items-center gap-2 ${copied ? 'bg-green-500/20 text-green-500' : 'bg-dark-700 hover:bg-dark-600'}`}
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
            <a 
              href={shortUrl} 
              target="_blank" 
              rel="noreferrer"
              className="p-3 bg-dark-700 hover:bg-dark-600 rounded-lg text-white transition-colors"
              title="Test Link"
            >
              <ExternalLink size={20} />
            </a>
          </div>
          <p className="text-xs text-left text-gray-500 mt-1">
             Provider: <span className="text-white font-bold">{provider}</span> • 
             {provider !== 'tinyurl' ? ' Direct Redirect' : ' May have preview'}
          </p>
        </div>
      )}

      {/* History Section */}
      {history.length > 0 && (
        <div className="text-left mt-8">
           <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-gray-300"><Clock size={18}/> Recent Links</h3>
           <div className="space-y-3">
             {history.map(item => (
               <div key={item.id} className="bg-dark-800 border border-dark-700 p-3 rounded-xl flex items-center justify-between group hover:border-gray-600 transition-colors">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <a href={item.short} target="_blank" rel="noreferrer" className="text-neon-cyan font-mono font-bold hover:underline truncate">{item.short}</a>
                      <span className="text-xs bg-dark-700 px-1.5 py-0.5 rounded text-gray-400">{item.provider}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate" title={item.original}>{item.original}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(item.short);
                        // Optional: Visual feedback specific to this button could be added here
                      }}
                      className="p-2 text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg"
                      title="Copy"
                    >
                      <Copy size={16}/>
                    </button>
                    <button 
                      onClick={() => deleteFromHistory(item.id)}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-dark-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete"
                    >
                       <Trash2 size={16}/>
                    </button>
                  </div>
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default UrlShortener;