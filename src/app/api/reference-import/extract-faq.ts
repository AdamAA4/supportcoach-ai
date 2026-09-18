// Structured FAQ extraction for the public reference importer.
// Converts recognized page structures into "Q: / A:" text pairs that the
// domain fact extractor (normalizeReferenceFacts) consumes unchanged.

export type FaqExtraction = {
  extractedText: string;
  qaPairs: number;
  structured: boolean;
};

type Pair = { question: string; answer: string };

const decodeEntities = (text: string): string => text
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'");

// Block-level closers become line breaks so paragraph structure survives
// inside each extracted answer; inline tags collapse to spaces.
const blockText = (html: string): string => decodeEntities(
  html
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote|dd|dt|table|ul|ol|main|figure|figcaption)>/gi, "\n")
    .replace(/<br[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n"),
);

const stripInvisible = (html: string): string => html
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<(script|style|noscript|template|svg|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, "");

const isQuestionType = (value: unknown): boolean =>
  typeof value === "string" && /question/i.test(value);

// FAQPage structured data (JSON-LD): @type Question with acceptedAnswer.
const collectJsonLdQuestions = (node: unknown, pairs: Pair[]): void => {
  if (Array.isArray(node)) { node.forEach((entry) => collectJsonLdQuestions(entry, pairs)); return; }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  if (Array.isArray(record["@graph"])) { record["@graph"].forEach((entry) => collectJsonLdQuestions(entry, pairs)); }
  if (isQuestionType(record["@type"]) && typeof record.name === "string") {
    const accepted = record.acceptedAnswer as Record<string, unknown> | string | undefined;
    const answer = typeof accepted === "string" ? accepted : typeof accepted?.text === "string" ? accepted.text : "";
    if (answer.trim()) pairs.push({ question: blockText(record.name), answer: blockText(answer) });
    return;
  }
  if (Array.isArray(record.mainEntity)) record.mainEntity.forEach((entry) => collectJsonLdQuestions(entry, pairs));
};

const extractJsonLdPairs = (html: string): { pairs: Pair[]; rest: string } => {
  const pairs: Pair[] = [];
  const rest = html.replace(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    (_match, payload: string) => {
      try { collectJsonLdQuestions(JSON.parse(payload), pairs); } catch { /* malformed JSON-LD is skipped */ }
      return "";
    },
  );
  return { pairs, rest };
};

const extractDetailsPairs = (html: string): { pairs: Pair[]; rest: string } => {
  const pairs: Pair[] = [];
  const rest = html.replace(
    /<details\b[^>]*>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi,
    (_match, summary: string, content: string) => {
      const question = blockText(summary);
      const answer = blockText(content);
      if (question && answer) pairs.push({ question, answer });
      return "\n";
    },
  );
  return { pairs, rest };
};

const extractDefinitionListPairs = (html: string): { pairs: Pair[]; rest: string } => {
  const pairs: Pair[] = [];
  const rest = html.replace(/<dl\b[^>]*>([\s\S]*?)<\/dl>/gi, (_match, list: string) => {
    const tokens = list.matchAll(/<(dt|dd)\b[^>]*>([\s\S]*?)<\/\1>/gi);
    let question = "";
    const answers: string[] = [];
    const flush = () => {
      const answer = answers.join(" ").trim();
      if (question && answer) pairs.push({ question, answer });
      question = "";
      answers.length = 0;
    };
    for (const token of tokens) {
      const text = blockText(token[2]);
      if (!text) continue;
      if (token[1].toLowerCase() === "dt") { flush(); question = text; } else { answers.push(text); }
    }
    flush();
    return "\n";
  });
  return { pairs, rest };
};

const extractHeadingPairs = (html: string): { pairs: Pair[]; rest: string } => {
  const pairs: Pair[] = [];
  const segments: Array<{ heading?: string; html?: string }> = [];
  let cursor = 0;
  for (const match of html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ html: html.slice(cursor, index) });
    segments.push({ heading: blockText(match[1]) });
    cursor = index + match[0].length;
  }
  if (cursor < html.length) segments.push({ html: html.slice(cursor) });

  let pendingHeading: string | undefined;
  const answerParts: string[] = [];
  const leftoverParts: string[] = [];
  for (const segment of segments) {
    if (segment.heading !== undefined) {
      if (pendingHeading !== undefined) {
        const answer = answerParts.join("\n").trim();
        if (answer) pairs.push({ question: pendingHeading, answer });
      }
      pendingHeading = segment.heading;
      answerParts.length = 0;
      continue;
    }
    const text = segment.html ? blockText(segment.html) : "";
    if (!text) continue;
    if (pendingHeading !== undefined) answerParts.push(text);
    else leftoverParts.push(text);
  }
  if (pendingHeading !== undefined) {
    const answer = answerParts.join("\n").trim();
    if (answer) pairs.push({ question: pendingHeading, answer });
  }
  return { pairs, rest: leftoverParts.join("\n\n") };
};

const isQuestionLike = (line: string): boolean =>
  line.endsWith("?") ||
  /^(how|what|can|do|does|did|is|are|when|where|why|who|which|will|should|could)\b/i.test(line);

// A heading section on real FAQ pages often holds the actual questions as
// paragraphs (e.g. everything under an H1 like "Frequently asked questions").
// Split such a section into one pair per question-like paragraph; following
// non-question paragraphs become that question's answer.
const splitHeadingPair = (pair: Pair): Pair[] => {
  const lines = pair.answer.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [pair];
  const children: Pair[] = [];
  let current: Pair | null = null;
  for (const line of lines) {
    if (isQuestionLike(line) && line.split(/\s+/).length <= 30) {
      if (current) children.push(current);
      current = { question: line, answer: "" };
    } else if (current) {
      current.answer = current.answer ? `${current.answer}\n${line}` : line;
    }
  }
  if (current) children.push(current);
  const withAnswers = children.filter((child) => child.answer.trim().length > 0);
  return withAnswers.length > 0 ? withAnswers : [pair];
};

const normalizeKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const dedupePairs = (pairs: Pair[]): Pair[] => {
  const seen = new Set<string>();
  return pairs.filter((pair) => {
    const key = `${normalizeKey(pair.question)}\u0000${normalizeKey(pair.answer)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const extractFaqContent = (html: string): FaqExtraction => {
  // JSON-LD runs first: its scripts are data containers and must not be
  // stripped before their FAQPage payload is read.
  const jsonLd = extractJsonLdPairs(html);
  const details = extractDetailsPairs(stripInvisible(jsonLd.rest));
  const definitions = extractDefinitionListPairs(details.rest);
  const headings = extractHeadingPairs(definitions.rest);

  const pairs = dedupePairs([
    ...jsonLd.pairs,
    ...details.pairs,
    ...definitions.pairs,
    ...headings.pairs.flatMap(splitHeadingPair),
  ]);
  const structured = pairs.length > 0;
  const extractedText = structured
    ? pairs.map((pair) => `Q: ${pair.question}\nA: ${pair.answer}`).join("\n\n")
    : headings.rest.trim();
  return { extractedText, qaPairs: pairs.length, structured };
};
