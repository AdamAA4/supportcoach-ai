# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Vercel production deployment at https://supportcoach-ai-ten.vercel.app with live voice configuration stored for Production and Preview.
- Deterministic coaching evaluation with four explained scores, confirmed-source fact checks, two strengths, missed facts, unsupported claims, one next exercise, and the exact completed transcript.
- Validated evaluation endpoint with source-hash/fact consistency checks, imported snapshot verification, transcript limits, and stable error responses.
- Report page with expandable transcript, practice-again and clear-data actions, and versioned completed-practice persistence that restores after refresh.
- Call-end evaluation with a frozen transcript, retryable failures, response validation, and saving only after successful evaluation.
- Live AssemblyAI voice-agent transport with server-minted temporary tokens, browser microphone streaming, customer-audio playback events, interruption cleanup, and mock/live mode selection.
- One-time public HTTPS FAQ/policy importer with private-network rejection, a five-second deadline, 200 KB cap, sanitized readable snapshots, canonical URLs, and SHA-256 provenance hashes.
- Health endpoint for deployment readiness checks.
- Reusable voice-agent transport contract, browser audio player, and mock simulated-customer adapter with Web Speech recognition and typed fallback.
- Confirmed-session call route with an explicit call-state machine, live transcript, reference panel, microphone/audio status, retry handling, and Playwright-safe mock customer turn control.
- Initial per-session practice-pack domain contract and product-input decision record.
- Next.js App Router and Tailwind scaffold with lint, typecheck, unit-test, build, and CI gates.
- Normalized source facts, scenario definitions, transcript/report contracts, and validation for grounded practice sessions.
- Source setup screen that requires FAQ/policy preview confirmation before a trainee can start a simulated customer call.

### Changed

- Preserve safe AssemblyAI session-error codes and browser WebSocket close codes in the recoverable live-call error, rather than replacing them with a generic connection message.

### Fixed

- Use relation-anchored factual evidence in coaching evaluation, tying universal claims to their required condition and treating scoped `not all` as ambiguous.
- Improve evaluation of distinct-topic coordinated factual claims so a supported fact cannot hide another fact's contradiction, and acknowledge partial factual coverage without relying on rounded scores.
- Scope deterministic conflict suppression and negation to the relevant factual clause, recognize common negative contractions, and keep empty or weak-call strengths observational.
- Clear malformed practice storage safely and avoid treating unrelated negative sentences or different confirmed numeric facts as policy contradictions.
- Give each call-console startup exact agent ownership so React StrictMode replay, retry, end, and unmount close obsolete agents and ignore their late events.
- Pin public reference imports to a validated numeric address while preserving HTTPS hostname verification; reject equivalent mapped/private IPv6 forms, special-use ranges, redirects, and oversized or stalled responses.
- Queue live customer audio chunks in order and invalidate active, queued, and decoding playback on interruption or remote termination.
- Make live mute pause frame transmission and disable microphone tracks while reusing the existing capture graph on unmute.
- Guard pending voice-token, socket, and microphone startup against ended sessions; repeated startup and cleanup release resources once.
- Keep microphone permission denial recoverable for live typed turns, and report every remote socket/session termination through the existing error contract.
- Prevent the console from marking an ended call as recording when a pending microphone request completes.

- Emit the mock customer transcript only after speech synthesis starts or transcript-only fallback is selected, preserving the audio-first turn contract.
- Keep mock-customer turns active until browser speech synthesis ends or errors, and until matched fixture playback reports completion; interruptions invalidate pending completion callbacks.
- Prevent mismatched static customer audio for dynamic text, show an explicit transcript-only audio fallback, and suppress fixture audio when an interruption happens during decoding.
- Restore the exact voice-agent transport contract and move mute support behind an optional adapter capability.
- Speak each scripted mock-customer turn with browser speech synthesis, with a bundled WAV fixture used only when speech synthesis is unavailable; interruptions cancel both paths.
- Keep microphone permission failures recoverable with a clearly labelled typed fallback; mute now stops and resumes recognition while flushing customer playback.
- Consume `session-ready` and reject invalid call-state transitions before the session is ready.

- Route setup validation through the authoritative practice-pack contract so unsupported runtime scenarios and incomplete confirmed source snapshots cannot start a session.
- Preserve source URL/content-hash provenance in coaching reports and retain the declared plain-text or Markdown format for normalized experience notes.

- Use the portable Bash `cp .env.example .env.local` command in the README setup block.

- Require confirmed public HTTPS links to retain the sanitized source snapshot and content hash used to ground practice.
- Reject unsupported runtime scenario values before a practice session starts.
