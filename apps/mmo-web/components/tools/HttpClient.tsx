import React, { useState } from 'react';
import { Send, Plus, Trash2, Copy, Check, Globe } from 'lucide-react';

type HeaderRow = { key: string; value: string };

const buildCurl = (method: string, url: string, headers: HeaderRow[], body: string) => {
  if (!url) return '';
  const parts = [`curl -X ${method} '${url}'`];
  headers.filter((h) => h.key).forEach((h) => {
    parts.push(`-H '${h.key}: ${h.value}'`);
  });
  if (method !== 'GET' && body) {
    parts.push(`--data '${body.replace(/'/g, `'\\''`)}'`);
  }
  return parts.join(' ');
};

const HttpClient = () => {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<HeaderRow[]>([{ key: '', value: '' }]);
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const curl = buildCurl(method, url, headers, body);

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    setHeaders((prev) => prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
  };

  const addHeader = () => setHeaders((prev) => [...prev, { key: '', value: '' }]);
  const removeHeader = (index: number) => setHeaders((prev) => prev.filter((_, i) => i !== index));

  const send = async () => {
    if (!url) return;
    setLoading(true);
    setStatus('');
    setResponse('');
    try {
      const headerObj: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.key) headerObj[h.key] = h.value;
      });
      const res = await fetch(url, {
        method,
        headers: headerObj,
        body: method === 'GET' ? undefined : body || undefined,
      });
      const text = await res.text();
      setStatus(`${res.status} ${res.statusText}`);
      setResponse(text);
    } catch (e: any) {
      setStatus('Request failed');
      setResponse(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCurl = () => {
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Globe className="text-cyan-400" /> HTTP Client & Curl Builder
      </h2>

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
          >
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/endpoint"
            className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
          />
          <button
            onClick={send}
            disabled={loading}
            className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 flex items-center gap-2"
          >
            <Send size={16} /> {loading ? 'Sending...' : 'Send'}
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400 font-bold">Headers</span>
            <button onClick={addHeader} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {headers.map((row, idx) => (
              <div key={`header-${idx}`} className="flex gap-2">
                <input
                  value={row.key}
                  onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                  placeholder="Header name"
                  className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
                />
                <input
                  value={row.value}
                  onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                  placeholder="Header value"
                  className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
                />
                <button
                  onClick={() => removeHeader(idx)}
                  className="px-2 bg-dark-900 border border-dark-700 rounded-lg text-red-400 hover:text-red-300"
                  title="Remove header"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="text-sm text-gray-400 font-bold">Body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Request body"
            className="w-full h-32 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="mt-6 bg-dark-900 border border-dark-700 rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-gray-400">Curl</h3>
          <button
            onClick={copyCurl}
            disabled={!curl}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 disabled:opacity-50"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} Copy
          </button>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-3 font-mono text-xs text-cyan-300 break-all">
          {curl || '-'}
        </div>
      </div>

      <div className="mt-6 bg-dark-900 border border-dark-700 rounded-xl p-4">
        <h3 className="text-sm font-bold text-gray-400">Response</h3>
        <div className="text-xs text-gray-500 mt-2">Status: {status || '-'}</div>
        <textarea
          readOnly
          value={response}
          className="w-full h-40 mt-3 bg-dark-800 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default HttpClient;
