import React, { useState, useEffect, useRef } from 'react';
import { FileText, Archive, Plus, Trash2, ZoomOut, ZoomIn, Undo, Redo, Columns, Eye, Edit3, Minimize, Maximize, Code, Type, FileCode, Download, Search } from 'lucide-react';
import { Note } from '../../types';

// Declare marked for TypeScript since it's loaded via CDN
declare global {
  interface Window {
    marked: {
      parse: (text: string) => string;
    };
  }
}

const Notepad = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [status, setStatus] = useState('Sync');
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [focusMode, setFocusMode] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Undo/Redo State
  const [history, setHistory] = useState<string[]>([]);
  const [historyStep, setHistoryStep] = useState(0);
  const historyTimeoutRef = useRef<any>(null);

  // Refs for Scroll Sync
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollLock = useRef(false);

  // Load from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('at_notepad_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotes(parsed);
          // Only set activeId if it matches an existing note, otherwise default to first
          const firstId = parsed[0].id;
          setActiveId((prev) => parsed.find(n => n.id === prev) ? prev : firstId);
        } else {
          initializeDefault();
        }
      } else {
        // Migration or First Load
        const old = localStorage.getItem('neo_notepad');
        initializeDefault(old || undefined);
      }
    } catch (e) {
      console.error("Failed to load notes", e);
      initializeDefault();
    }
  }, []);

  // Initialize history when note switches (but not when just typing)
  useEffect(() => {
    const note = notes.find(n => n.id === activeId);
    if (note) {
      setHistory([note.content]);
      setHistoryStep(0);
      if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    }
  }, [activeId]); 

  // Sync scrolling handler
  const handleScroll = (source: 'editor' | 'preview') => {
    if (viewMode !== 'split' || scrollLock.current) return;
    
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    scrollLock.current = true;
    
    if (source === 'editor') {
        const ratio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
        preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
    } else {
        const ratio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
        editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight);
    }

    setTimeout(() => scrollLock.current = false, 50);
  };

  const initializeDefault = (content?: string) => {
     const initial: Note = {
      id: Date.now().toString(),
      title: 'Quick Note',
      content: content || '# Welcome to AT Notepad!\n\nThis is a **markdown-supported** editor.\n\n- [x] Multi-notes support\n- [x] Code highlighting mode\n- [x] Distraction-free writing\n- [x] Split View & Sync Scroll\n\n```js\nconsole.log("Happy Coding!");\n```',
      isCode: false,
      updatedAt: Date.now()
    };
    setNotes([initial]);
    setActiveId(initial.id);
  };

  // Auto-save effect
  useEffect(() => {
    if (notes.length === 0) return;
    localStorage.setItem('at_notepad_v2', JSON.stringify(notes));
    setStatus('Saved');
  }, [notes]);

  // Safe derivation of activeNote
  const activeNote = notes.find(n => n.id === activeId) || notes[0];
  
  // Filter notes based on search query
  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Calculate stats
  const wordCount = activeNote?.content.trim() ? activeNote.content.trim().split(/\s+/).length : 0;
  const charCount = activeNote?.content.length || 0;

  const createNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: 'New Note',
      content: '',
      isCode: false,
      updatedAt: Date.now()
    };
    setNotes([newNote, ...notes]);
    setActiveId(newNote.id);
    setViewMode('edit');
    setSearchQuery(''); // Clear search on new note
  };

  const deleteNote = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const filtered = notes.filter(n => n.id !== id);
    if (filtered.length === 0) {
       // Don't allow empty list, recreate default
       initializeDefault();
    } else {
      setNotes(filtered);
      if (id === activeId) {
        setActiveId(filtered[0].id);
      }
    }
  };

  const updateActiveNote = (updates: Partial<Note>) => {
    if (!activeNote) return;
    setStatus('Typing...');
    setNotes(prev => prev.map(n => n.id === activeNote.id ? { ...n, ...updates } : n));
  };

  const exportAllNotes = () => {
    const jsonString = JSON.stringify(notes, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `at_notes_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const downloadAsMd = () => {
    const blob = new Blob([activeNote.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNote.title.replace(/\s+/g, '_') || 'note'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTextChange = (val: string) => {
    updateActiveNote({ content: val });
    
    // Debounce pushing to history
    if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    historyTimeoutRef.current = setTimeout(() => {
       setHistory(prev => {
         // Current valid history based on step
         const validHistory = prev.slice(0, historyStep + 1);
         // Don't push if no change
         if (validHistory[validHistory.length - 1] === val) return prev;
         
         const newHistory = [...validHistory, val];
         // Limit history stack size if needed (e.g. 100)
         if (newHistory.length > 100) newHistory.shift();
         
         return newHistory;
       });
       // Sync step. Since we pushed 1 item (or shifted), we point to last.
       setHistoryStep(prevStep => {
           return prevStep + 1;
       });
    }, 500); 
  };
  
  // Re-sync step if it drifts (safety)
  useEffect(() => {
    if (historyStep >= history.length && history.length > 0) {
      setHistoryStep(history.length - 1);
    }
  }, [history]);

  const undo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      const prevContent = history[newStep];
      updateActiveNote({ content: prevContent });
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      const nextContent = history[newStep];
      updateActiveNote({ content: nextContent });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Undo / Redo Shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
       e.preventDefault();
       redo();
       return;
    }

    if (activeNote?.isCode && e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      
      handleTextChange(newVal);
      
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  };

  const getMarkdownHtml = (text: string) => {
    if (window.marked) {
      try {
        return window.marked.parse(text);
      } catch (e) {
        return text;
      }
    }
    return text;
  };

  // Fallback loading UI only if no notes exist yet
  if (!activeNote) return <div className="p-10 text-center animate-pulse text-gray-500">Initializing editor...</div>;

  // Determine container classes based on Focus Mode
  const wrapperClass = focusMode 
    ? "fixed inset-0 z-[100] bg-dark-900 flex flex-col p-4 md:p-8" 
    : "h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6";

  const editorClass = focusMode
    ? "flex-1 flex flex-col bg-dark-800 rounded-xl border border-dark-700 overflow-hidden shadow-2xl max-w-7xl mx-auto w-full"
    : "flex-1 flex flex-col bg-dark-800 rounded-xl border border-dark-700 overflow-hidden shadow-xl";

  return (
    <div className={wrapperClass}>
      {/* Sidebar List (Hidden in Focus Mode) */}
      {!focusMode && (
        <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="text-yellow-500" /> Notes</h2>
            <div className="flex gap-2">
               <button
                 onClick={exportAllNotes}
                 className="p-2 bg-dark-700 text-gray-400 rounded-lg hover:text-white hover:bg-dark-600 transition-colors"
                 title="Backup All Notes (JSON)"
               >
                 <Archive size={18} />
               </button>
               <button onClick={createNote} className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg hover:bg-yellow-500/20 transition-colors"><Plus size={20}/></button>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text" 
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-dark-800 border border-dark-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-yellow-500/50 transition-colors placeholder-gray-600"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filteredNotes.length === 0 && searchQuery && (
              <div className="text-center text-gray-600 text-xs py-4">No notes found</div>
            )}
            {filteredNotes.map(note => (
              <div 
                key={note.id}
                onClick={() => setActiveId(note.id)}
                className={`p-3 rounded-xl border cursor-pointer group transition-all ${activeId === note.id ? 'bg-yellow-500/10 border-yellow-500 text-white' : 'bg-dark-800 border-dark-700 text-gray-400 hover:border-gray-600'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="truncate font-medium text-sm pr-2">{note.title || 'Untitled'}</div>
                  <button 
                    onClick={(e) => deleteNote(e, note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                    title="Delete Note"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="text-xs opacity-50 truncate mt-1">{note.content || 'Empty note...'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor Area */}
      <div className={editorClass}>
        {/* Toolbar */}
        <div className="p-3 border-b border-dark-700 flex justify-between items-center bg-dark-900/50">
          <input 
            value={activeNote.title}
            onChange={(e) => updateActiveNote({ title: e.target.value })}
            className="bg-transparent font-bold text-gray-200 outline-none w-full mr-4 placeholder-gray-600 focus:text-white transition-colors"
            placeholder="Note Title"
          />
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2 mr-4 text-xs text-gray-500 font-mono">
               <span>{wordCount} words</span>
               <span className="w-px h-3 bg-dark-600"></span>
               <span>{charCount} chars</span>
               <span className="w-px h-3 bg-dark-600"></span>
               <span className="uppercase">{status}</span>
            </div>

            {/* Font Size Controls */}
            <div className="hidden sm:flex items-center bg-dark-700 rounded-lg mr-2">
              <button onClick={() => setFontSize(s => Math.max(10, s-2))} className="p-1.5 hover:text-white text-gray-400"><ZoomOut size={14}/></button>
              <span className="text-xs w-6 text-center font-mono">{fontSize}</span>
              <button onClick={() => setFontSize(s => Math.min(32, s+2))} className="p-1.5 hover:text-white text-gray-400"><ZoomIn size={14}/></button>
            </div>

            {/* Undo / Redo */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <>
                <button onClick={undo} disabled={historyStep <= 0} className="p-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors" title="Undo"><Undo size={18} /></button>
                <button onClick={redo} disabled={historyStep >= history.length - 1} className="p-2 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors" title="Redo"><Redo size={18} /></button>
                <div className="w-px h-6 bg-dark-700 mx-1"></div>
              </>
            )}

            {/* Split View Toggle */}
            <button 
               onClick={() => setViewMode(viewMode === 'split' ? 'edit' : 'split')}
               className={`hidden md:block p-2 rounded-lg text-gray-400 hover:text-white transition-colors ${viewMode === 'split' ? 'text-neon-cyan bg-neon-cyan/10' : ''}`}
               title="Split View"
            >
               <Columns size={18} />
            </button>

            {/* View Mode Toggle (Mobile/Simple) */}
            <button 
               onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
               className={`md:hidden p-2 rounded-lg text-gray-400 hover:text-white transition-colors ${viewMode === 'preview' ? 'text-neon-cyan bg-neon-cyan/10' : ''}`}
            >
               {viewMode === 'edit' ? <Eye size={18} /> : <Edit3 size={18} />}
            </button>

            {/* Focus Mode */}
            <button
               onClick={() => setFocusMode(!focusMode)}
               className={`p-2 rounded-lg text-gray-400 hover:text-white transition-colors ${focusMode ? 'text-yellow-500 bg-yellow-500/10' : ''}`}
               title="Focus Mode"
            >
               {focusMode ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            
            <div className="w-px h-6 bg-dark-700 mx-1"></div>

            {/* Code Mode (Only in edit/split) */}
            {(viewMode !== 'preview') && (
              <button 
                onClick={() => updateActiveNote({ isCode: !activeNote.isCode })}
                className={`p-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-colors ${activeNote.isCode ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-dark-700 text-gray-400 hover:text-white'}`}
                title={activeNote.isCode ? "Switch to Text Mode" : "Switch to Code Mode"}
              >
                {activeNote.isCode ? <Code size={16}/> : <Type size={16}/>}
              </button>
            )}

            {/* Downloads */}
            <button onClick={downloadAsMd} className="p-2 hover:bg-dark-700 rounded-lg text-gray-400 hover:text-white transition-colors" title="Export as Markdown (.md)">
              <FileCode size={18} />
            </button>
            <button 
              onClick={() => {
                const blob = new Blob([activeNote.content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${activeNote.title.replace(/\s+/g, '_') || 'note'}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="p-2 hover:bg-dark-700 rounded-lg text-gray-400 hover:text-white transition-colors"
              title="Download as .txt"
            >
              <Download size={18} />
            </button>
          </div>
        </div>
        
        {/* Content Area - Split View Logic */}
        <div className="flex-1 flex overflow-hidden">
           {/* Editor Pane */}
           {(viewMode === 'edit' || viewMode === 'split') && (
             <textarea 
               ref={editorRef}
               className={`flex-1 w-full bg-dark-800 p-6 text-gray-300 focus:outline-none resize-none leading-relaxed selection:bg-yellow-500/30 ${activeNote.isCode ? 'font-mono' : 'font-sans'} ${viewMode === 'split' ? 'border-r border-dark-700' : ''}`}
               style={{ fontSize: `${fontSize}px` }}
               placeholder={activeNote.isCode ? "// Start coding..." : "Start typing (Markdown supported)..."}
               value={activeNote.content}
               onChange={(e) => handleTextChange(e.target.value)}
               onKeyDown={handleKeyDown}
               onScroll={() => handleScroll('editor')}
               spellCheck={!activeNote.isCode}
               autoFocus
             />
           )}

           {/* Preview Pane */}
           {(viewMode === 'preview' || viewMode === 'split') && (
             <div 
               ref={previewRef}
               onScroll={() => handleScroll('preview')}
               className="flex-1 w-full bg-dark-800 p-6 md:p-10 text-gray-300 overflow-y-auto markdown-preview border-l border-dark-900"
               style={{ fontSize: `${fontSize}px` }}
               dangerouslySetInnerHTML={{ __html: getMarkdownHtml(activeNote.content) }}
             />
           )}
        </div>
      </div>
    </div>
  );
};

export default Notepad;