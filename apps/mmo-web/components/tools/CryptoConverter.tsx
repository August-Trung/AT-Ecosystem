
import React, { useState } from 'react';
import { Calculator, ArrowRight } from 'lucide-react';

const CryptoConverter = () => {
  const [eth, setEth] = useState('');
  const [gwei, setGwei] = useState('');
  const [wei, setWei] = useState('');

  // 1 ETH = 1e9 Gwei = 1e18 Wei
  
  const handleEth = (val: string) => {
    setEth(val);
    if (!val || isNaN(Number(val))) { setGwei(''); setWei(''); return; }
    try {
        const v = parseFloat(val);
        setGwei((v * 1e9).toString());
        setWei((v * 1e18).toLocaleString('fullwide', { useGrouping: false })); // Avoid scientific notation
    } catch(e) {}
  };

  const handleGwei = (val: string) => {
    setGwei(val);
    if (!val || isNaN(Number(val))) { setEth(''); setWei(''); return; }
    try {
        const v = parseFloat(val);
        setEth((v / 1e9).toFixed(9).replace(/\.?0+$/, ""));
        setWei((v * 1e9).toLocaleString('fullwide', { useGrouping: false }));
    } catch(e) {}
  };

  const handleWei = (val: string) => {
    setWei(val);
    if (!val || isNaN(Number(val))) { setEth(''); setGwei(''); return; }
    try {
        const v = parseFloat(val);
        setEth((v / 1e18).toFixed(18).replace(/\.?0+$/, ""));
        setGwei((v / 1e9).toFixed(9).replace(/\.?0+$/, ""));
    } catch(e) {}
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-8 flex items-center justify-center gap-2"><Calculator className="text-cyan-400" /> Crypto Unit Converter</h2>

      <div className="bg-dark-800 p-8 rounded-2xl border border-dark-700 shadow-xl space-y-6">
        
        {/* ETH */}
        <div className="relative group">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 group-focus-within:text-cyan-400 transition-colors">Ether (ETH)</label>
            <input 
                type="number" 
                value={eth}
                onChange={(e) => handleEth(e.target.value)}
                placeholder="1"
                className="w-full bg-dark-900 border border-dark-600 rounded-xl p-4 text-xl font-mono text-white outline-none focus:border-cyan-400 transition-all"
            />
            <span className="absolute right-4 top-9 text-gray-600 font-bold">ETH</span>
        </div>

        <div className="flex justify-center text-gray-600"><ArrowDown /></div>

        {/* GWEI */}
        <div className="relative group">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 group-focus-within:text-cyan-400 transition-colors">Gwei (Gas)</label>
            <input 
                type="number" 
                value={gwei}
                onChange={(e) => handleGwei(e.target.value)}
                placeholder="1000000000"
                className="w-full bg-dark-900 border border-dark-600 rounded-xl p-4 text-xl font-mono text-white outline-none focus:border-cyan-400 transition-all"
            />
            <span className="absolute right-4 top-9 text-gray-600 font-bold">GWEI</span>
        </div>

        <div className="flex justify-center text-gray-600"><ArrowDown /></div>

        {/* WEI */}
        <div className="relative group">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 group-focus-within:text-cyan-400 transition-colors">Wei (Smallest Unit)</label>
            <input 
                type="number" 
                value={wei}
                onChange={(e) => handleWei(e.target.value)}
                placeholder="1000000000000000000"
                className="w-full bg-dark-900 border border-dark-600 rounded-xl p-4 text-xl font-mono text-white outline-none focus:border-cyan-400 transition-all"
            />
            <span className="absolute right-4 top-9 text-gray-600 font-bold">WEI</span>
        </div>

      </div>
    </div>
  );
};

const ArrowDown = () => <ArrowRight className="rotate-90 opacity-50" />;

export default CryptoConverter;
