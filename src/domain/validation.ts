import { createScenarioDefinition } from "../data/seed-packs";
import { validatePracticePack, type PracticeScenario, type ScenarioDefinition, type SessionSource } from "./practice-pack";
import {
  createSourceProvenance,
  getSourceText,
  normalizeReferenceFacts,
  type ExperienceNote,
  type ReferenceFact,
  type SourceProvenance,
} from "./reference-source";

export type PracticeContext = {
  source: SessionSource;
  sourceLabel: string;
  sourceContentHash: string;
  sourceProvenance: SourceProvenance;
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
  scenarioId: string;
};

export const normalizePracticeContext = (input: NormalizeInput): PracticeContext => {
  const sourceText = getSourceText(input.source);
  const facts = normalizeReferenceFacts(sourceText, input.notes);
  const sourceProvenance = createSourceProvenance(input.source, sourceText);

  return {
    source: input.source,
    sourceLabel: input.sourceLabel.trim(),
    sourceContentHash: sourceProvenance.contentHash,
    sourceProvenance,
    sourceText,
    facts,
    notes: input.notes,
    scenario: createScenarioDefinition(input.scenarioId, facts),
  };
};

const addPracticePackErrors = (errors: FieldErrors, issues: string[]): void => {
  for (const issue of issues) {
    if (issue === "A public HTTPS link or pasted FAQ/policy text is required.") {
      continue;
    }
    if (issue === "Choose a supported practice scenario.") {
      addError(errors, "scenario", issue);
    } else if (issue.startsWith("Experience notes")) {
      addError(errors, "notes", issue);
    } else {
      addError(errors, "source", issue);
    }
  }
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

  const packValidation = validatePracticePack({
    source: context.source,
    scenario: context.scenario.id as PracticeScenario,
  });
  if (!packValidation.ok) addPracticePackErrors(errors, packValidation.issues);

  for (const note of context.notes) {
    if (!note.text.trim()) continue;
    const noteValidation = validatePracticePack({
      source: context.source,
      scenario: context.scenario.id as PracticeScenario,
      notes: { content: note.text, format: note.format, classification: note.kind },
    });
    if (!noteValidation.ok) {
      addPracticePackErrors(
        errors,
        noteValidation.issues.filter((issue) => issue.startsWith("Experience notes")),
      );
    }
  }

  if (context.source.kind === "public-https-link" && !packValidation.ok) {
    const issue = urlIssue(context.source.url);
    if (issue && !errors.source?.includes(issue)) addError(errors, "source", issue);
  }
  if (!context.sourceText.trim() && !errors.source?.includes("Extracted FAQ/policy text is required.")) addError(errors, "source", "Extracted FAQ/policy text is required.");
  if (context.source.confirmation !== "confirmed" && !errors.source?.includes("Confirm the extracted source preview before starting.")) addError(errors, "source", "Confirm the extracted source preview before starting.");

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
