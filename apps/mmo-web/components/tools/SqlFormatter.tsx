import React, { useState } from 'react';
import { Database, ArrowRightLeft, Copy, Check } from 'lucide-react';

const KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'ON',
  'AND', 'OR'
];

const formatSql = (input: string) => {
  let sql = input.replace(/\s+/g, ' ').trim();
  if (!sql) return '';

  KEYWORDS.forEach((kw) => {
    const pattern = new RegExp(`\\b${kw.replace(' ', '\\s+')}\\b`, 'gi');
    sql = sql.replace(pattern, kw);
  });

  const newlineBefore = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
    'INSERT', 'UPDATE', 'DELETE', 'VALUES', 'SET',
    'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'JOIN', 'ON'
  ];

  newlineBefore.forEach((kw) => {
    const pattern = new RegExp(`\\s*${kw.replace(' ', '\\s+')}\\s*`, 'g');
    sql = sql.replace(pattern, `\n${kw} `);
  });

  sql = sql.replace(/\s+(AND|OR)\s+/g, '\n  $1 ');
  sql = sql.replace(/,\s*/g, ', ');

  return sql.trim();
};

const SqlFormatter = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const run = () => setOutput(formatSql(input));

  const copy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Database className="text-blue-400" /> SQL Formatter
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm font-bold text-gray-500">Input SQL</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="SELECT * FROM users WHERE id=1"
            className="w-full h-64 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="text-sm font-bold text-gray-500">Formatted</label>
          <textarea
            value={output}
            readOnly
            className="w-full h-64 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-blue-300"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={run}
          className="px-6 py-2 bg-blue-500 text-black font-bold rounded-lg hover:bg-blue-400 flex items-center gap-2"
        >
          <ArrowRightLeft size={16} /> Format
        </button>
        <button
          onClick={copy}
          disabled={!output}
          className="px-6 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-gray-300 hover:text-white disabled:opacity-50 flex items-center gap-2"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} Copy
        </button>
      </div>
    </div>
  );
};

export default SqlFormatter;
