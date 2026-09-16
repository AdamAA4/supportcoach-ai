import { createHash } from "node:crypto";
import { DeterministicEvaluator } from "../../../evaluation/deterministic-evaluator";
import { equalData, isPracticeContext, isRecord, isTranscript } from "../../../evaluation/validation";

export const runtime = "nodejs";
const invalid = () => Response.json({ error: { code: "invalid_evaluation", message: "Use the confirmed session source and a transcript of at most 200 turns and 20,000 characters." } }, { status: 400 });

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch { return invalid(); }
  if (!isRecord(body) || !isPracticeContext(body.context) || !isTranscript(body.transcript)) return invalid();
  const { context, transcript } = body;
  if (body.sourceContentHash !== context.sourceContentHash || !equalData(body.facts, context.facts)) return invalid();
  if (context.source.kind === "public-https-link") {
    const hash = `sha256:${createHash("sha256").update(context.sourceText).digest("hex")}`;
    if (hash !== context.sourceContentHash) return invalid();
  }
  try {
    const evaluator = new DeterministicEvaluator(context.sourceProvenance);
    return Response.json(await evaluator.evaluate({ scenario: context.scenario, facts: context.facts, notes: context.notes, transcript }), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: { code: "evaluation_failed", message: "The coaching report could not be generated. Please try again." } }, { status: 500 });
  }
}
