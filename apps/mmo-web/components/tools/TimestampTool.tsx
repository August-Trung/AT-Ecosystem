import React, { useEffect, useState } from 'react';
import { Clock, RefreshCw, Copy, Check } from 'lucide-react';

const TimestampTool = () => {
  const [dateInput, setDateInput] = useState('');
  const [unixInput, setUnixInput] = useState('');
  const [unixUnit, setUnixUnit] = useState<'s' | 'ms'>('s');
  const [result, setResult] = useState({
    iso: '',
    local: '',
    unixSeconds: '',
    unixMillis: '',
  });
  const [copied, setCopied] = useState(false);

  const toOutputs = (date: Date) => {
    if (Number.isNaN(date.getTime())) {
      return { iso: '', local: '', unixSeconds: '', unixMillis: '' };
    }
    return {
      iso: date.toISOString(),
      local: date.toLocaleString(),
      unixSeconds: Math.floor(date.getTime() / 1000).toString(),
      unixMillis: date.getTime().toString(),
    };
  };

  const syncFromDate = () => {
    if (!dateInput) return;
    const date = new Date(dateInput);
    setResult(toOutputs(date));
  };

  const syncFromUnix = () => {
    if (!unixInput.trim()) return;
    const value = Number(unixInput);
    if (Number.isNaN(value)) return;
    const ms = unixUnit === 's' ? value * 1000 : value;
    const date = new Date(ms);
    setDateInput(date.toISOString().slice(0, 16));
    setResult(toOutputs(date));
  };

  const setNow = () => {
    const now = new Date();
    setDateInput(now.toISOString().slice(0, 16));
    setUnixInput(Math.floor(now.getTime() / (unixUnit === 's' ? 1000 : 1)).toString());
    setResult(toOutputs(now));
  };

  const copy = () => {
    const payload = [
      `ISO: ${result.iso}`,
      `Local: ${result.local}`,
      `Unix (s): ${result.unixSeconds}`,
      `Unix (ms): ${result.unixMillis}`,
    ].join('\n');
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    setNow();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Clock className="text-yellow-400" /> Timestamp Converter
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-400">From Date/Time</h3>
            <button
              onClick={setNow}
              className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
            >
              <RefreshCw size={12} /> Now
            </button>
          </div>
          <input
            type="datetime-local"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
          />
          <button
            onClick={syncFromDate}
            className="mt-3 w-full bg-yellow-400 text-black font-bold rounded-lg py-2 hover:bg-yellow-300"
          >
            Convert
          </button>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-400">From Unix</h3>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={unixInput}
              onChange={(e) => setUnixInput(e.target.value)}
              placeholder="Unix timestamp"
              className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
            />
            <select
              value={unixUnit}
              onChange={(e) => setUnixUnit(e.target.value as 's' | 'ms')}
              className="bg-dark-900 border border-dark-700 rounded-lg px-2 py-2 text-gray-200"
            >
              <option value="s">sec</option>
              <option value="ms">ms</option>
            </select>
          </div>
          <button
            onClick={syncFromUnix}
            className="mt-3 w-full bg-yellow-400 text-black font-bold rounded-lg py-2 hover:bg-yellow-300"
          >
            Convert
          </button>
        </div>
      </div>

      <div className="mt-6 bg-dark-900 border border-dark-700 rounded-xl p-4">
        <div className="flex justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-400">Result</h3>
          <button
            onClick={copy}
            className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-3">
            <p className="text-xs text-gray-500">ISO</p>
            <p className="font-mono text-gray-200 break-all">{result.iso || '-'}</p>
          </div>
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-3">
            <p className="text-xs text-gray-500">Local</p>
            <p className="font-mono text-gray-200 break-all">{result.local || '-'}</p>
          </div>
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-3">
            <p className="text-xs text-gray-500">Unix (s)</p>
            <p className="font-mono text-gray-200 break-all">{result.unixSeconds || '-'}</p>
          </div>
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-3">
            <p className="text-xs text-gray-500">Unix (ms)</p>
            <p className="font-mono text-gray-200 break-all">{result.unixMillis || '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimestampTool;
