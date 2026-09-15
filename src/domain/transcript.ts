export type TranscriptTurn = {
  id: string;
  speaker: "customer" | "trainee" | "system";
  text: string;
  startedAt: string;
  endedAt: string;
  source: "live-transcript" | "mock-transcript" | "typed-fallback";
};
