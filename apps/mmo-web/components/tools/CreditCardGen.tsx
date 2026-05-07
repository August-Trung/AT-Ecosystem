import React, { useState, useEffect } from 'react';
import { RefreshCw, Copy, Check, CreditCard } from 'lucide-react';

// Inline SVGs for realistic look
const ICONS = {
  chip: (
    <svg viewBox="0 0 50 35" className="w-12 h-9 opacity-90">
      <rect width="50" height="35" rx="5" ry="5" fill="#ffcea5" />
      <path d="M15 0 L15 35 M35 0 L35 35 M0 12 L15 12 M0 23 L15 23 M35 12 L50 12 M35 23 L50 23 M15 17.5 L35 17.5" stroke="#be8e56" strokeWidth="1.5" fill="none" />
      <rect x="18" y="10" width="14" height="15" rx="3" stroke="#be8e56" strokeWidth="1" fill="none" />
    </svg>
  ),
  contactless: (
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-white/80 rotate-90" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="none" />
      <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-12C6.5 4 2 8.5 2 14h2c0-4.41 3.59-8 8-8s8 3.59 8 8h2c0-5.5-4.5-10-10-10zm0-4C4.5 0 0 4.5 0 12h2l.01-.01C2.01 6.5 6.5 2.01 12 2.01V0z" fill="none" />
      <path d="M12 4c4.42 0 8 3.58 8 8h2c0-5.52-4.48-10-10-10v2zM12 8c2.21 0 4 1.79 4 4h2c0-3.31-2.69-6-6-6v2z" />
    </svg>
  ),
  visa: (
    <svg viewBox="0 0 50 16" className="w-16 h-auto" fill="#fff" xmlns="http://www.w3.org/2000/svg">
      {/* <path d="M19.7 0h-5.9c-1.8 0-3.3 1-4.1 2.9l-11.7 28h6.3l1.3-3.6h8l.8 3.6h5.7L19.7 0zm-8.8 23.4l2.3-6.2 1.3 6.2h-3.6zM35.6 12.8L30 0h-5.9l8.6 19.9L24.8 32h6l3.5-9.3h9.8l1.1 9.3h5.2L35.6 12.8zm-1.1 7.2l2.4-12.7 5.6 12.7h-8zM14.6 0h-5.9L0 23.4c-.2-1.1-2.1-7.1-2.1-7.1S2.1 2.2 2.1 1.6c0-.4-.7-.8-2.1-.8H-6L-6.2 1.6C-2.4 2.6 2 4.9 4.7 10.2l5.1 21.8h6.3L14.6 0zM70.7 13.9c0-1.7-1.4-2.8-3.4-3.1-1.4-.2-2.3-.4-2.3-.4-.5-.2-.7-.4-.7-.8 0-.8.9-1.6 2.8-1.6 1.3 0 2.3.3 3 .6l.5.2.7-4.1c-.8-.3-2.1-.6-3.8-.6-4 0-6.8 2.1-6.9 5.2 0 4.3 5.9 4.6 6 6.8 0 .6-.7 1.1-2.4 1.1-2 0-3.1-.3-4.1-.7l-.6-.3-.8 4.2c.9.4 2.6.8 4.3.8 4.2 0 7-2 7.1-5.1.1-1.9-1.2-3.3-2.4-3.8z" transform="translate(6) scale(0.45)" /> */}
      <text x="0" y="16" fontFamily="sans-serif" fontWeight="bold" fontSize="16" fill="#fff" style={{ fontStyle: 'italic' }}>VISA</text>
    </svg>
  ),
  mastercard: (
    <svg viewBox="0 0 24 16" className="w-16 h-auto">
      <rect fill="none" width="24" height="16" />
      <circle cx="7" cy="8" r="7" fill="#EB001B" />
      <circle cx="17" cy="8" r="7" fill="#F79E1B" fillOpacity="0.9" />
    </svg>
  ),
  amex: (
    <svg viewBox="0 0 100 100" className="w-12 h-auto" fill="#fff">
      {/* <path d="M70.5 45.3h-7.6v-21h7.6v21zm-2.8-15.6h-2.1v10.3h2.1V29.7zM42.4 45.3h-3.4l-1.3-4.1h-4.3l-1.3 4.1h-3.5l5.8-15.6h3.4l5.8 15.6zm-5.4-7l-1.5-4.5-1.5 4.5h3zM92.7 34.6l-2.4 2.5-1.9-2.5h-3.3l3.6 4.8-4.2 5.9h3.6l2.3-3.2 2.3 3.2h3.4l-4.1-5.9 3.6-4.8h-3.4v-.1l.1.1zM19.1 45.3l-2.7-10.7-1.9 10.7h-3L8.3 34.8l-1.9 10.6H3l2.8-15.6h3.6l3 10.4 2.2-10.4h3.6l2.8 15.6h-1.9zM55.5 35.1h-4.9v2.3h4.6v2.8h-4.6v2.3h4.9v2.8H47V29.7h8.5v5.4z" transform="scale(1.2) translate(-5, 0)" /> */}
      {/* Fallback Text if Path Fails */}
      <text x="50" y="60" textAnchor="middle" fontSize="18" fontWeight="bold" fontFamily="sans-serif">AMEX</text>
    </svg>
  ),
  discover: (
    <div className="font-bold text-white italic tracking-tighter text-xl">
      DISCOVER
    </div>
  )
};

const CreditCardGen = () => {
  const [card, setCard] = useState<any>(null);
  const [type, setType] = useState('visa');
  const [copied, setCopied] = useState(false);

  // Helper: Generate valid Luhn number
  const generateLuhn = (prefix: string, length: number) => {
    let ccNum = prefix;
    while (ccNum.length < length - 1) {
      ccNum += Math.floor(Math.random() * 10);
    }

    let sum = 0;
    let pos = 0;
    const reversedCC = ccNum.split('').reverse().join('');

    while (pos < length - 1) {
      let odd = parseInt(reversedCC.charAt(pos)) * 2;
      if (odd > 9) odd -= 9;
      sum += odd;
      if (pos !== (length - 2)) sum += parseInt(reversedCC.charAt(pos + 1));
      pos += 2;
    }

    const checkDigit = ((Math.floor(sum / 10) + 1) * 10 - sum) % 10;
    return ccNum + checkDigit;
  };

  const generate = () => {
    let num = '';
    let cvv = '';
    let prefix = '';
    let len = 16;

    switch (type) {
      case 'visa':
        prefix = '4';
        len = 16;
        cvv = Math.floor(Math.random() * 899 + 100).toString();
        break;
      case 'mastercard':
        prefix = (Math.floor(Math.random() * 5) + 51).toString();
        len = 16;
        cvv = Math.floor(Math.random() * 899 + 100).toString();
        break;
      case 'amex':
        prefix = Math.random() > 0.5 ? '34' : '37';
        len = 15;
        cvv = Math.floor(Math.random() * 8999 + 1000).toString();
        break;
      case 'discover':
        prefix = '6011';
        len = 16;
        cvv = Math.floor(Math.random() * 899 + 100).toString();
        break;
    }

    num = generateLuhn(prefix, len);

    // Expiry
    const month = (Math.floor(Math.random() * 12) + 1).toString().padStart(2, '0');
    const year = (new Date().getFullYear() + Math.floor(Math.random() * 5) + 1).toString().slice(-2);

    setCard({ number: num, exp: `${month}/${year}`, cvv, type });
  };

  useEffect(() => { generate(); }, [type]);

  const formatNum = (num: string) => {
    if (!num) return '';
    if (type === 'amex') {
      return `${num.slice(0, 4)} ${num.slice(4, 10)} ${num.slice(10)}`;
    }
    return num.match(/.{1,4}/g)?.join(' ') || '';
  };

  const copy = () => {
    if (!card) return;
    const text = `${card.number}|${card.exp}|${card.cvv}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Card Styles
  const getCardBackground = () => {
    switch (type) {
      case 'visa': return 'bg-gradient-to-tr from-[#1a1f71] to-[#00a3e0]'; // Classic Visa Blue
      case 'mastercard': return 'bg-gradient-to-r from-[#222] to-[#444]'; // Black card feel
      case 'amex': return 'bg-gradient-to-br from-[#4b5563] to-[#9ca3af]'; // Platinum
      case 'discover': return 'bg-gradient-to-r from-[#ff7e5f] to-[#feb47b]'; // Orange/Gold
      default: return 'bg-gray-800';
    }
  };

  const textEmboss = { textShadow: '1px 1px 2px rgba(0,0,0,0.6)' };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><CreditCard className="text-pink-500" /> Test Credit Card Gen</h2>

      <div className="grid md:grid-cols-2 gap-8 items-start">

        {/* Realistic Visual Card */}
        <div className="perspective-1000 w-full select-none">
          <div className={`relative w-full aspect-[1.586/1] rounded-xl shadow-2xl overflow-hidden transition-all duration-500 ${getCardBackground()} text-white p-6 sm:p-8 flex flex-col justify-between border border-white/10`}>

            {/* Noise/Texture Overlay */}
            <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>

            {/* Top Row: Chip & Contactless & Logo */}
            <div className="relative z-10 flex justify-between items-start">
              <div className="flex items-center gap-4">
                {ICONS.chip}
                {ICONS.contactless}
              </div>
              <div className="opacity-90 drop-shadow-lg">
                {ICONS[type as keyof typeof ICONS]}
              </div>
            </div>

            {/* Number */}
            <div className="relative z-10 mt-4">
              <p
                className="font-mono text-lg sm:text-2xl lg:text-3xl tracking-wider sm:tracking-widest drop-shadow-lg whitespace-nowrap overflow-hidden"
                style={{ ...textEmboss, fontFamily: '"Share Tech Mono", monospace' }}
              >
                {formatNum(card?.number) || '•••• •••• •••• ••••'}
              </p>
            </div>

            {/* Bottom Row: Details */}
            <div className="relative z-10 flex justify-between items-end mt-4">
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-[10px] uppercase text-gray-300 mb-1 font-bold tracking-wider">Card Holder</p>
                <p className="font-mono uppercase text-sm sm:text-base tracking-widest truncate" style={textEmboss}>JOHN DOE</p>
              </div>

              <div className="flex gap-4 sm:gap-6 flex-shrink-0">
                <div className="flex flex-col items-center">
                  <p className="text-[8px] uppercase text-gray-300 font-bold">Valid Thru</p>
                  <p className="font-mono text-sm sm:text-base tracking-wider" style={textEmboss}>{card?.exp || 'MM/YY'}</p>
                </div>

                {/* Amex CVV is on front */}
                {type === 'amex' && (
                  <div className="flex flex-col items-center">
                    <p className="text-[8px] uppercase text-gray-300 font-bold">CID</p>
                    <p className="font-mono text-sm sm:text-base tracking-wider" style={textEmboss}>{card?.cvv || '0000'}</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Controls */}
        <div className="space-y-6">
          <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700">
            <label className="text-sm font-bold text-gray-400 mb-3 block">Card Network</label>
            <div className="grid grid-cols-2 gap-3">
              {['visa', 'mastercard', 'amex', 'discover'].map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-4 py-3 rounded-xl border font-bold capitalize transition-all flex items-center justify-center gap-2 ${type === t ? 'bg-pink-500/20 border-pink-500 text-white shadow-[0_0_10px_rgba(236,72,153,0.3)]' : 'bg-dark-900 border-dark-600 text-gray-500 hover:border-gray-400'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={generate}
              className="flex-1 py-4 bg-dark-700 hover:bg-dark-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw size={20} /> Generate
            </button>
            <button
              onClick={copy}
              className="flex-1 py-4 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-pink-900/20"
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
              {copied ? 'Copied Full' : 'Copy Data'}
            </button>
          </div>

          <div className="bg-dark-900 p-4 rounded-xl border border-dark-700">
            <div className="flex justify-between items-center text-sm text-gray-400 mb-2">
              <span>CVV (Back)</span>
              <span className="font-mono text-white font-bold">{card?.cvv}</span>
            </div>
            <p className="text-xs text-center text-gray-600 italic mt-2">
              * Generates valid Luhn checksums. For testing & verification purposes only. Do not use for fraud.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditCardGen;