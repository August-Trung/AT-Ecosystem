import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Maximize2, RotateCcw, Share2, Info, Clock, Play, Check, Heart } from 'lucide-react';
import { gameList } from '../data/gameList';
import { Game } from '../types';
import GameCard from '../components/GameCard';

const PlayGame: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | undefined>(undefined);
  const [playTime, setPlayTime] = useState(0); // In seconds
  const [isLoading, setIsLoading] = useState(true); // Iframe loading state
  const [copied, setCopied] = useState(false); // Share state
  const [isFavorite, setIsFavorite] = useState(false); // Favorite state

  // Timer Ref
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<number | undefined>(undefined);

  // Load Game & Init Timer
  useEffect(() => {
    setIsLoading(true); // Reset loading on slug change

    // 1. Find Game
    const foundGame = gameList.find((g) => g.slug === slug);
    setGame(foundGame);

    if (foundGame) {
      // 2. Load total playtime from storage
      const savedTimes = JSON.parse(localStorage.getItem('arcade_playtime') || '{}');
      setPlayTime(savedTimes[foundGame.id] || 0);

      // 3. Check favorite status
      const favs = JSON.parse(localStorage.getItem('arcade_favorites') || '[]');
      setIsFavorite(favs.includes(foundGame.id));

      // Reset session timer
      startTimeRef.current = Date.now();

      // 4. Save to History (Recently Played)
      const storedRecents = localStorage.getItem('arcade_recents');
      let recentIds: string[] = storedRecents ? JSON.parse(storedRecents) : [];
      recentIds = recentIds.filter(id => id !== foundGame.id);
      recentIds.unshift(foundGame.id);
      localStorage.setItem('arcade_recents', JSON.stringify(recentIds.slice(0, 10)));
    }

    // 5. Start Ticking
    timerRef.current = window.setInterval(() => {
      setPlayTime(prev => prev + 1);

      // Save every 5 seconds to storage (prevent data loss on crash)
      if (foundGame) {
        const savedTimes = JSON.parse(localStorage.getItem('arcade_playtime') || '{}');
        savedTimes[foundGame.id] = (savedTimes[foundGame.id] || 0) + 1;
        localStorage.setItem('arcade_playtime', JSON.stringify(savedTimes));
      }
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
    };
  }, [slug]);

  const toggleFullscreen = () => {
    const elem = document.getElementById('game-wrapper');
    if (!document.fullscreenElement) {
      elem?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const reloadGame = () => {
    setIsLoading(true);
    const iframe = document.getElementById('game-iframe') as HTMLIFrameElement;
    if (iframe) {
      // eslint-disable-next-line no-self-assign
      iframe.src = iframe.src;
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFavorite = () => {
    if (!game) return;
    const favs = JSON.parse(localStorage.getItem('arcade_favorites') || '[]');
    let newFavs;
    if (favs.includes(game.id)) {
      newFavs = favs.filter((id: string) => id !== game.id);
      setIsFavorite(false);
    } else {
      newFavs = [...favs, game.id];
      setIsFavorite(true);
    }
    localStorage.setItem('arcade_favorites', JSON.stringify(newFavs));
  };

  // Logic: Get Related Games (Same Category, Exclude Current)
  const relatedGames = useMemo(() => {
    if (!game) return [];
    return gameList
      .filter(g => g.category === game.category && g.id !== game.id)
      .slice(0, 4); // Take top 4
  }, [game]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  if (!game) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#050505] text-white">
        <h2 className="text-2xl font-bold mb-4">Game not found</h2>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-purple-600 rounded-full hover:bg-purple-700">Back to Home</button>
      </div>
    );
  }

  const getGamePath = (folder: string) => {
    // Ensure base url handles subpaths correctly
    const cleanFolder = folder.startsWith('/') ? folder.substring(1) : folder;
    return `${(import.meta as any).env.BASE_URL}${cleanFolder}/index.html`;
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] overflow-hidden relative">
      <div className="absolute inset-0 bg-purple-900/10 blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="h-16 flex-none flex items-center justify-between px-6 bg-[#0a0a0e]/90 border-b border-white/5 z-20 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex flex-col">
            <h1 className="font-bold text-white tracking-tight leading-tight">{game.name}</h1>
            <span className="text-xs text-purple-400 font-medium">{game.category}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono">
            <Clock size={12} />
            <span>{formatTime(playTime)}</span>
          </div>

          <button
            onClick={handleShare}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${copied ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-white/5 border-transparent hover:bg-white/10 text-slate-300'}`}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>

          <button
            onClick={handleToggleFavorite}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isFavorite
                ? 'bg-pink-500/10 text-pink-500 border border-pink-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
          >
            <Heart size={14} className={isFavorite ? 'fill-pink-500' : ''} />
            <span className="hidden sm:inline">{isFavorite ? 'Liked' : 'Like'}</span>
          </button>
        </div>
      </header>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col items-center p-4 lg:p-8 min-h-full">

          {/* Game Wrapper */}
          <div
            id="game-wrapper"
            className="w-full max-w-6xl aspect-video bg-black rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 relative group shrink-0"
          >
            {/* Loading Spinner */}
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0e] z-10">
                <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-purple-400 text-sm font-medium animate-pulse">Loading Game...</p>
              </div>
            )}

            {/* Controls */}
            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex gap-2">
              <button onClick={reloadGame} className="p-2 bg-black/50 text-white rounded-lg hover:bg-purple-600 backdrop-blur-md transition-colors" title="Reload">
                <RotateCcw size={18} />
              </button>
              <button onClick={toggleFullscreen} className="p-2 bg-black/50 text-white rounded-lg hover:bg-purple-600 backdrop-blur-md transition-colors" title="Fullscreen">
                <Maximize2 size={18} />
              </button>
            </div>

            <iframe
              id="game-iframe"
              src={getGamePath(game.folder)}
              title={game.name}
              onLoad={() => setIsLoading(false)}
              className={`w-full h-full border-0 block transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; gamepad"
              allowFullScreen
            />
          </div>

          {/* Info Bar */}
          <div className="w-full max-w-6xl mt-4 flex items-start gap-4 p-4 bg-[#12121a] rounded-2xl border border-white/5">
            <div className="p-3 bg-purple-500/10 rounded-full text-purple-400">
              <Info size={24} />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1">About {game.name}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{game.description || `Enjoy playing ${game.name} on AugustTrung Arcade. Use your keyboard or mouse to control the game.`}</p>
            </div>
          </div>

          {/* Related Games */}
          {relatedGames.length > 0 && (
            <div className="w-full max-w-6xl mt-12 mb-12">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Play size={20} className="text-purple-500" />
                You Might Also Like
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {relatedGames.map(g => (
                  <GameCard
                    key={g.id}
                    game={g}
                    onClick={(s) => navigate(`/play/${s}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayGame;