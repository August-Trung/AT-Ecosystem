import type { ModerationResult } from "../types.js";

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phonePattern = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const handlePattern = /(^|\s)@[a-zA-Z0-9_.-]{2,}/g;
const addressPattern =
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct)\b/gi;

const riskyPhrases = [
  "kill myself",
  "suicide",
  "self-harm",
  "self harm",
  "hurt myself",
  "end my life",
  "end it all",
  "not be alive",
  "i want to die",
  "i'm going to die",
  "im going to die"
];

export const sanitizePersonalInfo = (text: string) =>
  text
    .replace(emailPattern, "[email removed]")
    .replace(phonePattern, "[phone removed]")
    .replace(handlePattern, "$1[handle removed]")
    .replace(addressPattern, "[address removed]");

export const moderateConfession = (text: string): ModerationResult => {
  const normalized = text.toLowerCase();
  const flags: string[] = [];

  if (emailPattern.test(text)) flags.push("email");
  emailPattern.lastIndex = 0;
  if (phonePattern.test(text)) flags.push("phone");
  phonePattern.lastIndex = 0;
  if (handlePattern.test(text)) flags.push("social handle");
  handlePattern.lastIndex = 0;
  if (addressPattern.test(text)) flags.push("address");
  addressPattern.lastIndex = 0;

  const riskyMatch = riskyPhrases.find((phrase) => normalized.includes(phrase));
  if (riskyMatch) {
    flags.push("immediate safety");
    return {
      status: "crisis",
      flags,
      sanitizedText: sanitizePersonalInfo(text),
      message:
        "This sounds urgent. Another Tomorrow cannot turn immediate danger or self-harm content into entertainment. If you might act on these feelings, call or text 988 in the U.S. and Canada, contact local emergency services, or reach someone you trust now."
    };
  }

  if (flags.length > 0) {
    return {
      status: "needs-review",
      flags,
      sanitizedText: sanitizePersonalInfo(text),
      message:
        "Identifying details were detected. Remove names, phone numbers, addresses, emails, social handles, and exact locations before publishing."
    };
  }

  return {
    status: "clear",
    flags,
    sanitizedText: text.trim(),
    message: "Ready for a private draft or anonymous late-night preview."
  };
};

export const isConfessionSubmittable = (text: string, moderation: ModerationResult) =>
  text.trim().length >= 20 && moderation.status !== "crisis";
