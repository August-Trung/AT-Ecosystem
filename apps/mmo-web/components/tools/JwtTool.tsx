import React, { useState } from 'react';
import { KeyRound, CheckCircle2, XCircle, Copy, Check } from 'lucide-react';

const base64UrlEncode = (input: string) => {
  const encoded = btoa(unescape(encodeURIComponent(input)));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlDecode = (input: string) => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  return decodeURIComponent(escape(atob(padded)));
};

const signHs256 = async (data: string, secret: string) => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const bytes = new Uint8Array(signature);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const JwtTool = () => {
  const [token, setToken] = useState('');
  const [header, setHeader] = useState('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
  const [payload, setPayload] = useState('{\n  "sub": "1234567890",\n  "name": "Dev User",\n  "iat": 1700000000\n}');
  const [secret, setSecret] = useState('');
  const [status, setStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const decode = () => {
    try {
      const parts = token.split('.');
      if (parts.length < 2) throw new Error('Invalid token');
      setHeader(JSON.stringify(JSON.parse(base64UrlDecode(parts[0])), null, 2));
      setPayload(JSON.stringify(JSON.parse(base64UrlDecode(parts[1])), null, 2));
      setStatus('ok');
      setMessage('Decoded');
    } catch (e: any) {
      setStatus('fail');
      setMessage(e.message);
    }
  };

  const encode = async () => {
    try {
      const headerObj = JSON.parse(header);
      const payloadObj = JSON.parse(payload);
      const head = base64UrlEncode(JSON.stringify(headerObj));
      const body = base64UrlEncode(JSON.stringify(payloadObj));
      const data = `${head}.${body}`;
      if (headerObj.alg === 'none') {
        setToken(`${data}.`);
        setStatus('ok');
        setMessage('Encoded with alg=none');
        return;
      }
      if (!secret) throw new Error('Secret required for HS256');
      const signature = await signHs256(data, secret);
      setToken(`${data}.${signature}`);
      setStatus('ok');
      setMessage('Encoded');
    } catch (e: any) {
      setStatus('fail');
      setMessage(e.message);
    }
  };

  const verify = async () => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token');
      const headerObj = JSON.parse(base64UrlDecode(parts[0]));
      if (headerObj.alg === 'none') {
        setStatus('ok');
        setMessage('alg=none (no signature)');
        return;
      }
      if (headerObj.alg !== 'HS256') throw new Error('Only HS256 supported');
      if (!secret) throw new Error('Secret required');
      const data = `${parts[0]}.${parts[1]}`;
      const signature = await signHs256(data, secret);
      if (signature !== parts[2]) throw new Error('Signature mismatch');
      setStatus('ok');
      setMessage('Signature valid');
    } catch (e: any) {
      setStatus('fail');
      setMessage(e.message);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <KeyRound className="text-red-400" /> JWT Tool
      </h2>

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-4">
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="JWT token..."
          className="w-full h-20 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={decode} className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-gray-300 hover:text-white">
            Decode
          </button>
          <button onClick={encode} className="px-4 py-2 bg-red-500 text-black font-bold rounded-lg hover:bg-red-400">
            Encode
          </button>
          <button onClick={verify} className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-gray-300 hover:text-white">
            Verify
          </button>
          <button onClick={copy} disabled={!token} className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-gray-300 hover:text-white disabled:opacity-50 flex items-center gap-2">
            {copied ? <Check size={14} /> : <Copy size={14} />} Copy
          </button>
        </div>
        {status !== 'idle' && (
          <div className={`text-sm flex items-center gap-2 ${status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
            {status === 'ok' ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {message}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div>
          <label className="text-sm font-bold text-gray-500">Header</label>
          <textarea
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            className="w-full h-48 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="text-sm font-bold text-gray-500">Payload</label>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            className="w-full h-48 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="mt-4 bg-dark-800 border border-dark-700 rounded-xl p-4">
        <label className="text-sm font-bold text-gray-500">Secret (HS256)</label>
        <input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Secret for HS256"
          className="w-full mt-2 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200 font-mono text-sm"
        />
      </div>
    </div>
  );
};

export default JwtTool;
