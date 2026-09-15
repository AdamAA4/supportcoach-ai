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

Set `NEXT_PUBLIC_VOICE_MODE=live` only when live voice is implemented and a valid `ASSEMBLYAI_API_KEY` is available to server-side code. `ASSEMBLYAI_API_KEY` is server-only: do not prefix it with `NEXT_PUBLIC_`, place it in client code, or commit it.

## Practice setup and demo path

The trainee starts each practice session by pasting a company FAQ or policy and confirming it. They can also paste experience notes, or add them as a plain-text or Markdown file; approved practice advice affects factual scoring while personal coaching notes affect suggestions only.

The golden demo path is: start in mock voice mode, paste and confirm a practice FAQ, add optional experience notes, choose either late delivery or refund eligibility, allow microphone access, speak to the simulated customer, then review the four-score coaching report.

The browser keeps the current source snapshot, notes, final transcript, and final report as local practice data. Use the **Clear practice data** action in the app to remove all four. Until that control is added, clear the site data for `localhost` in your browser settings.

## Fallback behavior

Current desktop Chrome or Edge with microphone permission is the demo target. If microphone access or audio playback is unavailable, the practice flow provides typed input. If live voice is unavailable, use mock voice mode. Public FAQ links require an HTTPS URL and confirmation of the extracted source snapshot; private or authenticated links, PDF notes, and DOCX notes are outside the MVP.
