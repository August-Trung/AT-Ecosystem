import { scannedGames, ScannedGame } from './scannedGames';
import { Game } from '../types';

// Categories list for filtering
export const categories = [
  'All',
  'Action',
  'Puzzle',
  'Racing',
  'Strategy',
  'Arcade',
  'Sports'
];

// Helper to seed random numbers based on a string (game name)
// This ensures the same game always gets the same "random" rating/category if not provided
const seededRandom = (seed: string) => {
  let h = 0xdeadbeef;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
  }
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
};

// Transform scanned games into full Game objects
export const gameList: Game[] = scannedGames.map((sg: ScannedGame) => {
  // Use seeded random to fill in gaps if metadata is missing
  const rand = seededRandom(sg.id);
  
  const randomCategory = categories[Math.floor(rand * (categories.length - 1)) + 1]; // Skip 'All'
  const randomRating = 3.5 + (rand * 1.5); // 3.5 to 5.0
  const randomDesc = `Experience the thrill of ${sg.name}. Master the controls and achieve the highest score in this exciting ${sg.category || randomCategory} game.`;

  return {
    id: sg.id,
    name: sg.name,
    slug: sg.slug,
    folder: sg.folder,
    thumbnail: sg.thumbnail || `https://placehold.co/600x400/1e1e24/FFF?text=${encodeURIComponent(sg.name)}`,
    description: sg.description || randomDesc,
    category: sg.category || randomCategory,
    rating: sg.rating ? Number(sg.rating) : Number(randomRating.toFixed(1))
  };
});
