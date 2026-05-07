
import React, { useState, useRef } from 'react';
import { TikTokVideoData } from '../types';

interface VideoCardProps {
  data: TikTokVideoData;
  t: any;
}

const VideoCard: React.FC<VideoCardProps> = ({ data, t }) => {
  const [localDownloading, setLocalDownloading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleDownload = async (url: string, filename: string) => {
    setLocalDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setLocalDownloading(false);
    }
  };

  const togglePreview = () => {
    setIsPreviewing(!isPreviewing);
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="glass-morphism rounded-xl overflow-hidden border border-white/10 shadow-xl flex flex-col md:flex-row h-auto md:min-h-[300px]">
        {/* Thumbnail / Video Player Area */}
        <div className="w-full md:w-[240px] relative shrink-0 bg-black group cursor-pointer overflow-hidden">
          {isPreviewing ? (
            <div className="relative w-full h-full aspect-video md:aspect-auto md:h-full">
              <video 
                ref={videoRef}
                src={data.play}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                controls
                playsInline
              />
              <button 
                onClick={(e) => { e.stopPropagation(); togglePreview(); }}
                className="absolute top-2 right-2 z-20 p-1.5 bg-black/60 hover:bg-pink-600 rounded-full text-white transition-colors"
                title="Close Preview"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <div className="absolute top-2 left-2 z-20 px-1.5 py-0.5 bg-pink-600 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">Live Preview</div>
            </div>
          ) : (
            <div className="relative h-full w-full" onClick={togglePreview}>
              <img 
                src={data.cover} 
                alt={data.title} 
                className="w-full h-full object-cover aspect-video md:aspect-auto transition-transform duration-700 group-hover:scale-110"
              />
              {/* Play Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 group-hover:scale-110 group-hover:bg-pink-600/80 transition-all duration-300">
                  <svg className="w-5 h-5 text-white translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                 <div className="bg-pink-600 px-1.5 py-0.5 rounded text-[9px] font-black italic text-white uppercase tracking-tighter shadow-lg">Ultra HD</div>
                 <div className="text-[9px] font-bold text-white/90 bg-black/40 px-1 rounded backdrop-blur-sm">
                   {Math.floor(data.duration / 60)}:{(data.duration % 60).toString().padStart(2, '0')}
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Area */}
        <div className="flex-1 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <img src={data.author.avatar} className="w-9 h-9 rounded-full border border-white/10 shadow-lg" alt={data.author.nickname} />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-blue-500 border-2 border-[#020617] rounded-full flex items-center justify-center">
                    <svg className="w-1.5 h-1.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  </div>
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white text-sm leading-none mb-0.5">{data.author.nickname}</h3>
                  <p className="text-slate-500 text-[10px] font-medium tracking-tight">@{data.author.unique_id}</p>
                </div>
              </div>
              <div className="flex gap-4">
                 <div className="text-right">
                    <span className="block text-white font-black text-xs">{(data.digg_count / 1000).toFixed(1)}K</span>
                    <span className="text-slate-500 text-[8px] uppercase font-black tracking-widest opacity-60">Likes</span>
                 </div>
                 <div className="text-right">
                    <span className="block text-white font-black text-xs">{(data.play_count / 1000).toFixed(1)}K</span>
                    <span className="text-slate-500 text-[8px] uppercase font-black tracking-widest opacity-60">Views</span>
                 </div>
              </div>
            </div>
            
            <p className="text-slate-300 text-[11px] mb-5 line-clamp-3 font-medium text-left leading-relaxed">
              {data.title || "No description available."}
            </p>
          </div>

          <div className="space-y-2.5">
            <button 
              onClick={() => handleDownload(data.play, `tokdown-${data.id}.mp4`)}
              disabled={localDownloading}
              className="w-full py-3 bg-white text-black text-[11px] font-black uppercase tracking-widest rounded-xl transition-all hover:bg-pink-500 hover:text-white flex items-center justify-center gap-2.5 shadow-xl shadow-pink-500/5 active:scale-[0.98] disabled:opacity-50"
            >
              {localDownloading ? (
                <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              )}
              {localDownloading ? t.processing : t.btnNoWm}
            </button>
            
            <div className="grid grid-cols-2 gap-2.5">
              <button 
                onClick={() => handleDownload(data.wmplay, `tokdown-wm-${data.id}.mp4`)}
                className="py-2.5 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M7 7h.01M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"/></svg>
                {t.btnWm}
              </button>
              <button 
                onClick={() => handleDownload(data.music, `tokdown-audio-${data.id}.mp3`)}
                className="py-2.5 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/></svg>
                {t.btnAudio}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
