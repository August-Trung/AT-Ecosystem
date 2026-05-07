import React, { useState } from 'react';
import { Fingerprint, Copy, Check, RefreshCw } from 'lucide-react';

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const encodeTime = (time: number) => {
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out = ULID_ALPHABET[time % 32] + out;
    time = Math.floor(time / 32);
  }
  return out;
};

const encodeRandom = () => {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let out = '';
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    acc = (acc << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ULID_ALPHABET[(acc >>> bits) & 31];
    }
  }
  return out.padEnd(16, '0');
};

const generateUlid = () => {
  const time = Date.now();
  return encodeTime(time) + encodeRandom();
};

const generateUuidV4 = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return [
    bytes.slice(0, 4).map(toHex).join(''),
    bytes.slice(4, 6).map(toHex).join(''),
    bytes.slice(6, 8).map(toHex).join(''),
    bytes.slice(8, 10).map(toHex).join(''),
    bytes.slice(10, 16).map(toHex).join(''),
  ].join('-');
};

const nanoid = (size = 21) => {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-';
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < size; i += 1) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
};

const IdGenerator = () => {
  const [kind, setKind] = useState<'uuid' | 'ulid' | 'nanoid'>('uuid');
  const [count, setCount] = useState(5);
  const [size, setSize] = useState(21);
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const generateOne = () => {
    if (kind === 'uuid') return generateUuidV4();
    if (kind === 'ulid') return generateUlid();
    return nanoid(size);
  };

  const generate = () => {
    const safeCount = Math.max(1, Math.min(50, count));
    const list = Array.from({ length: safeCount }, generateOne);
    setOutput(list.join('\n'));
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Fingerprint className="text-cyan-400" /> ID Generator
      </h2>

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex bg-dark-900 p-1 rounded-lg">
          {['uuid', 'ulid', 'nanoid'].map((item) => (
            <button
              key={item}
              onClick={() => setKind(item as any)}
              className={`px-4 py-2 rounded-md text-sm font-bold uppercase transition-all ${
                kind === item ? 'bg-cyan-500 text-black' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Count</span>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-16 bg-dark-900 border border-dark-700 rounded-lg px-2 py-1 text-gray-200"
            />
          </div>
          {kind === 'nanoid' && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Size</span>
              <input
                type="number"
                min={8}
                max={64}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-16 bg-dark-900 border border-dark-700 rounded-lg px-2 py-1 text-gray-200"
              />
            </div>
          )}
          <button
            onClick={generate}
            className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 flex items-center gap-2"
          >
            <RefreshCw size={16} /> Generate
          </button>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-400 font-bold">Output</span>
          <button
            onClick={copy}
            disabled={!output}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 disabled:opacity-50"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <textarea
          readOnly
          value={output}
          placeholder="Generated IDs will appear here..."
          className="w-full h-64 bg-dark-900 border border-dark-700 rounded-xl p-4 text-cyan-300 font-mono text-sm focus:outline-none resize-none"
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default IdGenerator;
