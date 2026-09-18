import type { ExperienceNoteFormat, SessionSource } from "./practice-pack";

export type ReferenceFact = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  source: "faq" | "policy";
};

export type ExperienceNote = {
  id: string;
  text: string;
  format: ExperienceNoteFormat;
  kind: "approved-practice-advice" | "personal-coaching-note";
};

export type SourceProvenance = Readonly<{
  sourceUrl?: string;
  contentHash: string;
}>;

export const getSourceText = (source: SessionSource): string =>
  source.kind === "pasted-text" ? source.text.trim() : source.snapshot?.extractedText.trim() ?? "";

export const createSourceContentHash = (sourceText: string): string => {
  let hash = 5381;
  for (const character of sourceText) {
    hash = (hash * 33) ^ character.charCodeAt(0);
  }
  return `local:${(hash >>> 0).toString(16)}`;
};

export const createSourceProvenance = (
  source: SessionSource,
  sourceText: string,
): SourceProvenance =>
  Object.freeze({
    ...(source.kind === "public-https-link" ? { sourceUrl: source.url } : {}),
    contentHash:
      source.kind === "public-https-link" && source.confirmation === "confirmed"
        ? source.snapshot.contentHash
        : createSourceContentHash(sourceText),
  });

const keywordsFor = (value: string): string[] =>
  [...new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])].slice(0, 8);

const questionAnswerPairs = (sourceText: string): Array<{ question: string; answer: string }> => {
  const pairs = [...sourceText.matchAll(/(?:^|\n)\s*(?:q(?:uestion)?\s*[:\-])\s*([\s\S]+?)\s*\n\s*(?:a(?:nswer)?\s*[:\-])\s*([\s\S]+?)(?=\n\s*(?:q(?:uestion)?\s*[:\-])|$)/gi)];
  if (pairs.length > 0) {
    return pairs.map((pair) => ({ question: pair[1].trim(), answer: pair[2].trim() }));
  }

  return sourceText
    .split(/\n{2,}|\n(?=[A-Z][^\n]{0,80}:)/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => ({ question: `Reference detail ${index + 1}`, answer: paragraph }));
};

const normalizeFactText = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Exact duplicate entries (normalized question + answer together) are dropped;
// the same answer under a different question is retained on purpose.
const dedupePairs = <T extends { question: string; answer: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${normalizeFactText(item.question)}\u0000${normalizeFactText(item.answer)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const dedupeDetails = <T extends { question: string; answer: string }>(items: T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeFactText(item.answer);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const normalizeReferenceFacts = (
  sourceText: string,
  notes: ExperienceNote[],
): ReferenceFact[] => {
  const sourceFacts = dedupeDetails(dedupePairs(questionAnswerPairs(sourceText).map((pair, index) => ({
    id: `source-fact-${index + 1}`,
    question: pair.question,
    answer: pair.answer,
    keywords: keywordsFor(`${pair.question} ${pair.answer}`),
    source: (/policy|refund|cancel|return/i.test(`${pair.question} ${pair.answer}`) ? "policy" : "faq") as "faq" | "policy",
  }))));

  const approvedAdviceFacts = notes
    .filter((note) => note.kind === "approved-practice-advice" && note.text.trim())
    .map((note) => ({
      id: `note-${note.id}`,
      question: "Approved practice advice",
      answer: note.text.trim(),
      keywords: keywordsFor(note.text),
      source: "policy" as const,
    }));

  return [...sourceFacts, ...approvedAdviceFacts];
};
