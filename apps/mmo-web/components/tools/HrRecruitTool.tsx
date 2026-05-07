import React, { useState } from 'react';
import { Users, Copy, Check } from 'lucide-react';
import { useI18n } from '../i18n';

const template = `Job Title: [Role]
Location: [City/Remote]
Employment Type: Full-time

About the Role
- Short summary about the position and team.

Responsibilities
- Item 1
- Item 2

Requirements
- Must have 1
- Must have 2

Nice to Have
- Optional skill 1

Benefits
- Benefit 1
- Benefit 2`;

const normalizeBullets = (text: string) =>
  text
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*\n+/g, '\n\n')
    .replace(/^\s*-\s+/gm, '- ')
    .trim();

const HrRecruitTool = () => {
  const { t } = useI18n();
  const [jdInput, setJdInput] = useState('');
  const [jdOutput, setJdOutput] = useState('');
  const [cvInput, setCvInput] = useState('');
  const [cvOutput, setCvOutput] = useState('');
  const [copied, setCopied] = useState('');

  const formatJD = () => {
    const lines = jdInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const sections: Record<string, string[]> = {
      Responsibilities: [],
      Requirements: [],
      Benefits: [],
      Others: [],
    };
    let current = 'Others';
    lines.forEach((line) => {
      const lower = line.toLowerCase();
      if (lower.includes('responsibil')) current = 'Responsibilities';
      else if (lower.includes('require')) current = 'Requirements';
      else if (lower.includes('benefit') || lower.includes('perk')) current = 'Benefits';
      else if (/^[-*•]/.test(line)) sections[current].push(line.replace(/^[-*•]\s*/, ''));
      else sections[current].push(line);
    });

    const output = [
      'Responsibilities',
      ...sections.Responsibilities.map((l) => `- ${l}`),
      '',
      'Requirements',
      ...sections.Requirements.map((l) => `- ${l}`),
      '',
      'Benefits',
      ...sections.Benefits.map((l) => `- ${l}`),
      '',
      'Others',
      ...sections.Others.map((l) => `- ${l}`),
    ].join('\n');
    setJdOutput(normalizeBullets(output));
  };

  const cleanCV = () => {
    const cleaned = normalizeBullets(cvInput.replace(/\t/g, ' '));
    setCvOutput(cleaned);
  };

  const copy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users className="text-blue-400" /> {t('HR & Recruitment', 'Nhân sự & Tuyển dụng')}
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-400">{t('JD Formatter', 'Định dạng JD')}</h3>
            <button
              onClick={() => setJdInput(template)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              {t('Insert Template', 'Chèn mẫu')}
            </button>
          </div>
          <textarea
            value={jdInput}
            onChange={(e) => setJdInput(e.target.value)}
            className="w-full h-40 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
            spellCheck={false}
          />
          <button
            onClick={formatJD}
            className="mt-3 px-4 py-2 bg-blue-500 text-black font-bold rounded-lg hover:bg-blue-400"
          >
            {t('Format JD', 'Định dạng JD')}
          </button>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => copy(jdOutput, 'jd')}
              disabled={!jdOutput}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
            >
              {copied === 'jd' ? <Check size={12} /> : <Copy size={12} />} {t('Copy', 'Sao chép')}
            </button>
          </div>
          <textarea
            readOnly
            value={jdOutput}
            className="w-full h-40 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-blue-300"
            spellCheck={false}
          />
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <h3 className="text-sm font-bold text-gray-400 mb-2">{t('CV Cleaner', 'Làm sạch CV')}</h3>
          <textarea
            value={cvInput}
            onChange={(e) => setCvInput(e.target.value)}
            className="w-full h-40 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
            spellCheck={false}
          />
          <button
            onClick={cleanCV}
            className="mt-3 px-4 py-2 bg-blue-500 text-black font-bold rounded-lg hover:bg-blue-400"
          >
            {t('Clean CV Text', 'Làm sạch nội dung CV')}
          </button>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => copy(cvOutput, 'cv')}
              disabled={!cvOutput}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
            >
              {copied === 'cv' ? <Check size={12} /> : <Copy size={12} />} {t('Copy', 'Sao chép')}
            </button>
          </div>
          <textarea
            readOnly
            value={cvOutput}
            className="w-full h-40 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-blue-300"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};

export default HrRecruitTool;
