export const PRACTICE_SCENARIOS = ["late-delivery", "refund-eligibility"] as const;

export type PracticeScenario = (typeof PRACTICE_SCENARIOS)[number];

export const SCORE_DIMENSIONS = [
  "factual-accuracy",
  "empathy",
  "clarity",
  "resolution",
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export type Score = 0 | 1 | 2 | 3;

export type SourceConfirmation = "pending" | "confirmed";

export type PublicHttpsLinkSource = {
  kind: "public-https-link";
  url: string;
  confirmation: SourceConfirmation;
};

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
