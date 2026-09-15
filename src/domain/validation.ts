import { createScenarioDefinition } from "../data/seed-packs";
import type { ScenarioDefinition, SessionSource } from "./practice-pack";
import {
  createSourceContentHash,
  getSourceText,
  normalizeReferenceFacts,
  type ExperienceNote,
  type ReferenceFact,
} from "./reference-source";

export type PracticeContext = {
  source: SessionSource;
  sourceLabel: string;
  sourceContentHash: string;
  sourceText: string;
  facts: ReferenceFact[];
  notes: ExperienceNote[];
  scenario: ScenarioDefinition;
};

export type FieldErrors = Partial<Record<"companyName" | "source" | "facts" | "scenario" | "notes", string[]>>;
export type PracticeContextValidation = { ok: true } | { ok: false; errors: FieldErrors };

type NormalizeInput = {
  source: SessionSource;
  sourceLabel: string;
  notes: ExperienceNote[];
  scenarioId: "late-delivery" | "refund-eligibility";
};

export const normalizePracticeContext = (input: NormalizeInput): PracticeContext => {
  const sourceText = getSourceText(input.source);
  const facts = normalizeReferenceFacts(sourceText, input.notes);

  return {
    source: input.source,
    sourceLabel: input.sourceLabel.trim(),
    sourceContentHash:
      input.source.kind === "public-https-link" && input.source.confirmation === "confirmed"
        ? input.source.snapshot.contentHash
        : createSourceContentHash(sourceText),
    sourceText,
    facts,
    notes: input.notes,
    scenario: createScenarioDefinition(input.scenarioId, facts),
  };
};

const addError = (errors: FieldErrors, field: keyof FieldErrors, message: string): void => {
  errors[field] = [...(errors[field] ?? []), message];
};

const urlIssue = (value: string): string | undefined => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? undefined : "Use an HTTPS FAQ or policy URL.";
  } catch {
    return "Enter a valid FAQ or policy URL.";
  }
};

export const validatePracticeContext = ({
  companyName,
  context,
  noteFileSizeBytes,
}: {
  companyName: string;
  context: PracticeContext;
  noteFileSizeBytes?: number;
}): PracticeContextValidation => {
  const errors: FieldErrors = {};
  if (!companyName.trim()) addError(errors, "companyName", "Enter your company name.");

  if (context.source.kind === "public-https-link") {
    const issue = urlIssue(context.source.url);
    if (issue) addError(errors, "source", issue);
  }
  if (!context.sourceText.trim()) addError(errors, "source", "Extracted FAQ/policy text is required.");
  if (context.source.confirmation !== "confirmed") {
    addError(errors, "source", "Confirm the extracted source preview before starting.");
  }

  const seenFactIds = new Set<string>();
  for (const fact of context.facts) {
    if (!fact.answer.trim()) addError(errors, "facts", "Each extracted fact needs an answer.");
    if (seenFactIds.has(fact.id)) addError(errors, "facts", "Fact IDs must be unique.");
    seenFactIds.add(fact.id);
  }

  if (context.scenario.factIds.some((factId) => !context.facts.some((fact) => fact.id === factId))) {
    addError(errors, "scenario", "The selected scenario refers to a fact that is not available in this source.");
  }
  if (noteFileSizeBytes !== undefined && noteFileSizeBytes > 200 * 1024) {
    addError(errors, "notes", "A notes file must be 200 KB or smaller.");
  }

  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };
};
