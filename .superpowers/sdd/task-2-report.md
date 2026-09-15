# Task 2 report — application scaffold and engineering gates

## Status

Implemented the Next.js App Router, TypeScript, and Tailwind scaffold around the existing Task 1 domain contract, with required local and CI quality gates.

## Changes

- Added a minimal App Router entry point, root layout, global Tailwind stylesheet, TypeScript path alias, ESLint setup, and generated-file ignores.
- Added Vitest with the jsdom/testing-library setup, Playwright Chromium configuration, and the required development tools.
- Added the exact requested package scripts and a GitHub Actions workflow for Node 20 that runs `npm ci`, lint, typecheck, unit tests, and build on every push and pull request.
- Added the constrained environment template. `ASSEMBLYAI_API_KEY` stays server-only and all `.env` files except the empty template are ignored.
- Documented local setup, mock/live voice modes, practice inputs, local-data clearing, golden demo path, and fallback behavior in the README.
- Updated the project changelog under `Unreleased / Added`.

## Verification

- `npm ci --no-audit --no-fund` — passed from a clean dependency tree.
- `npx playwright install chromium` — passed; Chromium and Chrome Headless Shell installed.
- `npm run lint` — passed with no ESLint warnings or errors.
- `npm run typecheck` — passed.
- `npm test` — passed, 8 tests in 1 file.
- `npm run build` — passed; Next.js compiled and statically generated `/`.
- `git diff --check` — passed.
- Secret scan of tracked-source candidates found no populated API key, secret, or password assignment.

## Review and concerns

- The required `next lint` script is deprecated by Next.js 15 and removed in Next.js 16. This scaffold pins Next.js 15.5.25 so the exact required command continues to work; a future deliberate migration can move the script to the ESLint CLI.
- The page is intentionally a minimal scaffold. The approved practice setup, simulated voice flow, and clear-data control are future MVP tasks; the README describes their specified final behavior without claiming the placeholder page provides it yet.

## Review follow-up — 2026-09-15

- Fixed the README Bash setup block to use the portable `cp .env.example .env.local` command instead of the Windows-only `copy` command.
- Focused docs check: passed (`README.md` contains the Bash `cp` command and no `copy .env.example .env.local` command).
- Relevant gate: `npm run lint` � passed with no ESLint warnings or errors.
