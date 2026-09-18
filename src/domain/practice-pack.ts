export const PRACTICE_SCENARIOS = ["late-delivery", "refund-eligibility"] as const;

export type BuiltinScenario = (typeof PRACTICE_SCENARIOS)[number];

/** Scenario ids derived from confirmed FAQ content at runtime (`derived-<hash>`). */
export type DerivedScenarioId = `derived-${string}`;

export type PracticeScenario = BuiltinScenario | DerivedScenarioId;

export const isSupportedScenarioId = (value: string): value is PracticeScenario =>
  (PRACTICE_SCENARIOS as readonly string[]).includes(value) || value.startsWith("derived-");

export const SCORE_DIMENSIONS = [
  "factual-accuracy",
  "empathy",
  "clarity",
  "resolution",
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export type Score = 0 | 1 | 2 | 3;

export type SourceConfirmation = "pending" | "confirmed";

export type PublicLinkSnapshot = {
  extractedText: string;
  contentHash: string;
};

export type PendingPublicHttpsLinkSource = {
  kind: "public-https-link";
  url: string;
  confirmation: "pending";
  snapshot?: never;
};

export type ConfirmedPublicHttpsLinkSource = {
  kind: "public-https-link";
  url: string;
  confirmation: "confirmed";
  snapshot: PublicLinkSnapshot;
};

export type PublicHttpsLinkSource =
  | PendingPublicHttpsLinkSource
  | ConfirmedPublicHttpsLinkSource;

export type PastedTextSource = {
  kind: "pasted-text";
  text: string;
  confirmation: SourceConfirmation;
};

export type SessionSource = PublicHttpsLinkSource | PastedTextSource;

export const EXPERIENCE_NOTE_FORMATS = ["plain-text", "markdown"] as const;

export type ExperienceNoteFormat = (typeof EXPERIENCE_NOTE_FORMATS)[number];

export const EXPERIENCE_NOTE_CLASSIFICATIONS = [
  "approved-practice-advice",
  "personal-coaching-note",
] as const;

export type ExperienceNoteClassification =
  (typeof EXPERIENCE_NOTE_CLASSIFICATIONS)[number];

export type ExperienceNotes = {
  content: string;
  format: ExperienceNoteFormat;
  classification: ExperienceNoteClassification;
};

export type PracticePack = {
  source: SessionSource;
  notes?: ExperienceNotes;
  scenario: PracticeScenario;
};

export type ScenarioDefinition = {
  id: string;
  title: string;
  customerPersona: string;
  openingLine: string;
  goals: string[];
  factIds: string[];
  difficulty: "beginner" | "intermediate";
};

export type PracticePackValidation =
  | { ok: true }
  | { ok: false; issues: string[] };

const isNonEmptyText = (value: string): boolean => value.trim().length > 0;

const isPublicHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export const validatePracticePack = (input: PracticePack): PracticePackValidation => {
  const issues: string[] = [];

  const sourceIsPresent =
    input.source.kind === "public-https-link"
      ? isPublicHttpsUrl(input.source.url)
      : isNonEmptyText(input.source.text);

  if (!sourceIsPresent) {
    issues.push("A public HTTPS link or pasted FAQ/policy text is required.");
  }

  if (sourceIsPresent && input.source.confirmation !== "confirmed") {
    issues.push("Confirm the source snapshot before starting practice.");
  }

  if (
    sourceIsPresent &&
    input.source.kind === "public-https-link" &&
    input.source.confirmation === "confirmed" &&
    (!input.source.snapshot ||
      !isNonEmptyText(input.source.snapshot.extractedText) ||
      !isNonEmptyText(input.source.snapshot.contentHash))
  ) {
    issues.push(
      "Confirmed public links require a non-empty sanitized source snapshot and content hash.",
    );
  }

  if (!isSupportedScenarioId(input.scenario)) {
    issues.push("Choose a supported practice scenario.");
  }

  if (input.notes?.content && !EXPERIENCE_NOTE_FORMATS.includes(input.notes.format)) {
    issues.push("Experience notes must be plain text or Markdown.");
  }

  if (
    input.notes?.content &&
    !EXPERIENCE_NOTE_CLASSIFICATIONS.includes(input.notes.classification)
  ) {
    issues.push(
      "Experience notes must be approved practice advice or a personal coaching note.",
    );
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
};
