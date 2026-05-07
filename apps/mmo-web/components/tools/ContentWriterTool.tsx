import React, { useMemo, useState } from 'react';
import { PenLine, Copy, Check } from 'lucide-react';
import { useI18n } from '../i18n';

const countSyllables = (word: string) => {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!cleaned) return 0;
  const matches = cleaned.match(/[aeiouy]+/g);
  return matches ? matches.length : 1;
};

const ContentWriterTool = () => {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [outline, setOutline] = useState('');
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    const text = input.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = input.length;
    const sentences = text ? (text.match(/[.!?]+/g) || []).length || 1 : 0;
    const syllables = text
      ? text.split(/\s+/).reduce((acc, w) => acc + countSyllables(w), 0)
      : 0;
    const flesch = words
      ? Math.round(206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words))
      : 0;
    const readingTime = words ? Math.ceil(words / 200) : 0;
    return { words, chars, sentences, flesch, readingTime };
  }, [input]);

  const generateOutline = () => {
    if (!input.trim()) return;
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const headings = lines.filter((l) => l.startsWith('#') || /^[0-9]+\./.test(l));
    if (headings.length > 0) {
      setOutline(headings.map((h) => `- ${h.replace(/^#+\s*/, '')}`).join('\n'));
      return;
    }
    const sentences = input.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    setOutline(sentences.slice(0, 8).map((s) => `- ${s}`).join('\n'));
  };

  const copy = () => {
    navigator.clipboard.writeText(outline);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <PenLine className="text-purple-400" /> {t('Content & Writing', 'Nội dung & Viết')}
      </h2>

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('Paste your content...', 'Dán nội dung...')}
          className="w-full h-48 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
          spellCheck={false}
        />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 text-xs text-gray-400">
          <div className="bg-dark-900 border border-dark-700 rounded-lg p-2">
            {t('Words', 'Từ')}: {stats.words}
          </div>
          <div className="bg-dark-900 border border-dark-700 rounded-lg p-2">
            {t('Chars', 'Ký tự')}: {stats.chars}
          </div>
          <div className="bg-dark-900 border border-dark-700 rounded-lg p-2">
            {t('Sentences', 'Câu')}: {stats.sentences}
          </div>
          <div className="bg-dark-900 border border-dark-700 rounded-lg p-2">
            {t('Flesch', 'Flesch')}: {stats.flesch}
          </div>
          <div className="bg-dark-900 border border-dark-700 rounded-lg p-2">
            {t('Read', 'Đọc')}: {stats.readingTime} {t('min', 'phút')}
          </div>
        </div>
        <button
          onClick={generateOutline}
          className="mt-4 px-6 py-2 bg-purple-500 text-black font-bold rounded-lg hover:bg-purple-400"
        >
          {t('Generate Outline', 'Tạo dàn ý')}
        </button>
      </div>

      <div className="mt-6 bg-dark-800 border border-dark-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-400">{t('Outline', 'Dàn ý')}</h3>
          <button
            onClick={copy}
            disabled={!outline}
            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {t('Copy', 'Sao chép')}
          </button>
        </div>
        <textarea
          readOnly
          value={outline}
          className="w-full h-40 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-purple-300"
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default ContentWriterTool;
