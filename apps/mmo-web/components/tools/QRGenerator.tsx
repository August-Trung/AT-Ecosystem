import React, { useState } from 'react';
import { QrCode, Wifi, Download } from 'lucide-react';

const QRGenerator = () => {
  const [mode, setMode] = useState<'text' | 'wifi'>('text');
  
  // Text Mode State
  const [text, setText] = useState('Nhập URL');
  
  // Wifi Mode State
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [encryption, setEncryption] = useState('WPA');
  const [hidden, setHidden] = useState(false);

  const [size, setSize] = useState(300);
  const [color, setColor] = useState('000000');

  // Construct QR Data
  let qrData = '';
  if (mode === 'wifi') {
    // WIFI:S:MyNetwork;T:WPA;P:password;H:false;;
    qrData = `WIFI:S:${ssid};T:${encryption};P:${password};H:${hidden};;`;
  } else {
    qrData = text;
  }
  
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(qrData)}&color=${color.replace('#', '')}&bgcolor=ffffff`;

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><QrCode className="text-neon-pink" /> QR Generator</h2>
      
      {/* Mode Tabs */}
      <div className="flex gap-4 mb-8 border-b border-dark-700 pb-1">
        <button 
          onClick={() => setMode('text')}
          className={`pb-3 px-2 font-bold text-sm transition-all ${mode === 'text' ? 'text-neon-pink border-b-2 border-neon-pink' : 'text-gray-500 hover:text-white'}`}
        >
          Text / URL
        </button>
        <button 
          onClick={() => setMode('wifi')}
          className={`pb-3 px-2 font-bold text-sm transition-all ${mode === 'wifi' ? 'text-neon-pink border-b-2 border-neon-pink' : 'text-gray-500 hover:text-white'}`}
        >
          Wi-Fi Network
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {mode === 'text' ? (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Content</label>
              <input 
                type="text" 
                value={text} 
                onChange={(e) => setText(e.target.value)}
                className="w-full bg-dark-800 border border-dark-700 rounded-lg p-3 focus:outline-none focus:border-neon-cyan transition-colors"
                placeholder="Enter text or URL"
              />
            </div>
          ) : (
             <div className="space-y-4">
               <div>
                  <label className="block text-sm text-gray-400 mb-1">Network Name (SSID)</label>
                  <div className="relative">
                    <Wifi className="absolute left-3 top-3 text-gray-500" size={18}/>
                    <input 
                      type="text" 
                      value={ssid} 
                      onChange={(e) => setSsid(e.target.value)}
                      className="w-full bg-dark-800 border border-dark-700 rounded-lg p-3 pl-10 focus:outline-none focus:border-neon-cyan transition-colors"
                      placeholder="My Home Wifi"
                    />
                  </div>
               </div>
               <div>
                  <label className="block text-sm text-gray-400 mb-1">Password</label>
                  <input 
                    type="text" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-dark-800 border border-dark-700 rounded-lg p-3 focus:outline-none focus:border-neon-cyan transition-colors"
                    placeholder="Wifi Password"
                  />
               </div>
               <div>
                  <label className="block text-sm text-gray-400 mb-1">Encryption</label>
                  <select 
                     value={encryption} 
                     onChange={(e) => setEncryption(e.target.value)}
                     className="w-full bg-dark-800 border border-dark-700 rounded-lg p-3 outline-none"
                  >
                     <option value="WPA">WPA/WPA2</option>
                     <option value="WEP">WEP</option>
                     <option value="nopass">None</option>
                  </select>
               </div>
               
               {/* Raw Data Preview */}
               <div className="pt-2">
                 <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Raw QR Data String</label>
                 <div className="bg-black/20 border border-dark-700 rounded-lg p-3 font-mono text-xs text-neon-pink break-all">
                   {qrData}
                 </div>
               </div>
             </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Color</label>
            <div className="flex gap-2">
              <input 
                type="color" 
                value={`#${color}`}
                onChange={(e) => setColor(e.target.value.replace('#', ''))}
                className="h-10 w-full rounded cursor-pointer bg-dark-800 border border-dark-700"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl">
           <img src={qrUrl} alt="QR Code" className="max-w-full" />
           <a href={qrUrl} download={`qrcode_${mode}.png`} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 text-sm font-bold text-dark-900 hover:text-neon-purple">
             <Download size={16} /> Download PNG
           </a>
        </div>
      </div>
    </div>
  );
};

export default QRGenerator;