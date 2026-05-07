
import React, { useState } from 'react';
import { GitCompare, ArrowRightLeft, Trash2, FileText, Columns, List, Check, Copy } from 'lucide-react';

type DiffType = 'eq' | 'del' | 'add';
interface DiffLine {
  type: DiffType;
  content: string;
  originalIndex?: number;
  modifiedIndex?: number;
}

const DiffChecker = () => {
  const [original, setOriginal] = useState('');
  const [modified, setModified] = useState('');
  const [diffs, setDiffs] = useState<DiffLine[]>([]);
  const [hasCompared, setHasCompared] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');

  // Simple LCS (Longest Common Subsequence) Algorithm for Line Diffing
  const computeDiff = () => {
    const lines1 = original.split('\n');
    const lines2 = modified.split('\n');
    
    // Matrix initialization
    const matrix: number[][] = [];
    for (let i = 0; i <= lines1.length; i++) {
      matrix[i] = new Array(lines2.length + 1).fill(0);
    }

    // Fill matrix
    for (let i = 1; i <= lines1.length; i++) {
      for (let j = 1; j <= lines2.length; j++) {
        if (lines1[i - 1] === lines2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1] + 1;
        } else {
          matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
        }
      }
    }

    // Backtrack to find diff
    const result: DiffLine[] = [];
    let i = lines1.length;
    let j = lines2.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && lines1[i - 1] === lines2[j - 1]) {
        result.unshift({ type: 'eq', content: lines1[i - 1], originalIndex: i, modifiedIndex: j });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
        result.unshift({ type: 'add', content: lines2[j - 1], modifiedIndex: j });
        j--;
      } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
        result.unshift({ type: 'del', content: lines1[i - 1], originalIndex: i });
        i--;
      }
    }

    setDiffs(result);
    setHasCompared(true);
  };

  const loadSample = () => {
    setOriginal(`{
  "app_name": "AT Tools",
  "version": "1.0.0",
  "features": [
    "QR Generator",
    "IP Lookup"
  ],
  "debug": false
}`);
    setModified(`{
  "app_name": "AT Tools Pro",
  "version": "2.0.0",
  "features": [
    "QR Generator",
    "IP Lookup",
    "Diff Checker"
  ],
  "debug": true
}`);
    setHasCompared(false);
  };

  const clear = () => {
    setOriginal('');
    setModified('');
    setDiffs([]);
    setHasCompared(false);
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2"><GitCompare className="text-orange-400" /> Diff Checker</h2>
        
        <div className="flex items-center gap-3">
             <div className="flex bg-dark-800 p-1 rounded-lg border border-dark-700">
                 <button 
                   onClick={() => setViewMode('split')}
                   className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-colors ${viewMode === 'split' ? 'bg-orange-500 text-black' : 'text-gray-400 hover:text-white'}`}
                 >
                   <Columns size={14}/> Split
                 </button>
                 <button 
                   onClick={() => setViewMode('unified')}
                   className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-colors ${viewMode === 'unified' ? 'bg-orange-500 text-black' : 'text-gray-400 hover:text-white'}`}
                 >
                   <List size={14}/> Unified
                 </button>
             </div>
             <button onClick={loadSample} className="px-4 py-2 bg-dark-800 text-xs font-bold text-gray-400 hover:text-white rounded-lg border border-dark-700">Sample</button>
             <button onClick={clear} className="px-4 py-2 bg-dark-800 text-xs font-bold text-red-400 hover:text-red-300 rounded-lg border border-dark-700">Clear</button>
        </div>
      </div>

      {!hasCompared ? (
         <div className="flex-1 grid md:grid-cols-2 gap-6 min-h-0">
            <div className="flex flex-col">
               <label className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-2"><FileText size={14}/> Original Text</label>
               <textarea 
                 value={original}
                 onChange={(e) => setOriginal(e.target.value)}
                 className="flex-1 bg-dark-800 border border-dark-700 rounded-xl p-4 font-mono text-sm text-gray-300 focus:outline-none focus:border-orange-500/50 resize-none"
                 placeholder="Paste original text here..."
                 spellCheck={false}
               />
            </div>
            <div className="flex flex-col">
               <label className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-2"><FileText size={14}/> Modified Text</label>
               <textarea 
                 value={modified}
                 onChange={(e) => setModified(e.target.value)}
                 className="flex-1 bg-dark-800 border border-dark-700 rounded-xl p-4 font-mono text-sm text-gray-300 focus:outline-none focus:border-orange-500/50 resize-none"
                 placeholder="Paste changed text here..."
                 spellCheck={false}
               />
            </div>
            <div className="md:col-span-2 flex justify-center mt-4">
                 <button 
                    onClick={computeDiff}
                    disabled={!original && !modified}
                    className="px-12 py-3 bg-orange-500 hover:bg-orange-400 text-black font-bold rounded-xl shadow-lg shadow-orange-900/20 transition-transform active:scale-95 flex items-center gap-2"
                 >
                    <GitCompare size={20} /> Compare Differences
                 </button>
            </div>
         </div>
      ) : (
         <div className="flex-1 bg-dark-900 border border-dark-700 rounded-xl overflow-hidden flex flex-col min-h-0">
             <div className="bg-dark-800 border-b border-dark-700 p-3 flex justify-between items-center text-xs font-bold text-gray-500 uppercase">
                 <span>Comparison Result</span>
                 <button onClick={() => setHasCompared(false)} className="text-orange-400 hover:underline">Edit Inputs</button>
             </div>
             
             <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full border-collapse font-mono text-xs md:text-sm">
                   <tbody>
                      {diffs.map((line, idx) => {
                         if (viewMode === 'unified') {
                             return (
                                 <tr key={idx} className={`${line.type === 'add' ? 'bg-green-900/20' : line.type === 'del' ? 'bg-red-900/20' : ''}`}>
                                    <td className="w-8 md:w-12 text-right p-1 text-gray-600 select-none border-r border-dark-700 bg-dark-800/30">
                                       {line.type !== 'add' && line.originalIndex}
                                    </td>
                                    <td className="w-8 md:w-12 text-right p-1 text-gray-600 select-none border-r border-dark-700 bg-dark-800/30">
                                       {line.type !== 'del' && line.modifiedIndex}
                                    </td>
                                    <td className="w-6 text-center select-none text-gray-500">
                                       {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ''}
                                    </td>
                                    <td className={`p-1 break-all whitespace-pre-wrap ${line.type === 'add' ? 'text-green-400' : line.type === 'del' ? 'text-red-400' : 'text-gray-400'}`}>
                                       {line.content}
                                    </td>
                                 </tr>
                             );
                         } else {
                             // Split View Logic
                             // Note: Simple split implementation. For a true aligned split view, we need to process the diff array to align adds/removes.
                             // This is a simplified split view where we just render lines. 
                             // To make it look like GitHub, we typically handle blocks. 
                             // For simplicity here, we render based on type.
                             return (
                                <tr key={idx} className="border-b border-dark-800/50">
                                   {/* Left Side (Original) */}
                                   <td className={`w-[2%] text-right text-gray-600 p-1 select-none border-r border-dark-700 ${line.type === 'del' ? 'bg-red-900/20' : ''}`}>
                                      {line.type !== 'add' && line.originalIndex}
                                   </td>
                                   <td className={`w-[48%] p-1 break-all whitespace-pre-wrap border-r border-dark-700 ${line.type === 'del' ? 'bg-red-900/20 text-red-300' : line.type === 'add' ? 'bg-dark-900 opacity-30' : 'text-gray-400'}`}>
                                      {line.type !== 'add' && line.content}
                                   </td>

                                   {/* Right Side (Modified) */}
                                   <td className={`w-[2%] text-right text-gray-600 p-1 select-none border-r border-dark-700 ${line.type === 'add' ? 'bg-green-900/20' : ''}`}>
                                      {line.type !== 'del' && line.modifiedIndex}
                                   </td>
                                   <td className={`w-[48%] p-1 break-all whitespace-pre-wrap ${line.type === 'add' ? 'bg-green-900/20 text-green-300' : line.type === 'del' ? 'bg-dark-900 opacity-30' : 'text-gray-400'}`}>
                                      {line.type !== 'del' && line.content}
                                   </td>
                                </tr>
                             )
                         }
                      })}
                   </tbody>
                </table>
                {diffs.length === 0 && (
                   <div className="p-8 text-center text-gray-500">No differences found. Texts are identical.</div>
                )}
             </div>
         </div>
      )}
    </div>
  );
};

export default DiffChecker;
