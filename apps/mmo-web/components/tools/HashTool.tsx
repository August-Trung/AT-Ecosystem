import React, { useState } from 'react';
import { Hash, Copy, Check } from 'lucide-react';

const toHex = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const md5 = (input: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  const rotateLeft = (l: number, s: number) => (l << s) | (l >>> (32 - s));
  const addUnsigned = (a: number, b: number) => {
    const a4 = a & 0x40000000;
    const b4 = b & 0x40000000;
    const a8 = a & 0x80000000;
    const b8 = b & 0x80000000;
    const result = (a & 0x3fffffff) + (b & 0x3fffffff);
    if (a4 & b4) return result ^ 0x80000000 ^ a8 ^ b8;
    if (a4 | b4) {
      if (result & 0x40000000) return result ^ 0xc0000000 ^ a8 ^ b8;
      return result ^ 0x40000000 ^ a8 ^ b8;
    }
    return result ^ a8 ^ b8;
  };

  const f = (x: number, y: number, z: number) => (x & y) | (~x & z);
  const g = (x: number, y: number, z: number) => (x & z) | (y & ~z);
  const h = (x: number, y: number, z: number) => x ^ y ^ z;
  const i = (x: number, y: number, z: number) => y ^ (x | ~z);

  const ff = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) =>
    addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, f(b, c, d)), addUnsigned(x, ac)), s), b);
  const gg = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) =>
    addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, g(b, c, d)), addUnsigned(x, ac)), s), b);
  const hh = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) =>
    addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, h(b, c, d)), addUnsigned(x, ac)), s), b);
  const ii = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number) =>
    addUnsigned(rotateLeft(addUnsigned(addUnsigned(a, i(b, c, d)), addUnsigned(x, ac)), s), b);

  const convertToWordArray = (bytes: Uint8Array) => {
    const l = bytes.length;
    const n = (((l + 8) >>> 6) + 1) * 16;
    const words = new Array(n).fill(0);
    for (let j = 0; j < l; j += 1) {
      words[j >>> 2] |= bytes[j] << ((j % 4) * 8);
    }
    words[l >>> 2] |= 0x80 << ((l % 4) * 8);
    words[n - 2] = l * 8;
    return words;
  };

  const words = convertToWordArray(data);
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let k = 0; k < words.length; k += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;

    a = ff(a, b, c, d, words[k + 0], 7, 0xd76aa478);
    d = ff(d, a, b, c, words[k + 1], 12, 0xe8c7b756);
    c = ff(c, d, a, b, words[k + 2], 17, 0x242070db);
    b = ff(b, c, d, a, words[k + 3], 22, 0xc1bdceee);
    a = ff(a, b, c, d, words[k + 4], 7, 0xf57c0faf);
    d = ff(d, a, b, c, words[k + 5], 12, 0x4787c62a);
    c = ff(c, d, a, b, words[k + 6], 17, 0xa8304613);
    b = ff(b, c, d, a, words[k + 7], 22, 0xfd469501);
    a = ff(a, b, c, d, words[k + 8], 7, 0x698098d8);
    d = ff(d, a, b, c, words[k + 9], 12, 0x8b44f7af);
    c = ff(c, d, a, b, words[k + 10], 17, 0xffff5bb1);
    b = ff(b, c, d, a, words[k + 11], 22, 0x895cd7be);
    a = ff(a, b, c, d, words[k + 12], 7, 0x6b901122);
    d = ff(d, a, b, c, words[k + 13], 12, 0xfd987193);
    c = ff(c, d, a, b, words[k + 14], 17, 0xa679438e);
    b = ff(b, c, d, a, words[k + 15], 22, 0x49b40821);

    a = gg(a, b, c, d, words[k + 1], 5, 0xf61e2562);
    d = gg(d, a, b, c, words[k + 6], 9, 0xc040b340);
    c = gg(c, d, a, b, words[k + 11], 14, 0x265e5a51);
    b = gg(b, c, d, a, words[k + 0], 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, words[k + 5], 5, 0xd62f105d);
    d = gg(d, a, b, c, words[k + 10], 9, 0x02441453);
    c = gg(c, d, a, b, words[k + 15], 14, 0xd8a1e681);
    b = gg(b, c, d, a, words[k + 4], 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, words[k + 9], 5, 0x21e1cde6);
    d = gg(d, a, b, c, words[k + 14], 9, 0xc33707d6);
    c = gg(c, d, a, b, words[k + 3], 14, 0xf4d50d87);
    b = gg(b, c, d, a, words[k + 8], 20, 0x455a14ed);
    a = gg(a, b, c, d, words[k + 13], 5, 0xa9e3e905);
    d = gg(d, a, b, c, words[k + 2], 9, 0xfcefa3f8);
    c = gg(c, d, a, b, words[k + 7], 14, 0x676f02d9);
    b = gg(b, c, d, a, words[k + 12], 20, 0x8d2a4c8a);

    a = hh(a, b, c, d, words[k + 5], 4, 0xfffa3942);
    d = hh(d, a, b, c, words[k + 8], 11, 0x8771f681);
    c = hh(c, d, a, b, words[k + 11], 16, 0x6d9d6122);
    b = hh(b, c, d, a, words[k + 14], 23, 0xfde5380c);
    a = hh(a, b, c, d, words[k + 1], 4, 0xa4beea44);
    d = hh(d, a, b, c, words[k + 4], 11, 0x4bdecfa9);
    c = hh(c, d, a, b, words[k + 7], 16, 0xf6bb4b60);
    b = hh(b, c, d, a, words[k + 10], 23, 0xbebfbc70);
    a = hh(a, b, c, d, words[k + 13], 4, 0x289b7ec6);
    d = hh(d, a, b, c, words[k + 0], 11, 0xeaa127fa);
    c = hh(c, d, a, b, words[k + 3], 16, 0xd4ef3085);
    b = hh(b, c, d, a, words[k + 6], 23, 0x04881d05);
    a = hh(a, b, c, d, words[k + 9], 4, 0xd9d4d039);
    d = hh(d, a, b, c, words[k + 12], 11, 0xe6db99e5);
    c = hh(c, d, a, b, words[k + 15], 16, 0x1fa27cf8);
    b = hh(b, c, d, a, words[k + 2], 23, 0xc4ac5665);

    a = ii(a, b, c, d, words[k + 0], 6, 0xf4292244);
    d = ii(d, a, b, c, words[k + 7], 10, 0x432aff97);
    c = ii(c, d, a, b, words[k + 14], 15, 0xab9423a7);
    b = ii(b, c, d, a, words[k + 5], 21, 0xfc93a039);
    a = ii(a, b, c, d, words[k + 12], 6, 0x655b59c3);
    d = ii(d, a, b, c, words[k + 3], 10, 0x8f0ccc92);
    c = ii(c, d, a, b, words[k + 10], 15, 0xffeff47d);
    b = ii(b, c, d, a, words[k + 1], 21, 0x85845dd1);
    a = ii(a, b, c, d, words[k + 8], 6, 0x6fa87e4f);
    d = ii(d, a, b, c, words[k + 15], 10, 0xfe2ce6e0);
    c = ii(c, d, a, b, words[k + 6], 15, 0xa3014314);
    b = ii(b, c, d, a, words[k + 13], 21, 0x4e0811a1);
    a = ii(a, b, c, d, words[k + 4], 6, 0xf7537e82);
    d = ii(d, a, b, c, words[k + 11], 10, 0xbd3af235);
    c = ii(c, d, a, b, words[k + 2], 15, 0x2ad7d2bb);
    b = ii(b, c, d, a, words[k + 9], 21, 0xeb86d391);

    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }

  const toBytes = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  const bytes = new Uint8Array([...toBytes(a), ...toBytes(b), ...toBytes(c), ...toBytes(d)]);
  return bytes.buffer;
};

const HashTool = () => {
  const [text, setText] = useState('');
  const [algo, setAlgo] = useState<'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512'>('sha256');
  const [hex, setHex] = useState('');
  const [base64, setBase64] = useState('');
  const [copied, setCopied] = useState(false);

  const compute = async () => {
    if (!text) return;
    let buffer: ArrayBuffer;
    if (algo === 'md5') {
      buffer = md5(text);
    } else {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const algoMap: Record<string, string> = {
        sha1: 'SHA-1',
        sha256: 'SHA-256',
        sha384: 'SHA-384',
        sha512: 'SHA-512',
      };
      buffer = await crypto.subtle.digest(algoMap[algo], data);
    }
    setHex(toHex(buffer));
    setBase64(toBase64(buffer));
  };

  const copy = () => {
    navigator.clipboard.writeText(`hex: ${hex}\nbase64: ${base64}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Hash className="text-green-400" /> Hash Utilities
      </h2>

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {['md5', 'sha1', 'sha256', 'sha384', 'sha512'].map((item) => (
            <button
              key={item}
              onClick={() => setAlgo(item as any)}
              className={`px-3 py-2 rounded-lg text-sm font-bold uppercase transition-all ${
                algo === item ? 'bg-green-500 text-black' : 'bg-dark-900 text-gray-400 hover:text-white'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Text to hash..."
          className="w-full h-40 bg-dark-900 border border-dark-700 rounded-xl p-4 text-gray-200 font-mono text-sm"
          spellCheck={false}
        />
        <button
          onClick={compute}
          className="mt-4 w-full bg-green-500 text-black font-bold rounded-lg py-2 hover:bg-green-400"
        >
          Compute Hash
        </button>
      </div>

      <div className="mt-6 bg-dark-900 border border-dark-700 rounded-xl p-4">
        <div className="flex justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-400">Output</h3>
          <button
            onClick={copy}
            disabled={!hex}
            className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 disabled:opacity-50"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Hex</p>
            <div className="bg-dark-800 border border-dark-700 rounded-lg p-3 font-mono text-xs text-green-300 break-all">
              {hex || '-'}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Base64</p>
            <div className="bg-dark-800 border border-dark-700 rounded-lg p-3 font-mono text-xs text-green-300 break-all">
              {base64 || '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HashTool;
