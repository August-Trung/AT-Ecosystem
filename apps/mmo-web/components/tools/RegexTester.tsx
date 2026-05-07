import React, { useMemo, useState } from 'react';
import { Code, Copy, Check, AlertTriangle } from 'lucide-react';

const RegexTester = () => {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  const { error, matches } = useMemo(() => {
    if (!pattern) return { error: '', matches: [] as RegExpMatchArray[] };
    try {
      const reg = new RegExp(pattern, flags);
      const found = Array.from(text.matchAll(reg));
      return { error: '', matches: found };
    } catch (e: any) {
      return { error: e.message, matches: [] as RegExpMatchArray[] };
    }
  }, [pattern, flags, text]);

  const copy = () => {
    const payload = matches.map((m, i) => `[${i}] ${m[0]}`).join('\n');
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Code className="text-purple-400" /> Regex Tester
      </h2>

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Regex pattern, e.g. \\b\\w+\\b"
            className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200 font-mono"
          />
          <input
            value={flags}
            onChange={(e) => setFlags(e.target.value)}
            placeholder="flags"
            className="w-24 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200 font-mono"
          />
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Test text..."
          className="h-56 bg-dark-900 border border-dark-700 rounded-lg p-3 text-gray-200 font-mono text-sm resize-none"
          spellCheck={false}
        />
      </div>

      {error && (
        <div className="mt-4 bg-red-900/20 border border-red-500/50 p-3 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      <div className="mt-6 bg-dark-900 border border-dark-700 rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-gray-400">Matches ({matches.length})</h3>
          <button
            onClick={copy}
            disabled={matches.length === 0}
            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="space-y-2">
          {matches.length === 0 ? (
            <p className="text-sm text-gray-500">No matches.</p>
          ) : (
            matches.map((match, idx) => (
              <div key={`${match[0]}-${idx}`} className="bg-dark-800 border border-dark-700 rounded-lg p-3">
                <p className="font-mono text-purple-300 text-sm break-all">{match[0]}</p>
                {match.length > 1 && (
                  <div className="mt-2 grid md:grid-cols-2 gap-2 text-xs text-gray-400">
                    {match.slice(1).map((group, gi) => (
                      <div key={`${idx}-${gi}`} className="bg-dark-900 border border-dark-700 rounded px-2 py-1">
                        <span className="text-gray-500">Group {gi + 1}:</span> {group || '(empty)'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RegexTester;
