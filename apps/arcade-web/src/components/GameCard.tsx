import React from 'react';
import { Play, Star, Heart } from 'lucide-react';
import { Game } from '../types';

interface GameCardProps {
  game: Game;
  onClick: (slug: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent, gameId: string) => void;
  style?: React.CSSProperties;
}

const GameCard: React.FC<GameCardProps> = ({ game, onClick, isFavorite = false, onToggleFavorite, style }) => {
  return (
    <div 
      className="group relative bg-[#12121a] rounded-2xl overflow-hidden border border-white/5 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:border-purple-500/30 hover:shadow-[0_10px_30px_-10px_rgba(168,83,186,0.3)] cursor-pointer"
      onClick={() => onClick(game.slug)}
      style={style}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {/* Fallback image logic */}
        <img 
          src={game.thumbnail} 
          alt={game.name} 
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/600x400/1e1e24/FFF?text=${encodeURIComponent(game.name)}`;
          }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300" />
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px]">
          <div className="bg-gradient-to-tr from-purple-600 to-pink-600 p-4 rounded-full transform scale-50 group-hover:scale-100 transition-all duration-300 shadow-lg shadow-purple-500/40">
            <Play fill="white" className="text-white ml-1" size={24} />
          </div>
        </div>

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
             {/* Category Badge */}
             <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-purple-300 border border-white/10 shadow-sm">
                {game.category}
             </span>

             {/* Rating Badge */}
             <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 border border-white/10 shadow-sm">
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-bold text-white">{game.rating}</span>
             </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 relative z-10 bg-[#12121a] group-hover:bg-[#161620] transition-colors border-t border-white/5">
        <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 mr-2">
                <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors truncate">{game.name}</h3>
                <p className="text-slate-500 text-xs mt-1 truncate group-hover:text-slate-400 transition-colors">
                    {game.folder.replace('games/', '')}
                </p>
            </div>
            
            {/* Favorite Button */}
            <button 
                onClick={(e) => onToggleFavorite && onToggleFavorite(e, game.id)}
                className={`p-2 rounded-full transition-all duration-200 ${
                    isFavorite 
                    ? 'bg-pink-500/20 text-pink-500 hover:bg-pink-500/30' 
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white hover:scale-110'
                }`}
            >
                <Heart size={16} className={isFavorite ? 'fill-pink-500' : ''} />
            </button>
        </div>
      </div>
    </div>
  );
};

export const GameCardSkeleton = () => (
    <div className="rounded-2xl overflow-hidden bg-[#12121a] border border-white/5 animate-pulse">
        <div className="aspect-[4/3] bg-white/5" />
        <div className="p-4 space-y-3">
            <div className="h-5 bg-white/10 rounded w-3/4" />
            <div className="h-3 bg-white/5 rounded w-1/2" />
        </div>
    </div>
);

export default GameCard;
