import React, { useState } from 'react';
import { Scale, Copy, Check } from 'lucide-react';
import { useI18n } from '../i18n';

const ndaTemplate = `NON-DISCLOSURE AGREEMENT (NDA)

This Agreement is made between [Disclosing Party] and [Receiving Party].

1. Definition of Confidential Information
Any non-public information shared for [Purpose].

2. Obligations
The Receiving Party agrees to keep information confidential and not disclose without consent.

3. Term
[Start Date] to [End Date]

4. Governing Law
[Jurisdiction]

Signed:
[Disclosing Party]
[Receiving Party]`;

const redactText = (input: string, keywords: string[]) => {
  let output = input;
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const phonePattern = /(\+?\d[\d\s.-]{7,}\d)/g;
  output = output.replace(emailPattern, '[REDACTED_EMAIL]');
  output = output.replace(phonePattern, '[REDACTED_PHONE]');
  keywords.filter(Boolean).forEach((word) => {
    const pattern = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    output = output.replace(pattern, '[REDACTED]');
  });
  return output;
};

const LegalDocsTool = () => {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [keywords, setKeywords] = useState('');
  const [output, setOutput] = useState('');
  const [template, setTemplate] = useState(ndaTemplate);
  const [copied, setCopied] = useState('');

  const runRedact = () => {
    const list = keywords.split(',').map((k) => k.trim());
    setOutput(redactText(input, list));
  };

  const copy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Scale className="text-zinc-300" /> {t('Legal & Docs', 'Pháp lý & Tài liệu')}
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <h3 className="text-sm font-bold text-gray-400 mb-2">{t('Redaction', 'Ẩn thông tin')}</h3>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('Paste text to redact...', 'Dán nội dung cần ẩn...')}
            className="w-full h-40 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
            spellCheck={false}
          />
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={t('Keywords to redact (comma separated)', 'Từ khóa cần ẩn (phân tách bằng dấu phẩy)')}
            className="w-full mt-2 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
          />
          <button
            onClick={runRedact}
            className="mt-3 px-4 py-2 bg-zinc-200 text-black font-bold rounded-lg hover:bg-white"
          >
            {t('Redact', 'Ẩn dữ liệu')}
          </button>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => copy(output, 'redact')}
              disabled={!output}
              className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 disabled:opacity-50"
            >
              {copied === 'redact' ? <Check size={12} /> : <Copy size={12} />} {t('Copy', 'Sao chép')}
            </button>
          </div>
          <textarea
            readOnly
            value={output}
            className="w-full h-40 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-zinc-200"
            spellCheck={false}
          />
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-400">{t('NDA Template', 'Mẫu NDA')}</h3>
            <button
              onClick={() => setTemplate(ndaTemplate)}
              className="text-xs text-zinc-300 hover:text-white"
            >
              {t('Reset', 'Đặt lại')}
            </button>
          </div>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full h-56 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
            spellCheck={false}
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => copy(template, 'template')}
              className="text-xs text-zinc-300 hover:text-white flex items-center gap-1"
            >
              {copied === 'template' ? <Check size={12} /> : <Copy size={12} />} {t('Copy', 'Sao chép')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalDocsTool;
