# Task 5 report — live AssemblyAI adapter and secure source import

## Delivered

- Added `GET /api/voice-token`. It reads `ASSEMBLYAI_API_KEY` only on the server, returns a five-minute temporary AssemblyAI token, returns the stable `voice_unconfigured` 503 envelope when absent, and normalizes upstream failures to a 502 response without returning or logging the permanent key.
- Added `POST /api/reference-import`. It accepts one public HTTPS URL, rejects loopback, private, link-local, carrier-grade NAT, multicast, and private IPv6 addresses before retrieval, DNS-checks hostnames, rejects redirects (`redirect: "error"`), limits the complete operation to five seconds, limits response bytes to 200 KB, removes scripts/styles/navigation and other non-readable containers, returns readable text with the canonical URL and `sha256:` content hash, and uses stable 400/413/502 envelopes. It logs neither source contents nor transcripts.
- Updated source setup so a public link is imported once on the setup screen. The server-produced canonical URL, snapshot, and hash are retained for confirmation; no call or voice-turn code fetches the source.
- Added `AssemblyAiVoiceAgent`, which retains the exact existing `VoiceAgent` interface. It fetches `/api/voice-token` immediately before connecting to the temporary-token WebSocket, sends a simulated-customer prompt containing the selected scenario, persona, facts, and responder rules, streams microphone PCM, maps AssemblyAI session/transcript/audio/turn/interruption events to the established union, and converts provider PCM to WAV buffers for the existing `AudioPlayer` boundary.
- Added live/mock factory selection from `NEXT_PUBLIC_VOICE_MODE` and wired it into the call console. The live adapter does not add `fixtureUrl` or `setMuted` to the public contract.
- Added `GET /api/health` with a non-secret `{ "status": "ok" }` readiness payload.
- Updated `README.md` and `CHANGELOG.md`. The established enhancement and bug diaries remain current: Task 5 did not complete an existing enhancement or discover a new tracked bug.

## TDD evidence

`src/voice/assemblyai-voice-agent.test.ts` was created first. Its initial focused run failed as expected because the token route and adapter did not exist. The next run revealed missing JSX runtime imports in the setup flow and asynchronous WebSocket setup in the test fixture; those were corrected before the importer control and final adapter flow were completed. The focused suite now covers:

- missing configuration and server-only permanent-key use;
- upstream token failure normalization;
- private-network rejection with no fetch or source logging;
- sanitized one-time public import with canonical URL/hash plus 413 and 502 envelopes;
- public-mode factory selection;
- temporary-token WebSocket prompt setup;
- mocked WebSocket customer PCM reaching `AudioPlayer` and playback stopping on interruption;
- idempotent socket/microphone cleanup after a fatal session event; and
- one-time setup import that keeps the server-provided hash.

## SSRF, redirect, timeout, and size controls

- Redirects are not followed. The importer passes `redirect: "error"`, so an unvalidated redirect cannot reach an internal URL.
- Literal private addresses are rejected before DNS or fetch. DNS results are checked and any private result rejects the request. A fetch cannot start until both URL and DNS checks pass.
- A single `AbortController` starts before DNS validation and is raced against the five-second deadline; the fetch uses the same signal. Timeout and other transport failures become the same non-leaking 502 envelope.
- The importer rejects an advertised `Content-Length` over 200 KB and also counts streamed response bytes, cancels the reader after the limit, and returns the stable 413 envelope.

## Verification

- `npm test -- src/voice/assemblyai-voice-agent.test.ts` — passed, 12 tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed with no warnings or errors; Next.js printed its existing `next lint` deprecation notice.
- `npm test` — passed, 45 tests across 5 files.
- `npm run build` — passed with exit code 0. It compiled the three API routes as dynamic server routes and generated `/call` and `/setup` successfully.
- `git diff --check` — passed.

## Self-review and limits

The permanent AssemblyAI key appears only in the server route. The client adapter imports no server route and sends only the short-lived token in its WebSocket URL. Development logging is restricted to event name, call ID, and error code; it never includes source text, raw audio, transcripts, or API tokens. The adapter clears its socket, microphone tracks, audio nodes, and context through one idempotent cleanup path, tested after a fatal provider event and a repeated end call.

The DNS preflight prevents ordinary private-address SSRF and redirects are refused. As with browser-compatible `fetch`, a hostile DNS server that changes a hostname from a validated public answer to a private answer between preflight and the fetch resolver remains a deployment-layer DNS-rebinding risk. Deploy behind egress filtering that blocks private address ranges for complete defense-in-depth.

## Task 5 review fix pass — 2026-09-15

This section supersedes the original DNS-rebinding limitation and the original playback/lifecycle verification claims above. Starting commit: `5ff289d`. No dependency or public `VoiceAgent` contract change was made; Tasks 1–4 remain intact.

### Root causes and fixes

1. Address validation compared IPv6 strings, missing equivalent mapped forms and nonpublic ranges. The importer now uses Node `isIP` and parsed `BlockList` subnet checks. It refuses special-use IPv4 ranges and conservatively permits IPv6 only within ordinary global unicast, excluding documentation, protocol-assignment, and transition subnets. Mapped IPv6 addresses are refused, including equivalent hexadecimal, dotted, and expanded spellings. Invalid DNS answers and mixed public/private answer sets fail closed.
2. DNS preflight and `fetch` used separate resolutions. Retrieval now uses built-in `https.request` with the previously validated **numeric IP as the connection hostname** and `agent: false`. There is no second hostname lookup. The original Host header, SNI name, and explicit `checkServerIdentity(originalHostname, certificate)` preserve TLS identity; certificate verification remains enabled. Non-2xx responses (including redirects) are destroyed. The five-second deadline covers DNS, headers, and body; advertised and streamed body limits destroy oversized responses.
3. `AudioPlayer.play` previously stopped the preceding chunk and could resume after an interruption during decoding. A FIFO queue now waits for each chunk to finish. A generation token invalidates active, queued, decoding, and fixture-fetch continuations; stop resolves cancelled playback promises, disconnects active output once, and suppresses obsolete callbacks.
4. Live mute had no adapter implementation. Its optional `setMuted` capability now disables capture tracks and gates frame transmission. Unmute toggles those same tracks and reuses the capture graph; the public interface is untouched.
5. Token, socket, and microphone startup lacked lifetime guards. Connection/capture generation checks discard obsolete continuations; late acquired streams are stopped before any audio graph is created. Repeated connection and microphone calls coalesce. Cleanup detaches socket handlers, aborts token retrieval, clears capture callbacks, stops tracks, and closes capture context once. Pending socket startup settles on local end. The console also ignores a late microphone completion after end or remote failure.
6. Permission denial previously used fatal cleanup. It now emits the existing recoverable `permission-denied` event while retaining the session and WebSocket. A typed trainee turn still emits its transcript and sends `conversation.message` plus `reply.create`.
7. Clean remote close and `session.ended` previously left the console apparently connected. All remote close/error/session termination paths now emit an existing-contract error and clean capture; the console flushes playback and shows its retry state. Intentional local end detaches handlers first and emits no connection error. Socket construction failures are normalized too.

### RED / GREEN evidence

The focused regression tests were written before production fixes. Exact initial command:

```text
npm test -- src/voice/audio-player.test.ts src/voice/assemblyai-lifecycle.test.ts src/app/api/reference-import/route.test.ts
Test Files  3 failed (3)
Tests       36 failed | 12 passed (48)
```

Full output: `.superpowers/sdd/task-5-fix-red.log`. Failures included public acceptance of `::ffff:7f00:1`, a missing pinned HTTPS request, chunk truncation, playback after stop, missing mute capability, late stream leakage, a closed socket after permission denial, and remote cleanup/UI failures. Pending token startup remained unsettled because an obsolete socket could still be opened.

After the root-cause fixes, the same command reported `3 passed (3)` and `48 passed (48)` in `.superpowers/sdd/task-5-fix-green.log`.

Self-review then added reproductions for late console microphone status and socket-construction failure:

```text
npm test -- src/voice/assemblyai-lifecycle.test.ts
Test Files  1 failed (1)
Tests       2 failed | 11 passed (13)
```

Output: `.superpowers/sdd/task-5-fix-followup-red.log`. Both were fixed before final verification. Existing importer tests were moved from the old mocked-fetch boundary into the Node HTTPS route test file, preserving invalid-envelope/no-log, canonical text/hash, size, and unavailable-response coverage. Tests mock network/browser primitives, but exercise the real route, adapter, player queue, and console logic.

### Final commands and observed results

All commands ran from the `supportcoach-ai` root.

| Command | Observed output | Evidence file |
| --- | --- | --- |
| `npm test -- src/voice/audio-player.test.ts src/voice/assemblyai-lifecycle.test.ts src/app/api/reference-import/route.test.ts src/voice/assemblyai-voice-agent.test.ts` | `Test Files 4 passed (4)`; `Tests 62 passed (62)` | `.superpowers/sdd/task-5-fix-focused.log` |
| `npm test` | `Test Files 8 passed (8)`; `Tests 95 passed (95)`; exit 0 | `.superpowers/sdd/task-5-fix-unit.log` |
| `npm run lint` | `No ESLint warnings or errors`; exit 0; existing Next lint deprecation notice only | `.superpowers/sdd/task-5-fix-lint.log` |
| `npm run typecheck` | `tsc --noEmit`; no diagnostics; exit 0 | `.superpowers/sdd/task-5-fix-typecheck.log` |
| `npm run build` with process-local live mode and the non-secret canary shown below | Compiled successfully; 8/8 static pages generated; all three API routes dynamic; exit 0 | `.superpowers/sdd/task-5-fix-build.log` |
| `node .superpowers/sdd/task-5-secret-scan.cjs` | Zero credential-pattern findings, zero private environment files, zero canary/server-key matches in 22 browser artifacts; exit 0 | `.superpowers/sdd/task-5-fix-secret-scan.log` |
| `git diff --check` | No whitespace errors; exit 0 (Git printed Windows line-ending conversion notices) | Checked before staging |
| `git diff --exit-code HEAD -- src/voice/voice-agent.ts` | No output; exit 0: exact public interface unchanged | Checked before staging |

Exact build environment setup used PowerShell, restoring the original process values without printing them:

```powershell
$taskPreviousKey = $env:ASSEMBLYAI_API_KEY
$taskPreviousMode = $env:NEXT_PUBLIC_VOICE_MODE
try {
  $env:ASSEMBLYAI_API_KEY = 'TASK5_NON_SECRET_BUILD_CANARY_20260915'
  $env:NEXT_PUBLIC_VOICE_MODE = 'live'
  npm run build *> .superpowers/sdd/task-5-fix-build.log
  $taskBuildExit = $LASTEXITCODE
} finally {
  $env:ASSEMBLYAI_API_KEY = $taskPreviousKey
  $env:NEXT_PUBLIC_VOICE_MODE = $taskPreviousMode
}
```

The repeatable scanner is saved beside this report. It prints counts and file paths only, scans tracked content for common credential patterns, refuses tracked private environment files, and searches browser JS/JSON/maps for the canary, server-key identifier, and test permanent-key marker. Manual logging review found only the development-only `{ event, callId, code }` log site in the live adapter; no source, audio, token, or transcript logging was added. The pattern scan is targeted validation, not a universal secret detector.

### Self-review and remaining limits

- The SSRF connection boundary is enforced in the application, with no second DNS lookup, dependency, redirect-following, or insecure TLS override. Node API behavior was checked against [HTTPS request documentation](https://nodejs.org/api/https.html#httpsrequesturl-options-callback) and [parsed BlockList documentation](https://nodejs.org/api/net.html#class-netblocklist).
- The public-address policy deliberately refuses mapped/transition IPv6 even when its embedded IPv4 address is public. This conservative import restriction is documented in the README.
- Generation ownership prevents an old connect/capture completion from modifying a newer session. Cleanup nulls event handlers before local socket closure, preserving intentional-end semantics.
- The three project diaries and README are current. No enhancement priorities changed. All seven requested review findings and the two directly related self-review failures are covered by regression checks.
- Live provider interoperability, audible behavior on physical hardware, and real network/TLS traffic were not exercised. The focused tests verify real application logic with mocked external primitives; the production build verifies bundling and type integration.

### Commit and final staged checks

- Implementation commit: `9a45f3a3d76b4e7af7bbac096800beacf5db16e9` — `Fix Task 5 import security and live voice lifecycle`.
- `git diff --cached --check` returned exit 0 with no output.
- `git diff --cached --exit-code -- src/voice/voice-agent.ts package.json package-lock.json` returned exit 0 with no output: contract and dependencies unchanged.
- The final staged `node .superpowers/sdd/task-5-secret-scan.cjs` run checked 57 tracked files and 22 browser artifacts, with zero findings and zero tracked private environment files.
- The report and raw `.superpowers/sdd/task-5-fix-*.log` evidence remain at the paths listed above. The report is committed separately from the implementation so this record can cite the implementation commit exactly.
