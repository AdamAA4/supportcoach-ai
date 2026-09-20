// Deterministic anti-hallucination guard for AI-extracted Q/A pairs.
// Every pair must be grounded in the page's own words: the answer's content
// terms must all appear in the harvested source text, and the question must
// overlap it by at least half. Anything the model invented is dropped here —
// this layer cannot be bypassed by the model misbehaving.

const tokenize = (text: string): string[] => text.toLowerCase().match(/[a-z0-9']+/g) ?? [];

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "is", "are", "was", "were", "be",
  "been", "to", "of", "in", "on", "at", "for", "with", "from", "by", "as",
  "it", "its", "this", "that", "these", "those", "i", "you", "we", "our",
  "your", "their", "my", "me", "us", "they", "them", "he", "she", "his",
  "her", "will", "would", "can", "could", "should", "shall", "may", "might",
  "do", "does", "did", "done", "have", "has", "had", "not", "no", "yes",
  "when", "what", "where", "why", "who", "which", "how", "there", "here",
  "about", "into", "over", "under", "all", "any", "each", "per", "up",
  "out", "so", "than", "then", "too", "very", "just", "also",
]);

const contentTokens = (text: string): string[] =>
  [...new Set(tokenize(text).filter((token) => !STOP_WORDS.has(token)))];

type Pair = { question: string; answer: string };

export const verifyGroundedPairs = (
  pairs: Pair[],
  sourceText: string,
): Pair[] => {
  const allowed = new Set(tokenize(sourceText));
  return pairs.filter((pair) => {
    const answerTerms = contentTokens(pair.answer);
    // Too short to be a real answer (a bare label or fragment).
    if (answerTerms.length < 3) return false;
    // The answer must be stated on the page: every content term present.
    if (!answerTerms.every((term) => allowed.has(term))) return false;
    const questionTerms = contentTokens(pair.question);
    if (questionTerms.length === 0) return false;
    // The question should reference the page by at least half its terms
    // (the model may rephrase, but the topic must come from the source).
    const overlap = questionTerms.filter((term) => allowed.has(term)).length;
    return overlap / questionTerms.length >= 0.5;
  });
};
