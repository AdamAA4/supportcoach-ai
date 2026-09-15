# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Reusable voice-agent transport contract, browser audio player, and mock simulated-customer adapter with Web Speech recognition and typed fallback.
- Confirmed-session call route with an explicit call-state machine, live transcript, reference panel, microphone/audio status, retry handling, and Playwright-safe mock customer turn control.
- Initial per-session practice-pack domain contract and product-input decision record.
- Next.js App Router and Tailwind scaffold with lint, typecheck, unit-test, build, and CI gates.
- Normalized source facts, scenario definitions, transcript/report contracts, and validation for grounded practice sessions.
- Source setup screen that requires FAQ/policy preview confirmation before a trainee can start a simulated customer call.

### Fixed

- Route setup validation through the authoritative practice-pack contract so unsupported runtime scenarios and incomplete confirmed source snapshots cannot start a session.
- Preserve source URL/content-hash provenance in coaching reports and retain the declared plain-text or Markdown format for normalized experience notes.

- Use the portable Bash `cp .env.example .env.local` command in the README setup block.

- Require confirmed public HTTPS links to retain the sanitized source snapshot and content hash used to ground practice.
- Reject unsupported runtime scenario values before a practice session starts.
