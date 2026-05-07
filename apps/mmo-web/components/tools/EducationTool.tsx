import React, { useState } from 'react';
import { GraduationCap, Copy, Check } from 'lucide-react';
import { useI18n } from '../i18n';

type Card = { q: string; a: string };

const EducationTool = () => {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [cards, setCards] = useState<Card[]>([]);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const result: Card[] = [];
    lines.forEach((line) => {
      const separatorIndex = line.indexOf(':') >= 0 ? line.indexOf(':') : line.indexOf('-');
      if (separatorIndex > 0) {
        const q = line.slice(0, separatorIndex).trim();
        const a = line.slice(separatorIndex + 1).trim();
        if (q && a) result.push({ q, a });
        return;
      }
      const words = line.split(/\s+/);
      const key = words.find((w) => w.length > 5) || words[0];
      if (key) {
        const question = line.replace(key, '_____');
        result.push({ q: question, a: key });
      }
    });
    setCards(result);
  };

  const copy = () => {
    const payload = cards.map((c, i) => `${i + 1}. Q: ${c.q}\n   A: ${c.a}`).join('\n');
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <GraduationCap className="text-indigo-400" /> {t('Education', 'Giáo dục')}
      </h2>

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("Paste notes. Use 'term: definition' or plain sentences.", "Dán ghi chú. Dùng 'term: định nghĩa' hoặc câu thường.")}
          className="w-full h-40 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
          spellCheck={false}
        />
        <button
          onClick={generate}
          className="mt-3 px-6 py-2 bg-indigo-500 text-black font-bold rounded-lg hover:bg-indigo-400"
        >
          {t('Generate Flashcards', 'Tạo flashcards')}
        </button>
      </div>

      <div className="mt-6 bg-dark-800 border border-dark-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-400">
            {t('Cards', 'Thẻ')} ({cards.length})
          </h3>
          <button
            onClick={copy}
            disabled={cards.length === 0}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 disabled:opacity-50"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {t('Copy', 'Sao chép')}
          </button>
        </div>
        <div className="space-y-2">
          {cards.length === 0 ? (
            <div className="text-xs text-gray-500">{t('No cards yet.', 'Chưa có thẻ nào.')}</div>
          ) : (
            cards.map((card, idx) => (
              <div key={`${card.q}-${idx}`} className="bg-dark-900 border border-dark-700 rounded-lg p-3 text-xs">
                <div className="text-indigo-300">Q: {card.q}</div>
                <div className="text-gray-400 mt-1">A: {card.a}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default EducationTool;
