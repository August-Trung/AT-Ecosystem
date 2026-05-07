
import React, { useState } from 'react';
import { Smartphone, Monitor, RefreshCw, Copy, Check, Laptop } from 'lucide-react';

const UAS = {
  windows: [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  ],
  mac: [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0"
  ],
  ios: [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1"
  ],
  android: [
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
  ]
};

const UserAgentGen = () => {
  const [os, setOs] = useState<'windows' | 'mac' | 'ios' | 'android'>('windows');
  const [ua, setUa] = useState(UAS['windows'][0]);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const list = UAS[os];
    const random = list[Math.floor(Math.random() * list.length)];
    setUa(random);
  };

  const copy = () => {
    navigator.clipboard.writeText(ua);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Smartphone className="text-purple-400" /> User Agent Generator</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
            { id: 'windows', icon: Monitor, label: 'Windows' },
            { id: 'mac', icon: Laptop, label: 'macOS' },
            { id: 'ios', icon: Smartphone, label: 'iOS' },
            { id: 'android', icon: Smartphone, label: 'Android' }
        ].map(type => (
            <button
                key={type.id}
                onClick={() => {
                    setOs(type.id as any);
                    const list = UAS[type.id as keyof typeof UAS];
                    setUa(list[0]);
                }}
                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${os === type.id ? 'bg-purple-500/20 border-purple-500 text-white' : 'bg-dark-800 border-dark-700 text-gray-500 hover:bg-dark-700'}`}
            >
                <type.icon size={24} />
                <span className="font-bold text-sm">{type.label}</span>
            </button>
        ))}
      </div>

      <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 shadow-xl relative">
        <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Generated User Agent String</label>
        <textarea 
            readOnly
            value={ua}
            className="w-full bg-dark-900 border border-dark-600 rounded-xl p-4 text-gray-300 font-mono text-sm leading-relaxed outline-none focus:border-purple-500 transition-colors h-32 resize-none"
        />
        
        <div className="flex gap-4 mt-4">
            <button 
                onClick={generate}
                className="flex-1 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
                <RefreshCw size={18} /> Randomize
            </button>
            <button 
                onClick={copy}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-purple-900/20"
            >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy UA'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default UserAgentGen;
