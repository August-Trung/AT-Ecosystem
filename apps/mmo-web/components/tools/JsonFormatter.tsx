
import React, { useState } from 'react';
import { FileJson, Check, AlertTriangle, Copy, Trash2, Code } from 'lucide-react';
import { useI18n } from '../i18n';

const JsonFormatter = () => {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('json'); // json | xml
  const [copied, setCopied] = useState(false);

  const tryParseJsonString = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  };

  const formatJson = (minify = false) => {
    if (!input.trim()) return;
    setError('');
    try {
        const parsed = JSON.parse(input);
        const nested = tryParseJsonString(parsed);
        const obj = nested ?? parsed;
        setOutput(JSON.stringify(obj, null, minify ? 0 : 2));
        setMode('json');
    } catch (e: any) {
        setError(e.message);
        setOutput('');
    }
  };

  const parseJsonString = () => {
    if (!input.trim()) return;
    setError('');
    try {
      const parsed = JSON.parse(input);
      const nested = tryParseJsonString(parsed);
      if (nested === null) {
        throw new Error('Input is not a JSON string containing JSON');
      }
      setOutput(JSON.stringify(nested, null, 2));
      setMode('json');
    } catch (e: any) {
      setError(e.message);
      setOutput('');
    }
  };

  // Simple XML format (Mock, since no DOMParser dependency wanted for safety, but we can use browser native)
  const formatXml = () => {
      if (!input.trim()) return;
      setError('');
      try {
        const PADDING = '  ';
        const reg = /(>)(<)(\/*)/g;
        let xml = input.replace(reg, '$1\r\n$2$3');
        let pad = 0;
        let formatted = '';
        xml.split('\r\n').forEach((node) => {
            let indent = 0;
            if (node.match(/.+<\/\w[^>]*>$/)) {
                indent = 0;
            } else if (node.match(/^<\/\w/)) {
                if (pad !== 0) pad -= 1;
            } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
                indent = 1;
            } else {
                indent = 0;
            }
            let padding = '';
            for (let i = 0; i < pad; i++) padding += PADDING;
            formatted += padding + node + '\r\n';
            pad += indent;
        });
        setOutput(formatted.trim());
        setMode('xml');
      } catch (e) {
          setError("Invalid XML");
      }
  };

  const copy = () => {
      navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileJson className="text-yellow-400" /> {t('JSON / XML Formatter', 'Định dạng JSON / XML')}
        </h2>
        
        <div className="flex gap-2">
            <button onClick={() => formatJson(false)} className="px-3 py-2 bg-dark-800 border border-dark-600 hover:border-yellow-400 rounded-lg text-sm font-bold text-gray-300 transition-colors">
              {t('Beautify JSON', 'Làm đẹp JSON')}
            </button>
            <button onClick={parseJsonString} className="px-3 py-2 bg-dark-800 border border-dark-600 hover:border-yellow-400 rounded-lg text-sm font-bold text-gray-300 transition-colors">
              {t('Parse JSON String', 'Giải chuỗi JSON')}
            </button>
            <button onClick={() => formatJson(true)} className="px-3 py-2 bg-dark-800 border border-dark-600 hover:border-yellow-400 rounded-lg text-sm font-bold text-gray-300 transition-colors">
              {t('Minify JSON', 'Rút gọn JSON')}
            </button>
            <button onClick={formatXml} className="px-3 py-2 bg-dark-800 border border-dark-600 hover:border-blue-400 rounded-lg text-sm font-bold text-gray-300 transition-colors">
              {t('Format XML', 'Định dạng XML')}
            </button>
        </div>
      </div>

      <div className="flex-1 grid md:grid-cols-2 gap-6 min-h-0">
         {/* Input */}
         <div className="flex flex-col h-full">
            <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-gray-500">{t('Raw Input', 'Dữ liệu vào')}</label>
                <button onClick={() => { setInput(''); setOutput(''); setError(''); }} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 size={12}/> {t('Clear', 'Xóa')}</button>
            </div>
            <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('Paste JSON or XML here...', 'Dán JSON hoặc XML vào đây...')}
                className={`flex-1 bg-dark-800 border rounded-xl p-4 text-xs font-mono text-gray-300 focus:outline-none resize-none ${error ? 'border-red-500/50 bg-red-900/10' : 'border-dark-700 focus:border-yellow-500/50'}`}
                spellCheck={false}
            />
            {error && <div className="mt-2 text-red-400 text-xs flex items-center gap-1"><AlertTriangle size={12}/> {error}</div>}
         </div>

         {/* Output */}
         <div className="flex flex-col h-full">
            <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-gray-500">{t('Formatted Output', 'Kết quả')}</label>
                <button 
                    onClick={copy}
                    disabled={!output}
                    className="text-xs text-yellow-500 hover:text-yellow-400 flex items-center gap-1 disabled:opacity-50"
                >
                    {copied ? <Check size={12}/> : <Copy size={12}/>} {copied ? t('Copied', 'Đã sao chép') : t('Copy', 'Sao chép')}
                </button>
            </div>
            <div className="flex-1 relative">
                <textarea 
                    readOnly
                    value={output}
                    placeholder={t('Result...', 'Kết quả...')}
                    className="w-full h-full bg-dark-900 border border-dark-700 rounded-xl p-4 text-xs font-mono text-green-400 focus:outline-none resize-none"
                    spellCheck={false}
                />
            </div>
         </div>
      </div>
    </div>
  );
};

export default JsonFormatter;
