import React, { useState } from 'react';
import { Table, Copy, Check } from 'lucide-react';
import { useI18n } from '../i18n';

const parseCsv = (text: string, delimiter: string) => {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  const row: string[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      rows.push([...row]);
      row.length = 0;
      current = '';
      continue;
    }
    current += char;
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push([...row]);
  }
  return rows;
};

const DataOfficeTool = () => {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [delimiter, setDelimiter] = useState(',');
  const [hasHeader, setHasHeader] = useState(true);
  const [output, setOutput] = useState('');
  const [stats, setStats] = useState({ rows: 0, cols: 0 });
  const [deduped, setDeduped] = useState('');
  const [copied, setCopied] = useState('');

  const convert = () => {
    if (!input.trim()) return;
    const rows = parseCsv(input.trim(), delimiter);
    if (rows.length === 0) return;
    const header = hasHeader ? rows[0] : rows[0].map((_, i) => `col_${i + 1}`);
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const json = dataRows.map((row) =>
      header.reduce((acc, key, idx) => {
        acc[key] = row[idx] ?? '';
        return acc;
      }, {} as Record<string, string>)
    );
    setOutput(JSON.stringify(json, null, 2));
    setStats({ rows: dataRows.length, cols: header.length });
  };

  const dedupe = () => {
    const lines = input.split(/\r?\n/).filter((line) => line.trim());
    const unique = Array.from(new Set(lines));
    setDeduped(unique.join('\n'));
  };

  const copy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Table className="text-cyan-400" /> {t('Data & Office', 'Dữ liệu & Office')}
      </h2>

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-center mb-3 text-sm">
          <label className="flex items-center gap-2 text-gray-400">
            {t('Delimiter', 'Dấu phân cách')}
            <select
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value)}
              className="bg-dark-900 border border-dark-700 rounded px-2 py-1 text-gray-200"
            >
              <option value=",">{t('Comma', 'Dấu phẩy')}</option>
              <option value="\t">Tab</option>
              <option value=";">{t('Semicolon', 'Dấu chấm phẩy')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-gray-400">
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
            {t('Has header', 'Có tiêu đề cột')}
          </label>
          <button
            onClick={convert}
            className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400"
          >
            {t('CSV/TSV to JSON', 'CSV/TSV sang JSON')}
          </button>
        </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('Paste CSV/TSV here...', 'Dán CSV/TSV vào đây...')}
          className="w-full h-40 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
          spellCheck={false}
        />
        <div className="text-xs text-gray-500 mt-2">
          {t('Rows', 'Dòng')}: {stats.rows} | {t('Columns', 'Cột')}: {stats.cols}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-400">{t('JSON Output', 'Kết quả JSON')}</h3>
            <button
              onClick={() => copy(output, 'json')}
              disabled={!output}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 disabled:opacity-50"
            >
              {copied === 'json' ? <Check size={12} /> : <Copy size={12} />} {t('Copy', 'Sao chép')}
            </button>
          </div>
          <textarea
            readOnly
            value={output}
            className="w-full h-52 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-cyan-300"
            spellCheck={false}
          />
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-400">{t('Dedupe Lines', 'Xóa dòng trùng')}</h3>
            <button
              onClick={() => copy(deduped, 'dedupe')}
              disabled={!deduped}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 disabled:opacity-50"
            >
              {copied === 'dedupe' ? <Check size={12} /> : <Copy size={12} />} {t('Copy', 'Sao chép')}
            </button>
          </div>
          <button
            onClick={dedupe}
            className="mb-2 px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-gray-300 hover:text-white"
          >
            {t('Remove Duplicates', 'Xóa trùng lặp')}
          </button>
          <textarea
            readOnly
            value={deduped}
            className="w-full h-44 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-cyan-300"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};

export default DataOfficeTool;
