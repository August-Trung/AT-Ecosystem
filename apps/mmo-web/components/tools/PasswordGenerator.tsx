import React, { useState, useEffect } from 'react';
import { KeyRound, RefreshCw, Copy, Check } from 'lucide-react';

const PasswordGenerator = () => {
  const [length, setLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const generatePassword = () => {
    let charset = '';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeNumbers) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_+~`|}{[]:;?><,./-=';

    let retVal = '';
    for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    setPassword(retVal);
  };

  useEffect(() => {
    generatePassword();
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStrengthColor = () => {
    let score = 0;
    if (length > 8) score++;
    if (length > 12) score++;
    if (includeUppercase) score++;
    if (includeNumbers) score++;
    if (includeSymbols) score++;

    if (score <= 2) return 'bg-red-500';
    if (score <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><KeyRound className="text-green-400" /> Password Generator</h2>

      <div className="bg-dark-800 rounded-2xl border border-dark-700 p-6 shadow-xl mb-6">
        <div className="flex items-center gap-4 mb-2">
          <input 
             readOnly 
             value={password} 
             className="w-full bg-dark-900 border border-dark-700 rounded-xl p-4 text-xl md:text-2xl font-mono text-white tracking-wider outline-none text-center selection:bg-green-500/30"
          />
        </div>
        
        {/* Strength Bar */}
        <div className="h-1 w-full bg-dark-700 rounded-full mb-4 overflow-hidden">
          <div className={`h-full transition-all duration-300 ${getStrengthColor()}`} style={{ width: `${Math.min(100, (length/20)*100)}%` }}></div>
        </div>

        <div className="flex justify-center gap-4">
          <button 
            onClick={generatePassword}
            className="px-6 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg font-bold text-gray-200 flex items-center gap-2 transition-colors"
          >
            <RefreshCw size={18} /> Regenerate
          </button>
          <button 
            onClick={copyToClipboard}
            className={`px-6 py-2 rounded-lg font-bold text-black flex items-center gap-2 transition-colors ${copied ? 'bg-green-400' : 'bg-green-500 hover:bg-green-400'}`}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="bg-dark-800 rounded-2xl border border-dark-700 p-6">
        <div className="mb-6">
           <div className="flex justify-between items-center mb-2">
             <label className="font-bold text-gray-300">Length</label>
             <span className="text-neon-cyan font-mono text-xl">{length}</span>
           </div>
           <input 
             type="range" 
             min="6" 
             max="50" 
             value={length} 
             onChange={(e) => setLength(parseInt(e.target.value))}
             className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-neon-cyan"
           />
        </div>

        <div className="grid grid-cols-2 gap-4">
           {[
             { label: 'Uppercase (A-Z)', state: includeUppercase, set: setIncludeUppercase },
             { label: 'Lowercase (a-z)', state: includeLowercase, set: setIncludeLowercase },
             { label: 'Numbers (0-9)', state: includeNumbers, set: setIncludeNumbers },
             { label: 'Symbols (!@#)', state: includeSymbols, set: setIncludeSymbols },
           ].map((opt, idx) => (
             <div 
               key={idx}
               onClick={() => opt.set(!opt.state)}
               className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${opt.state ? 'bg-green-500/10 border-green-500 text-white' : 'bg-dark-900 border-dark-700 text-gray-500'}`}
             >
                <span className="font-medium text-sm">{opt.label}</span>
                {opt.state && <Check size={16} className="text-green-500" />}
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}

export default PasswordGenerator;