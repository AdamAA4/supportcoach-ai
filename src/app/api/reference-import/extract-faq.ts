// Structured FAQ extraction for the public reference importer.
// extractFaqContent is the deterministic structure-based extractor.
// harvestFaqCorpus collects ALL text the page actually contains (visible
// text, JSON-LD payloads, and strings embedded in inline scripts) for the
// optional AI-assisted extraction path and for grounding verification.

export type FaqExtraction = {
  extractedText: string;
  qaPairs: number;
  structured: boolean;
};

export type Pair = { question: string; answer: string };

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
// non-question paragraphs become that question's answer. A question only
// pairs with content that reads as an answer (sentence punctuation or a
// full-length line): consecutive topic labels are a menu, and pairing them
// would invent nonsense like "A: Evaluation Phase".
const readsAsAnswer = (line: string): boolean => {
  const words = line.split(/\s+/).length;
  return /[.!?]$/.test(line) || words >= 8;
};

const splitHeadingPair = (pair: Pair): Pair[] => {
  const lines = pair.answer.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [pair];
  const children: Pair[] = [];
  let current: { question: string; answerLines: string[]; answered: boolean } | null = null;
  const flush = () => {
    if (current && current.answered) {
      children.push({ question: current.question, answer: current.answerLines.join("\n").trim() });
    }
    current = null;
  };
  for (const line of lines) {
    if (isQuestionLike(line) && line.split(/\s+/).length <= 30) {
      flush();
      current = { question: line, answerLines: [], answered: false };
    } else if (current) {
      if (readsAsAnswer(line)) current.answered = true;
      current.answerLines.push(line);
    }
  }
  flush();
  return children.length > 0 ? children : [pair];
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

const SKIP_LINK_EXTENSIONS = /\.(pdf|docx?|xlsx?|pptx?|zip|png|jpe?g|gif|webp|svg|xml|json|css|m?js)(?:$|[?#])/i;

// FAQ hubs list their article pages as same-origin links below the hub's own
// path (e.g. /faq/ registers under /faq/registration-guide). Only such links
// are discovered: same host, inside the hub's section of the site, not the
// hub itself, not downloadable assets, deduplicated by path, bounded by cap.
export const extractSameOriginLinks = (html: string, baseUrl: URL, cap: number): string[] => {
  const hubPath = baseUrl.pathname.replace(/\/+$/, "");
  const hubPrefix = `${hubPath}/`;
  const seen = new Set<string>();
  const links: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)) {
    let candidate: URL;
    try { candidate = new URL(match[1], baseUrl); } catch { continue; }
    if (candidate.protocol !== "https:" || candidate.hostname !== baseUrl.hostname) continue;
    if (candidate.username || candidate.password) continue;
    const path = candidate.pathname.replace(/\/+$/, "");
    if (!path || path === hubPath || !path.startsWith(hubPrefix)) continue;
    if (SKIP_LINK_EXTENSIONS.test(path)) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    links.push(candidate.toString());
    if (links.length >= cap) break;
  }
  return links;
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

const READABLE_STRING = (value: string): boolean =>
  value.length >= 30 &&
  value.split(/\s+/).length >= 5 &&
  (value.includes("?") || /[.,!?]/.test(value));

// Collects every scrap of human-readable text the page contains: visible
// content, JSON-LD payloads, and human-readable strings embedded in inline
// scripts (where JavaScript-rendered sites keep their real FAQ data). The
// corpus feeds the optional AI-assisted extraction and grounds every
// extracted pair against the page's actual words.
export const harvestFaqCorpus = (html: string): { corpus: string } => {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");

  const jsonLdParts: string[] = [];
  const body = withoutComments.replace(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    (_match, payload: string) => {
      jsonLdParts.push(payload);
      return "";
    },
  );

  const dataParts: string[] = [];
  for (const match of body.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const literal of match[1].matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)) {
      const raw = literal[0];
      try {
        const decoded = JSON.parse(raw);
        if (typeof decoded === "string" && READABLE_STRING(decoded)) dataParts.push(decoded);
      } catch { /* not a JSON string literal; skip */ }
    }
  }

  const visible = blockText(
    body.replace(/<(script|style|noscript|template|svg|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, ""),
  );

  const corpus = [visible, ...jsonLdParts, ...dataParts].filter((part) => part.trim().length > 0).join("\n\n");
  return { corpus };
};
