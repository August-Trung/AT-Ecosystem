
import React, { useState } from 'react';
import { Filter, ArrowDown, Copy, Check, Trash2 } from 'lucide-react';

const ListExtractor = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [type, setType] = useState<'email' | 'ip' | 'proxy'>('email');
  const [copied, setCopied] = useState(false);

  const extract = () => {
    let regex;
    // Regex Patterns
    if (type === 'email') regex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
    else if (type === 'ip') regex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
    else if (type === 'proxy') regex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}\b/g; // IP:Port

    const matches = input.match(regex || '');
    if (matches) {
        // Unique values only
        const unique = Array.from(new Set(matches));
        setOutput(unique.join('\n'));
    } else {
        setOutput('No matches found.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-end mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Filter className="text-yellow-400" /> List Extractor</h2>
        
        <div className="flex bg-dark-800 p-1 rounded-lg border border-dark-700">
             <button onClick={() => setType('email')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${type === 'email' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}>Email</button>
             <button onClick={() => setType('ip')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${type === 'ip' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}>IP</button>
             <button onClick={() => setType('proxy')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${type === 'proxy' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}>IP:Port</button>
        </div>
      </div>

      <div className="flex-1 grid md:grid-cols-2 gap-6 min-h-0">
         <div className="flex flex-col h-full">
            <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-gray-500">Messy Input</label>
                <button onClick={() => { setInput(''); setOutput(''); }} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 size={12}/> Clear</button>
            </div>
            <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste your mixed content here..."
                className="flex-1 bg-dark-800 border border-dark-700 rounded-xl p-4 text-xs font-mono text-gray-300 focus:outline-none focus:border-yellow-500/50 resize-none"
            />
         </div>

         <div className="flex flex-col h-full relative">
            <div className="absolute top-1/2 -left-3 md:block hidden z-10">
                <div className="bg-dark-900 border border-dark-700 p-2 rounded-full text-yellow-500">
                    <ArrowDown size={16} className="-rotate-90" />
                </div>
            </div>

            <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-gray-500">Clean Output ({output ? output.split('\n').length : 0})</label>
                <button 
                    onClick={() => {
                        navigator.clipboard.writeText(output);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }} 
                    className="text-xs text-yellow-500 hover:text-yellow-400 flex items-center gap-1"
                >
                    {copied ? <Check size={12}/> : <Copy size={12}/>} {copied ? 'Copied' : 'Copy List'}
                </button>
            </div>
            <textarea 
                readOnly
                value={output}
                placeholder="Extracted list will appear here..."
                className="flex-1 bg-dark-900 border border-dark-700 rounded-xl p-4 text-xs font-mono text-yellow-400 focus:outline-none resize-none"
            />
         </div>
      </div>

      <button 
        onClick={extract}
        className="mt-6 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg rounded-xl shadow-lg shadow-yellow-900/20 transition-transform active:scale-95 flex items-center justify-center gap-2"
      >
        <Filter size={24} /> Extract {type === 'proxy' ? 'Proxies' : type.toUpperCase() + 's'}
      </button>
    </div>
  );
};

export default ListExtractor;
