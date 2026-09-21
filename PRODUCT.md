# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Support trainees practicing customer-support conversations before taking real calls. They practice in short solo sessions, often on a phone (Android Chrome is the priority device), sometimes on a desktop in a training workspace. The product lead (Adam Ashiru) evaluates the tool and reviews coaching reports.

## Product Purpose

SupportCoach AI lets a trainee practice a support conversation by speaking with a simulated customer. Every session is grounded in a confirmed company FAQ or policy source plus optional experience notes; after the call, a rule-based coach scores the trainee's answers 0-3 on factual accuracy, empathy, clarity, and resolution, and proposes a next exercise. Success: trainees fail safely, repeatedly, and get honest, source-grounded feedback.

## Positioning

A simulated customer that is strictly grounded: prompts and factual scoring use only the confirmed session source, so practice evidence is traceable to company material. A neighboring generic roleplay chatbot could not truthfully claim source-confirmed scoring with provenance hashes.

## Operating Context

Solo practice sessions in a browser. The session source snapshot, notes, completed transcript, and report persist in browser localStorage only; there is no server session registry. Deployed on Vercel; live voice runs through AssemblyAI Voice Agents with a server-minted temporary token.

## Capabilities and Constraints

- Voice-only practice: the trainee answers by voice; typed-response practice is explicitly out of scope.
- Source setup: paste FAQ/policy text or import one public HTTPS page (sanitized snapshot, SHA-256 provenance); confirmation required before a call starts.
- Optional experience notes (plain text or Markdown file, 200 KB cap) classified as personal coaching note or approved practice advice.
- One or more source-derived practice scenarios per voice session; selected scenarios combine their confirmed facts into one customer question plan and one coaching report.
- Deterministic rule-based evaluation; conservative English lexical matching; can miss paraphrases (documented limitation).
- AssemblyAI API key is server-only; browser receives a single-use temporary token.
- Live calls report provider session-error or WebSocket close codes verbatim for debugging.

## Brand Commitments

- Name: "SupportCoach AI".
- No binding visual identity exists; a first visual world is being chosen in the current design round.

## Evidence on Hand

- README.md (deployment, voice modes, demo path), CHANGELOG.md, BUGS.md, ENHANCEMENTS.md.
- Unit and integration test suite (vitest) plus Playwright config; deterministic evaluator with test fixtures.
- Production deployment: https://supportcoach-ai-ten.vercel.app
- No customer testimonials, metrics, or press exist; future work must not fabricate them.

## Product Principles

1. Grounding before speaking: no simulated word carries weight without a confirmed source.
2. Voice is the practice surface; text is for reading, not answering.
3. Honest feedback over flattering feedback: scores cite the reference, and limitations are stated.
4. Practice must feel safe: local data, retryable failures, clear recovery states.

## Accessibility & Inclusion

Mobile-first for Android Chrome: 16px+ form controls, adequate touch targets, no focus zoom. Clear call status, microphone status, and customer-audio status at all times. Readable live transcripts with distinguishable speakers. Visible keyboard focus, WCAG AA contrast targets, honors prefers-reduced-motion.

<!-- Inference note: facts above are drawn from README.md and the product lead's written brief of 2026-09-17 (voice-only rule, Android Chrome priority, preserved flows). The init interview was substituted with the documented brief + the design-round question the product lead explicitly requested; labeled here per protocol. -->
