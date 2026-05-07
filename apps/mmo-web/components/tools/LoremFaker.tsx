import React, { useState } from 'react';
import { Type, Copy, Check, UserPlus } from 'lucide-react';

const WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing',
  'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore',
  'et', 'dolore', 'magna', 'aliqua', 'ut', 'enim', 'ad', 'minim', 'veniam'
];

const FIRST = ['Liam', 'Noah', 'Emma', 'Olivia', 'Ava', 'Sophia', 'Mia', 'Lucas', 'Ethan', 'James'];
const LAST = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Bui', 'Vo', 'Dang', 'Do', 'Phan'];
const STREETS = ['Main', 'Sunset', 'Oak', 'Maple', 'Le Loi', 'Nguyen Trai', 'Tran Hung Dao'];
const CITIES = ['Hanoi', 'HCMC', 'Da Nang', 'Hai Phong', 'Can Tho'];
const DOMAINS = ['example.com', 'mail.dev', 'at-tools.dev'];

const random = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const makeLorem = (paragraphs: number, wordsPerParagraph: number) => {
  const out: string[] = [];
  for (let p = 0; p < paragraphs; p += 1) {
    const words: string[] = [];
    for (let w = 0; w < wordsPerParagraph; w += 1) {
      words.push(random(WORDS));
    }
    const sentence = words.join(' ');
    out.push(sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.');
  }
  return out.join('\n\n');
};

const makeUsers = (count: number) => {
  return Array.from({ length: count }).map((_, i) => {
    const first = random(FIRST);
    const last = random(LAST);
    const name = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@${random(DOMAINS)}`;
    const address = `${Math.floor(Math.random() * 200) + 1} ${random(STREETS)} St, ${random(CITIES)}`;
    return { id: i + 1, name, email, address };
  });
};

const LoremFaker = () => {
  const [paragraphs, setParagraphs] = useState(3);
  const [words, setWords] = useState(40);
  const [userCount, setUserCount] = useState(5);
  const [lorem, setLorem] = useState('');
  const [users, setUsers] = useState('');
  const [copied, setCopied] = useState('');

  const genLorem = () => setLorem(makeLorem(paragraphs, words));
  const genUsers = () => setUsers(JSON.stringify(makeUsers(userCount), null, 2));

  const copy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Type className="text-pink-400" /> Lorem & Fake Data
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-400">Lorem Ipsum</h3>
            <button
              onClick={() => copy(lorem, 'lorem')}
              disabled={!lorem}
              className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1 disabled:opacity-50"
            >
              {copied === 'lorem' ? <Check size={12} /> : <Copy size={12} />} Copy
            </button>
          </div>
          <div className="flex gap-2 mb-3 text-xs text-gray-400">
            <label className="flex items-center gap-2">
              Paragraphs
              <input
                type="number"
                min={1}
                max={10}
                value={paragraphs}
                onChange={(e) => setParagraphs(Number(e.target.value))}
                className="w-16 bg-dark-900 border border-dark-700 rounded px-2 py-1 text-gray-200"
              />
            </label>
            <label className="flex items-center gap-2">
              Words
              <input
                type="number"
                min={10}
                max={120}
                value={words}
                onChange={(e) => setWords(Number(e.target.value))}
                className="w-16 bg-dark-900 border border-dark-700 rounded px-2 py-1 text-gray-200"
              />
            </label>
          </div>
          <button
            onClick={genLorem}
            className="w-full bg-pink-500 text-black font-bold rounded-lg py-2 hover:bg-pink-400"
          >
            Generate Lorem
          </button>
          <textarea
            readOnly
            value={lorem}
            className="w-full h-48 mt-3 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-pink-300"
            spellCheck={false}
          />
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-400">Fake Users</h3>
            <button
              onClick={() => copy(users, 'users')}
              disabled={!users}
              className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1 disabled:opacity-50"
            >
              {copied === 'users' ? <Check size={12} /> : <Copy size={12} />} Copy
            </button>
          </div>
          <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
            <label className="flex items-center gap-2">
              Count
              <input
                type="number"
                min={1}
                max={20}
                value={userCount}
                onChange={(e) => setUserCount(Number(e.target.value))}
                className="w-16 bg-dark-900 border border-dark-700 rounded px-2 py-1 text-gray-200"
              />
            </label>
          </div>
          <button
            onClick={genUsers}
            className="w-full bg-pink-500 text-black font-bold rounded-lg py-2 hover:bg-pink-400 flex items-center gap-2 justify-center"
          >
            <UserPlus size={16} /> Generate Users
          </button>
          <textarea
            readOnly
            value={users}
            className="w-full h-48 mt-3 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-pink-300"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};

export default LoremFaker;
