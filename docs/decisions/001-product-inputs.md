# 001. Per-session source inputs for SupportCoach AI

- **Status:** Accepted
- **Date:** 2026-09-15
- **Related:** [SupportCoach AI PRD](../../../outputs/SupportCoachAI/PRD.md)

## Context

SupportCoach AI is a trainee practice product. Its customer questions and factual evaluation must be grounded in material that the trainee supplies for that practice session. It is not an AI mode that answers real customers.

## Decision

1. The primary call mode is voice-to-voice: the trainee is the voice responder to the simulated customer. Typed input is available when microphone permission or audio playback fails.
2. Every new practice session requires a company FAQ/policy source. The trainee provides either a public HTTPS link or pasted FAQ/policy text. The server fetches a supplied link once, sanitizes and size-limits its snapshot, and displays extracted text for trainee confirmation before the call.
3. The trainee may upload a plain-text or Markdown experience-notes file, or paste experience notes. PDF/DOCX parsing and private/authenticated links are outside the MVP.
4. The first scenario archetypes are **late delivery** and **refund eligibility**. The customer persona and opening line are fixed; policy facts and follow-up questions come from the confirmed session source.
5. Experience notes are classified as **approved practice advice** or **personal coaching note**. Only approved practice advice may affect factual scoring. Personal coaching notes are visible to the trainee and may affect coaching suggestions.
6. The evaluator returns four scores, each from 0 to 3: **factual accuracy**, **empathy**, **clarity**, and **resolution**. The report also includes missed facts, unsupported claims, and one next-step exercise.
7. The browser retains only the current session source snapshot, notes, final transcript, and final report in `localStorage`. A **clear practice data** action removes all four.
8. The demo target is current desktop Chrome or Edge with microphone permission enabled. The application displays a typed-input fallback when audio is unsupported or permission is denied.
9. The hackathon demo deadline bounds the MVP. Any feature outside the golden path is deferred to [ENHANCEMENTS.md](../../ENHANCEMENTS.md).

## Consequences

- A session cannot begin until a source is valid and its snapshot is confirmed.
- Link retrieval belongs to a server boundary so it can enforce public-network, timeout, sanitization, and size rules; the domain contract only checks that a link is HTTPS-shaped.
- Domain types keep source material, note classification, scenarios, and evaluator score names independent of React and browser APIs.
- PDF/DOCX imports, authenticated links, and real-customer answering remain deferred.

## Alternatives considered

- A single global company knowledge base was rejected because the approved MVP requires a fresh source for each practice session.
- An AI auto-answer assistant was rejected because the trainee, rather than the simulated customer, is the responder.

## Verification

The `practice-pack` domain tests enforce a source on every session, snapshot confirmation, allowed note formats, and the approved scenario and score sets.
