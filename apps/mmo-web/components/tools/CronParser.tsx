import React, { useState } from 'react';
import { CalendarClock, AlertTriangle } from 'lucide-react';

const parseField = (field: string, min: number, max: number) => {
  const values = new Set<number>();
  const parts = field.split(',');
  for (const part of parts) {
    if (part === '*') {
      for (let i = min; i <= max; i += 1) values.add(i);
      continue;
    }

    const [rangePart, stepPart] = part.split('/');
    const step = stepPart ? Number(stepPart) : 1;
    if (!Number.isFinite(step) || step <= 0) throw new Error(`Invalid step in "${part}"`);

    let rangeStart = min;
    let rangeEnd = max;

    if (rangePart !== '*') {
      if (rangePart.includes('-')) {
        const [startStr, endStr] = rangePart.split('-');
        rangeStart = Number(startStr);
        rangeEnd = Number(endStr);
      } else {
        rangeStart = Number(rangePart);
        rangeEnd = Number(rangePart);
      }
    }

    if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd)) throw new Error(`Invalid range in "${part}"`);
    for (let i = rangeStart; i <= rangeEnd; i += step) {
      if (i < min || i > max) continue;
      values.add(i);
    }
  }
  if (values.size === 0) throw new Error('Empty field');
  return values;
};

const CronParser = () => {
  const [expression, setExpression] = useState('*/5 * * * *');
  const [baseTime, setBaseTime] = useState(new Date().toISOString().slice(0, 16));
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState('');

  const calculate = () => {
    setError('');
    setResults([]);
    try {
      const fields = expression.trim().split(/\s+/);
      if (fields.length !== 5) throw new Error('Cron must have 5 fields');

      const [minField, hourField, domField, monField, dowField] = fields;
      const minutes = parseField(minField, 0, 59);
      const hours = parseField(hourField, 0, 23);
      const dom = parseField(domField, 1, 31);
      const months = parseField(monField, 1, 12);
      const dow = parseField(dowField, 0, 7);

      const start = new Date(baseTime);
      if (Number.isNaN(start.getTime())) throw new Error('Invalid base time');
      start.setSeconds(0, 0);

      const hits: string[] = [];
      const cursor = new Date(start.getTime() + 60000);
      let guard = 0;
      while (hits.length < 5 && guard < 500000) {
        guard += 1;
        const minute = cursor.getMinutes();
        const hour = cursor.getHours();
        const day = cursor.getDate();
        const month = cursor.getMonth() + 1;
        const weekday = cursor.getDay();
        const weekdayAlt = weekday === 0 ? 7 : weekday;

        if (
          minutes.has(minute) &&
          hours.has(hour) &&
          dom.has(day) &&
          months.has(month) &&
          (dow.has(weekday) || dow.has(weekdayAlt))
        ) {
          hits.push(`${cursor.toLocaleString()} | ${cursor.toISOString()}`);
        }
        cursor.setMinutes(cursor.getMinutes() + 1);
      }

      if (hits.length === 0) throw new Error('No upcoming runs found');
      setResults(hits);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <CalendarClock className="text-orange-400" /> Cron Parser
      </h2>

      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
        <input
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          placeholder="*/5 * * * *"
          className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200 font-mono"
        />
        <div className="flex items-center gap-3">
          <input
            type="datetime-local"
            value={baseTime}
            onChange={(e) => setBaseTime(e.target.value)}
            className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
          />
          <button
            onClick={calculate}
            className="px-4 py-2 bg-orange-500 text-black font-bold rounded-lg hover:bg-orange-400"
          >
            Next 5 runs
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-900/20 border border-red-500/50 p-3 rounded-lg text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((item, idx) => (
            <div key={`${item}-${idx}`} className="bg-dark-900 border border-dark-700 rounded-lg p-3 text-xs text-orange-300 font-mono">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CronParser;
