
import React from 'react';
import { TikTokVideoData } from '../types';

interface HistorySectionProps {
  history: TikTokVideoData[];
  onView: (item: TikTokVideoData) => void;
  onDownload: (url: string, filename: string) => void;
  onClear: () => void;
  t: any;
}

const HistorySection: React.FC<HistorySectionProps> = ({ history, onView, onDownload, onClear, t }) => {
  if (history.length === 0) return null;

  return (
    <section className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          {t.historyTitle} <span className="ml-1 text-slate-700">({history.length})</span>
        </h3>
        <button 
          onClick={onClear}
          className="text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-red-500 transition-colors"
        >
          {t.clearHistory}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {history.map((item) => (
          <div 
            key={item.id} 
            className="group relative bg-slate-900/40 rounded-xl border border-white/5 overflow-hidden hover:border-pink-500/30 transition-all hover:shadow-2xl hover:shadow-pink-500/5"
          >
            {/* Thumbnail */}
            <div className="aspect-[9/16] relative overflow-hidden">
              <img 
                src={item.cover} 
                className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-110 transition-all duration-500" 
                alt="history-thumb" 
              />
              
              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                <button 
                  onClick={() => onView(item)}
                  className="w-full py-2 bg-white text-black text-[9px] font-black uppercase tracking-tighter rounded-lg hover:bg-pink-500 hover:text-white transition-all transform translate-y-2 group-hover:translate-y-0 duration-300"
                >
                  {t.viewNow}
                </button>
                <button 
                  onClick={() => onDownload(item.play, `tokdown-${item.id}.mp4`)}
                  className="w-full py-2 bg-slate-800 text-white text-[9px] font-black uppercase tracking-tighter rounded-lg hover:bg-slate-700 transition-all transform translate-y-2 group-hover:translate-y-0 duration-300 delay-75"
                >
                  {t.downloadAgain}
                </button>
              </div>

              {/* Author Badge */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 pointer-events-none group-hover:opacity-0 transition-opacity">
                <img src={item.author.avatar} className="w-4 h-4 rounded-full border border-white/20" alt="av" />
                <span className="text-[8px] font-bold text-white/80 truncate">@{item.author.unique_id}</span>
              </div>
            </div>
            
            {/* Title Mini */}
            <div className="p-2 border-t border-white/5 bg-black/20">
              <p className="text-[9px] text-slate-400 truncate font-medium">
                {item.title || "No title"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HistorySection;
