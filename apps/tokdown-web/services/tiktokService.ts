
import { TikTokResponse } from '../types';

/**
 * Service to fetch TikTok video data using a public API.
 * Using tikwm.com as it is reliable and free for client-side experiments.
 */
export const fetchTikTokData = async (url: string): Promise<TikTokResponse> => {
  const cleanUrl = url.trim();
  if (!cleanUrl) throw new Error("URL is empty");

  try {
    const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}&hd=1`);
    if (!response.ok) {
      throw new Error("Failed to fetch data from server");
    }
    const data: TikTokResponse = await response.json();
    if (data.code !== 0) {
      throw new Error(data.msg || "Unknown API error");
    }
    return data;
  } catch (error) {
    console.error("TikTok Service Error:", error);
    throw error;
  }
};
