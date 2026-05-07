
import React, { useState } from 'react';
import { Binary, ArrowRightLeft, Copy, Trash2, Check } from 'lucide-react';

const TextTools = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<'base64' | 'url' | 'hex'>('base64');
  const [action, setAction] = useState<'encode' | 'decode'>('encode');
  const [copied, setCopied] = useState(false);

  const process = () => {
    if (!input) {
        setOutput('');
        return;
    }
    try {
        let res = '';
        if (mode === 'base64') {
            res = action === 'encode' ? btoa(input) : atob(input);
        } else if (mode === 'url') {
            res = action === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input);
        } else if (mode === 'hex') {
            if (action === 'encode') {
                res = input.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
            } else {
                const hex = input.replace(/\s/g, '');
                let str = '';
                for (let i = 0; i < hex.length; i += 2) {
                    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
                }
                res = str;
            }
        }
        setOutput(res);
    } catch (e) {
        setOutput('Error: Invalid Input for Decoding');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Binary className="text-green-400" /> Text Converter & Obfuscator</h2>

      {/* Controls */}
      <div className="bg-dark-800 p-4 rounded-xl border border-dark-700 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
         <div className="flex bg-dark-900 p-1 rounded-lg">
            {['base64', 'url', 'hex'].map((m) => (
                <button
                    key={m}
                    onClick={() => { setMode(m as any); setOutput(''); }}
                    className={`px-4 py-2 rounded-md text-sm font-bold uppercase transition-all ${mode === m ? 'bg-dark-700 text-green-400 shadow' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    {m}
                </button>
            ))}
         </div>
         
         <div className="flex bg-dark-900 p-1 rounded-lg">
            <button 
                onClick={() => setAction('encode')}
                className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${action === 'encode' ? 'bg-green-500 text-black' : 'text-gray-500 hover:text-white'}`}
            >
                ENCODE
            </button>
            <button 
                onClick={() => setAction('decode')}
                className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${action === 'decode' ? 'bg-green-500 text-black' : 'text-gray-500 hover:text-white'}`}
            >
                DECODE
            </button>
         </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="flex flex-col">
            <div className="flex justify-between mb-2">
                <label className="text-sm text-gray-400 font-bold">Input</label>
                <button onClick={() => { setInput(''); setOutput(''); }} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 size={12}/> Clear</button>
            </div>
            <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Enter text to ${action}...`}
                className="flex-1 h-64 bg-dark-800 border border-dark-700 rounded-xl p-4 text-gray-300 font-mono text-sm focus:outline-none focus:border-green-500/50 resize-none"
            />
        </div>

        <div className="flex flex-col">
            <div className="flex justify-between mb-2">
                <label className="text-sm text-gray-400 font-bold">Output</label>
                <button 
                    onClick={() => {
                        navigator.clipboard.writeText(output);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }} 
                    className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
                >
                    {copied ? <Check size={12}/> : <Copy size={12}/>} {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="relative flex-1">
                <textarea 
                    readOnly
                    value={output}
                    placeholder="Result will appear here..."
                    className="w-full h-64 bg-dark-900 border border-dark-700 rounded-xl p-4 text-green-400 font-mono text-sm focus:outline-none resize-none"
                />
            </div>
        </div>
      </div>

      <div className="mt-6 text-center">
         <button 
            onClick={process}
            className="px-12 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-xl shadow-lg shadow-green-900/20 transition-transform active:scale-95 flex items-center justify-center gap-2 mx-auto"
         >
            <ArrowRightLeft size={20} /> Convert Now
         </button>
      </div>
    </div>
  );
};

export default TextTools;
