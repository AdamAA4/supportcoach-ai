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
