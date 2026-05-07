export interface Game {
  id: string;
  name: string;
  folder: string;
  thumbnail: string;
  slug: string;
  description?: string;
  category: string;
  rating: number; // 1 to 5
}