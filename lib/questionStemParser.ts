/**
 * Parses raw question text to separate the textual stem from embedded HTML images.
 * Handles single/multiple <img> tags, container <div>s, and ensures clean text rendering.
 */

export interface ParsedQuestionStem {
  cleanText: string;
  imageUrls: string[];
}

export function parseQuestionStem(raw?: string | null): ParsedQuestionStem {
  if (!raw) {
    return { cleanText: '', imageUrls: [] };
  }

  const imageUrls: string[] = [];

  // 1. Extract all image URLs from <img> tags (src attribute)
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(raw)) !== null) {
    if (match[1] && !imageUrls.includes(match[1])) {
      imageUrls.push(match[1]);
    }
  }

  // 2. Remove HTML containers (<div>, <img>, <p>, etc.) from the text
  let cleanText = raw
    .replace(/<div[\s\S]*?<\/div>/gi, '') // Remove <div...>...</div> blocks
    .replace(/<img[^>]*>/gi, '')          // Remove standalone <img> tags
    .replace(/<\/?[a-z][a-z0-9]*[^<>]*>/gi, '') // Remove any remaining HTML tags
    .trim();

  return { cleanText, imageUrls };
}
