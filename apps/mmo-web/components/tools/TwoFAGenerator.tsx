import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { generateTOTP, getRemainingTime } from '../../services/tools';

const TwoFAGenerator = () => {
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('------');
  const [timeLeft, setTimeLeft] = useState(30);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getRemainingTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const updateCode = async () => {
      if (secret.length > 4) {
        try {
          const c = await generateTOTP(secret);
          setCode(c);
        } catch (e) {
          setCode('INVALID');
        }
      } else {
        setCode('------');
      }
    };
    updateCode();
    const interval = setInterval(updateCode, 1000);
    return () => clearInterval(interval);
  }, [secret]);

  const copyCode = () => {
    if (code !== '------' && code !== 'ERROR' && code !== 'INVALID') {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="max-w-xl mx-auto text-center">
      <h2 className="text-2xl font-bold mb-8 flex items-center justify-center gap-2"><Shield className="text-red-500" /> 2FA Code Generator</h2>
      
      <div className="bg-dark-800 rounded-2xl border border-dark-700 p-8 shadow-2xl shadow-red-900/10">
        <div className="mb-8 relative group">
           <div 
             onClick={copyCode}
             className="text-6xl font-mono font-bold text-white tracking-widest mb-4 tabular-nums cursor-pointer select-none hover:text-red-400 transition-colors"
           >
             {code === 'INVALID' ? 'INVALID' : (
                <>
                 {code.slice(0,3)} <span className="text-gray-600"> </span> {code.slice(3)}
                </>
             )}
           </div>
           
           <div className="absolute top-0 right-0">
             {copied && <span className="text-green-500 text-xs animate-bounce">Copied!</span>}
           </div>

           <div className="w-full bg-dark-700 h-2 rounded-full overflow-hidden">
             <div 
               className="h-full bg-red-500 transition-all duration-1000 ease-linear"
               style={{ width: `${(timeLeft / 30) * 100}%` }}
             />
           </div>
           <p className="text-xs text-gray-500 mt-2">Refreshes in {timeLeft}s</p>
        </div>

        <div className="text-left">
          <label className="block text-sm text-gray-400 mb-2">Enter Secret Key (Base32)</label>
          <input 
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="JBSWY3DPEHPK3PXP..."
            className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-red-100 focus:border-red-500 outline-none font-mono text-sm uppercase"
          />
        </div>
      </div>
    </div>
  );
};

export default TwoFAGenerator;