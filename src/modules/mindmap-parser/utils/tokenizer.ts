/**
 * A very simple tokenizer. In a real-world scenario, you might use a more
 * sophisticated library that handles stop words, stemming, etc.
 * This version converts to lowercase, splits by non-alphanumeric characters,
 * and removes empty strings and duplicates.
 * @param text The text to tokenize.
 * @returns A Set of unique keywords.
 */
export function simpleTokenize(text: string): Set<string> {
  if (!text) {
    return new Set();
  }

  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/) // Splits by non-alphanumeric chars, including Chinese characters
    .filter((token) => token && token.length > 1); // Filter out empty and single-character tokens

  return new Set(tokens);
}
