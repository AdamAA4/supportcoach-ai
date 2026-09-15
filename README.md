# SupportCoach AI

SupportCoach AI lets a trainee practice a support conversation by speaking to a simulated customer. It is a training tool, not a system for answering real customers.

## Local setup

Use Node.js 20 or later.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run the engineering checks with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## Voice modes

`NEXT_PUBLIC_VOICE_MODE=mock` is the default and needs no API key. It supports the hackathon demo with simulated voice behavior.

Set `NEXT_PUBLIC_VOICE_MODE=live` with a valid server-side `ASSEMBLYAI_API_KEY` to use AssemblyAI Voice Agents. The server exchanges the permanent key for a single-use temporary token valid for five minutes; the browser receives only that temporary token before it opens the live WebSocket. `ASSEMBLYAI_API_KEY` is server-only: do not prefix it with `NEXT_PUBLIC_`, place it in client code, or commit it.

Live mute disables microphone tracks and pauses audio-frame transmission; unmute reuses the same capture graph. Permission denial keeps the live session available for typed replies. Remote session termination closes capture resources and shows the existing retry state. `src/voice/assemblyai-voice-agent.ts` owns connection/capture lifetime, and `src/voice/audio-player.ts` owns ordered playback and interruption cancellation.

## Practice setup and demo path

The trainee starts each practice session by pasting a company FAQ or policy, or importing one public HTTPS page once and confirming its sanitized preview. They can also paste experience notes, or add them as a plain-text or Markdown file; approved practice advice affects factual scoring while personal coaching notes affect suggestions only.

The reference importer resolves and validates addresses once, then connects directly to a validated numeric address using Node HTTPS. It retains the original Host header, TLS server name, and certificate hostname check, so a later DNS change cannot redirect the connection. Redirects are refused, and the complete operation has a five-second deadline and 200 KB body limit. The address policy conservatively refuses special-use IPv4 ranges and IPv6 outside ordinary global unicast, including mapped and transition addresses. Reproduce these controls with `npm test -- src/app/api/reference-import/route.test.ts`.

The golden demo path is: start in mock voice mode, paste and confirm a practice FAQ, add optional experience notes, choose either late delivery or refund eligibility, allow microphone access, speak to the simulated customer, then review the four-score coaching report.

The browser keeps the current source snapshot, notes, final transcript, and final report as local practice data. Use the **Clear practice data** action in the app to remove all four. Until that control is added, clear the site data for `localhost` in your browser settings.

## Fallback behavior

Current desktop Chrome or Edge with microphone permission is the demo target. If microphone access or audio playback is unavailable, the practice flow provides typed input. If live voice is unavailable, use mock voice mode. Public FAQ links require an HTTPS URL and confirmation of the extracted source snapshot; private or authenticated links, PDF notes, and DOCX notes are outside the MVP.
