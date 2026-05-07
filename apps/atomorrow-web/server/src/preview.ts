import type { MoodOption } from "../../src/types.js";

export const makePreviewTitle = (mood: MoodOption) => {
  if (mood === "I miss someone") return "A Message Left In The Rain";
  if (mood === "I can't sleep") return "Awake With The Lights Off";
  if (mood === "I feel empty") return "Room Tone For One Person";
  if (mood === "I need a strange story") return "The Confession That Changed Frequency";
  if (mood === "I want to disappear for 10 minutes") return "Ten Minutes Under Another Name";
  return "A Small Ending Before Morning";
};
