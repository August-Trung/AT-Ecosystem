import React, { useState } from 'react';
import { TrendingUp, Copy, Check } from 'lucide-react';
import { useI18n } from '../i18n';

const parseLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

const SalesTool = () => {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [hasHeader, setHasHeader] = useState(true);
  const [output, setOutput] = useState('');
  const [stats, setStats] = useState({ total: 0, unique: 0 });
  const [copied, setCopied] = useState(false);

  const scoreLead = (lead: Record<string, string>) => {
    let score = 0;
    if (lead.company) score += 2;
    if (lead.phone) score += 2;
    if (lead.email) score += 1;
    if (lead.notes && /demo|call|pricing/i.test(lead.notes)) score += 2;
    return score;
  };

  const clean = () => {
    const lines = parseLines(input);
    if (lines.length === 0) return;
    const header = hasHeader ? lines[0].split(/[,\t;]/) : ['name', 'email', 'company', 'phone', 'notes'];
    const dataLines = hasHeader ? lines.slice(1) : lines;
    const leads = dataLines.map((line) => {
      const parts = line.split(/[,\t;]/);
      return header.reduce((acc, key, idx) => {
        acc[key.trim().toLowerCase()] = (parts[idx] || '').trim();
        return acc;
      }, {} as Record<string, string>);
    });
    const map = new Map<string, Record<string, string>>();
    leads.forEach((lead) => {
      const key = lead.email || `${lead.name}-${lead.company}`;
      if (!map.has(key)) map.set(key, lead);
    });
    const unique = Array.from(map.values()).map((lead) => ({
      ...lead,
      score: scoreLead(lead).toString(),
    }));
    const csvHeader = ['name', 'email', 'company', 'phone', 'notes', 'score'];
    const csv = [csvHeader.join(',')]
      .concat(
        unique.map((lead) =>
          csvHeader.map((key) => `"${(lead[key] || '').replace(/"/g, '""')}"`).join(',')
        )
      )
      .join('\n');
    setOutput(csv);
    setStats({ total: leads.length, unique: unique.length });
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <TrendingUp className="text-green-400" /> {t('Sales', 'Bán hàng')}
      </h2>

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
        <label className="text-xs text-gray-400 flex items-center gap-2 mb-2">
          <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
          {t('Input has header row', 'Dữ liệu có dòng tiêu đề')}
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('name,email,company,phone,notes', 'name,email,company,phone,notes')}
          className="w-full h-40 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
          spellCheck={false}
        />
        <button
          onClick={clean}
          className="mt-3 px-4 py-2 bg-green-500 text-black font-bold rounded-lg hover:bg-green-400"
        >
          {t('Clean & Score Leads', 'Làm sạch & chấm điểm lead')}
        </button>
        <div className="text-xs text-gray-500 mt-2">
          {t('Total', 'Tổng')}: {stats.total} | {t('Unique', 'Duy nhất')}: {stats.unique}
        </div>
      </div>

      <div className="mt-6 bg-dark-800 border border-dark-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-400">{t('Output CSV', 'Kết quả CSV')}</h3>
          <button
            onClick={copy}
            disabled={!output}
            className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 disabled:opacity-50"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {t('Copy', 'Sao chép')}
          </button>
        </div>
        <textarea
          readOnly
          value={output}
          className="w-full h-48 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-green-300"
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default SalesTool;
