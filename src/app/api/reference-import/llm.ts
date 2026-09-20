// Server-only AI extraction client for the optional AI-assisted FAQ
// extraction. Reads process.env at call time; the key never leaves the
// server. Endpoints are compile-time constants (no URL interpolation) and
// raw fetch is used against provider REST APIs — no SDK dependency.

const LLM_TIMEOUT_MS = 20_000;
const MAX_PAIRS = 15;
const MAX_CORPUS_CHARS = 150_000;

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const GEMINI_MODEL = "gemini-2.0-flash";
const OPENAI_MODEL = "gpt-4o-mini";

export type LlmPair = { question: string; answer: string };

export const isLlmConfigured = (): boolean =>
  Boolean(process.env.LLM_API_KEY && process.env.LLM_PROVIDER);

const buildPrompt = (corpus: string): string => {
  const bounded = corpus.length > MAX_CORPUS_CHARS ? `${corpus.slice(0, MAX_CORPUS_CHARS)}\n[content truncated]` : corpus;
  return [
    "You are an FAQ extraction assistant. Below is the text content of an FAQ web page (it may include navigation and page furniture - ignore that).",
    "",
    "Task: extract every question and the answer actually given for it.",
    "",
    "Strict rules:",
    "- Use only information present in the content. Never invent, complete, or summarize beyond what is stated.",
    "- If several sentences together form the answer, include all of them.",
    "- If the content is only a menu/list of topics without real answers, or you find no genuine question/answer pairs, reply with exactly: NO_ANSWERS",
    `- Return at most ${MAX_PAIRS} pairs.`,
    "",
    "Reply ONLY with minified JSON in this exact shape, with no markdown fences and no commentary:",
    '[{"question":"...","answer":"..."}]',
    "",
    "PAGE CONTENT START",
    bounded,
    "PAGE CONTENT END",
  ].join("\n");
};

const parsePairs = (content: string): LlmPair[] => {
  if (/NO_ANSWERS/i.test(content)) return [];
  const start = content.indexOf("[");
  const end = content.lastIndexOf("]");
  if (start === -1 || end <= start) throw new Error("llm-unparseable");
  const parsed: unknown = JSON.parse(content.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("llm-unparseable");
  const pairs: LlmPair[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const question = (item as { question?: unknown }).question;
    const answer = (item as { answer?: unknown }).answer;
    if (typeof question === "string" && question.trim() && typeof answer === "string" && answer.trim()) {
      pairs.push({ question: question.trim(), answer: answer.trim() });
    }
    if (pairs.length >= MAX_PAIRS) break;
  }
  return pairs;
};

const callGemini = async (key: string, prompt: string, signal: AbortSignal): Promise<string> => {
  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0 },
    }),
    signal,
  });
  if (!response.ok) throw new Error(`llm-http-${response.status}`);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error("llm-unparseable"); }
  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }).candidates;
  const text = candidates?.[0]?.content?.parts
    ?.map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("") ?? "";
  if (!text) throw new Error("llm-empty");
  return text;
};

const callOpenAi = async (model: string, key: string, prompt: string, signal: AbortSignal): Promise<string> => {
  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
    signal,
  });
  if (!response.ok) throw new Error(`llm-http-${response.status}`);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error("llm-unparseable"); }
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices
    ?.[0]?.message?.content;
  if (typeof content !== "string" || !content) throw new Error("llm-empty");
  return content;
};

// Returns question/answer pairs the model found. These are NOT yet trusted:
// the caller must ground them against the harvested page text.
export const extractPairsWithLlm = async (corpus: string): Promise<LlmPair[]> => {
  const provider = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase();
  const key = process.env.LLM_API_KEY ?? "";
  if (!key) throw new Error("llm-not-configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const prompt = buildPrompt(corpus);
    const content = provider === "openai"
      ? await callOpenAi(OPENAI_MODEL, key, prompt, controller.signal)
      : await callGemini(key, prompt, controller.signal);
    return parsePairs(content);
  } finally {
    clearTimeout(timer);
  }
};
