import React, { useState, useEffect } from 'react';
import { Coins } from 'lucide-react';
import { VIET_BANKS } from '../../constants';
import { Bank } from '../../types';

const VietQRGenerator = () => {
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNo, setAccountNo] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState('');
  const [content, setContent] = useState('');
  const [qrSrc, setQrSrc] = useState('');

  useEffect(() => {
    // Set default bank
    const bank = VIET_BANKS.find(b => b.code === 'VCB') as Bank;
    if(bank) setSelectedBank(bank);
  }, []);

  const generate = () => {
    if (!selectedBank || !accountNo) return;
    // VietQR Quicklink Format
    const baseUrl = `https://img.vietqr.io/image/${selectedBank.bin}-${accountNo}-compact2.png`;
    const params = new URLSearchParams();
    if (amount) params.append('amount', amount);
    if (content) params.append('addInfo', content);
    if (accountName) params.append('accountName', accountName);
    
    setQrSrc(`${baseUrl}?${params.toString()}`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Coins className="text-neon-green" /> VietQR Generator</h2>
      
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4 bg-dark-800 p-6 rounded-xl border border-dark-700">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Bank</label>
            <select 
              className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-white focus:border-neon-green outline-none"
              onChange={(e) => setSelectedBank(VIET_BANKS.find(b => b.id?.toString() === e.target.value || b.code === e.target.value) as Bank)}
              value={selectedBank?.code || ''}
            >
              {VIET_BANKS.map((bank) => (
                <option key={bank.code} value={bank.code}>{bank.shortName} - {bank.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Account Number</label>
            <input 
              className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-white focus:border-neon-green outline-none"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value)}
              placeholder="e.g. 1903..."
            />
          </div>
          <div>
             <label className="block text-sm text-gray-400 mb-1">Account Name (Optional)</label>
             <input 
               className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-white focus:border-neon-green outline-none"
               value={accountName}
               onChange={(e) => setAccountName(e.target.value.toUpperCase())}
               placeholder="NGUYEN VAN A"
             />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount (VND)</label>
              <input 
                type="number"
                className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-white focus:border-neon-green outline-none"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Content</label>
              <input 
                className="w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-white focus:border-neon-green outline-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Pay for..."
              />
            </div>
          </div>
          <button 
            onClick={generate}
            className="w-full py-3 bg-neon-green hover:bg-green-400 text-black font-bold rounded-lg transition-all"
          >
            Create QR
          </button>
        </div>

        <div className="flex flex-col items-center justify-center p-8 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
          {qrSrc ? (
            <div className="bg-white p-4 rounded-xl shadow-2xl">
              <img src={qrSrc} alt="VietQR" className="w-full max-w-[300px]" />
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <Coins size={48} className="mx-auto mb-2 opacity-50" />
              <p>Enter details to preview QR</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VietQRGenerator;