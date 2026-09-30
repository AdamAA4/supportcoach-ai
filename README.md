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

## Agent handoff

When moving between coding tools, the outgoing coding model runs `npm run handoff`, writes the model-owned notes in [HANDOFF.md](HANDOFF.md), then commits and pushes the completed work and handoff together. The command captures the current branch, commit, and changed files; it does not overwrite the model's written notes.

## Vercel deployment

Vercel is the recommended host for this Next.js app. This checkout does not currently have a Git remote, so use one of these paths:

1. **Recommended: GitHub + Vercel.** Create a GitHub repository, push the `supportcoach-mvp` branch, then import that repository in [Vercel](https://vercel.com/new). Vercel detects Next.js automatically.
2. **Direct Vercel deployment.** Sign in with `npx vercel login`, then run `npx vercel` from this folder. This creates a Vercel project without first creating a GitHub repository.

Before a Preview or Production deployment, add these Environment Variables in the Vercel project settings:

```env
ASSEMBLYAI_API_KEY=your_AssemblyAI_key
NEXT_PUBLIC_VOICE_MODE=live
```

`ASSEMBLYAI_API_KEY` is a server-only secret. Add it for Preview and Production, never as a `NEXT_PUBLIC_` value, and never commit it. Redeploy after saving the variables. Test the deployed app with a short FAQ and one microphone call in desktop Chrome or Edge.

## Optional AI-assisted FAQ extraction

Without extra configuration, imported pages use basic structure-based extraction. For better results on JavaScript-heavy FAQ pages, set these server-only variables in `.env.local` (never commit them):

```env
LLM_PROVIDER=gemini
LLM_API_KEY=your_llm_key
```

`LLM_PROVIDER` accepts `gemini` (Google AI Studio key) or `openai`. The importer uses the model only when deterministic extraction cannot find complete source facts; it sends the page's collected text with a strict no-invention instruction, then verifies every returned question/answer pair against the page's own words before use. Pairs that are not grounded in the page are dropped, and any AI failure falls back to basic extraction silently. The setup screen always labels which extraction path was used.

## Voice modes

`NEXT_PUBLIC_VOICE_MODE=mock` is the default and needs no API key. It supports the hackathon demo with simulated voice behavior.

Set `NEXT_PUBLIC_VOICE_MODE=live` with a valid server-side `ASSEMBLYAI_API_KEY` to use AssemblyAI Voice Agents. The server exchanges the permanent key for a single-use temporary token valid for five minutes; the browser receives only that temporary token before it opens the live WebSocket. `ASSEMBLYAI_API_KEY` is server-only: do not prefix it with `NEXT_PUBLIC_`, place it in client code, or commit it.

Live calls are voice-only. `Join voice call` starts microphone setup from a direct user action; after it connects, Mute/Unmute and End call are the available controls. Permission denial shows a recoverable retry state. Remote session termination closes capture resources and shows the existing retry state. `src/voice/assemblyai-voice-agent.ts` owns connection/capture lifetime, and `src/voice/audio-player.ts` owns ordered PCM playback and interruption cancellation.

If a live call cannot connect, the call screen now reports the provider session-error code or the browser WebSocket close code. Record that code when debugging; it contains no API key or transcript content.

## Practice setup and demo path

Share the homepage URL, https://supportcoach-ai-ten.vercel.app/, to start at the introduction before setup. For an original demo source, import https://supportcoach-ai-ten.vercel.app/adamtrading-faq.html and confirm its 22 FAQ answers. ADAMTRADING is fictional: all trades, balances and rewards are simulated, and it offers no financial services or real-money payouts. Select only the topics you intend to answer; Refresh suggestions shows more source-derived topics.

The trainee starts each practice session by pasting a company FAQ or policy, or importing one public HTTPS page once and confirming its sanitized preview. They can also paste experience notes, or add them as a plain-text or Markdown file. Factual scores use confirmed FAQ/policy facts only. Experience notes remain available as practice guidance; personal coaching notes can shape the next exercise but cannot establish a factual pass.

The reference importer resolves and validates addresses once, then connects directly to a validated numeric address using Node HTTPS. It retains the original Host header, TLS server name, and certificate hostname check, so a later DNS change cannot redirect the connection. Redirects are refused, and the complete operation has a five-second deadline and a 2 MB body limit; pages over the limit are rejected with their measured size, and the recovery is to paste the FAQ text instead. The address policy conservatively refuses special-use IPv4 ranges and IPv6 outside ordinary global unicast, including mapped and transition addresses. Reproduce these controls with `npm test -- src/app/api/reference-import/route.test.ts`.

If a public website denies server access (HTTP 401/403 or a bot challenge), the importer explains the block and asks the trainee to open the relevant FAQ articles, copy their questions and answers, and use Paste text. SupportCoach cannot read a page it is not allowed to fetch; a Help Center home page containing only article links is not a substitute for the answers.

The golden demo path is: start in mock voice mode, paste and confirm a practice FAQ (a trading or SaaS FAQ works as well as e-commerce), select one or more drills from the "From your FAQ" group, allow microphone access, speak to the simulated customer, then review the four-score coaching report. Selected drills become one voice session: their confirmed facts are combined into one customer question plan and one report. Drills are always derived from the confirmed FAQ's own sections, so practice and scoring always match your material's domain; the two historical e-commerce drills are no longer offered (they remain valid only for previously saved sessions).

The browser stages the current source snapshot and notes in the existing active-session localStorage key. It saves the completed context, final transcript, and report together under `supportcoach.completed-practice.v1` only after the call ends and evaluation succeeds. Reloading `/report` restores that saved report. **Clear practice data** removes both keys, including source, notes, transcript, and report, while leaving unrelated site data alone. Invalid stored values are discarded; storage failures show a retryable error instead of claiming success.

## Evaluation and debugging

`src/components/call-console.tsx` freezes the same transcript displayed in the call and waits for voice shutdown. `src/app/call/page.tsx` posts that snapshot to `/api/evaluate`, checks the returned transcript and provenance, saves the successful report, and navigates to `/report`. Failed requests retain the final transcript on the call page for retry; they do not save a new completed report. The request times out after 15 seconds.

`src/app/api/evaluate/route.ts` validates the full request, reconstructs the normalized source facts, checks the active context/content-hash match, independently checks imported SHA-256 snapshots, and caps transcripts at 200 turns and 20,000 text characters. No transcript, notes, or source text is logged by application code. Sessions are browser-owned: these consistency checks detect mismatches, but do not authenticate a client-supplied source or prove that a call occurred. There is no server session registry.

`src/evaluation/grounded-evaluator.ts` orchestrates factual meaning review using the same server-only `LLM_PROVIDER` and `LLM_API_KEY` as extraction. Only selected FAQ facts and transcript turns are sent to the provider; experience notes are excluded. The model must cite actual trainee quotes, preserve material conditions and return every selected fact's verdict. Local checks reject fabricated/customer evidence and changed or missing quantities. A nine-second provider deadline, invalid output or unavailable configuration falls back to word matching; the report labels the review method. This is practice feedback, and AI judgments can be wrong. The unauthenticated endpoint limits requests to 10 per minute per IP per process; this is not a global spending cap.

`src/evaluation/deterministic-evaluator.ts` still implements the 0–3 rubric and the fallback. Only trainee turns earn credit. Numeric, negation, opposite-condition and unconditional-promise conflicts reduce factual scores. A correct answer to one confirmed fact is not treated as a contradiction of another fact. Empathy checks acknowledgement/apology phrases, clarity requires grounded usefulness before concise delivery earns points, and resolution checks next steps/escalation. Fallback word matching can miss paraphrases; inspect missed facts alongside the full transcript. Existing percentage safeguards remain, with narrow recognition of profit-goal phrasing such as "gain 10% profit".

Reproduce the boundary and persistence checks with `npm test -- src/evaluation/evaluator.test.ts src/app/api/evaluate/route.test.ts src/storage/local-practice-store.test.ts src/app/call/page.test.tsx src/components/coaching-report.test.tsx`. The report preserves the existing typed `sourceProvenance` contract. No dependencies were added.

If a new report says word-based review, inspect Vercel runtime logs for `supportcoach.coaching_fallback`. Only a bounded failure code is logged, such as `llm-http-503`, `provider-timeout` or `semantic-invalid`; source text, speech and secrets are not logged. Provider availability is not guaranteed, and broader paraphrases may be missed during fallback.

Coaching retries one provider HTTP 502/503/504 failure using the same nine-second abort deadline. It does not retry authentication failures, quota failures or malformed output, and extraction retains its previous single-attempt behavior. Persistent provider failure still returns the labeled fallback.

## FAQ and report consistency

The customer prompt, question plan and factual grader use the same selected FAQ facts. Select every topic you want to practice; unselected topics are not part of that call's grading scope. Intercom Help Center directories are used only to discover links, while article bodies supply the confirmed answers. The existing eight-link crawl cap still applies, so import stats describe only the pages actually read; paste any additional required FAQ answers.

The fallback factual matcher preserves complete spoken turns and can cover required terms across sentences in one turn. It excludes question sentences and retains numeric, negation and condition safeguards. AI-assisted review additionally accepts equivalent meaning and relevant direct clarifications with exact evidence. The live customer prompt acknowledges prior answers, skips answered topics and asks one focused clarification for missing details; actual conversation quality still needs phone acceptance testing. Existing reports and confirmed source snapshots are not rewritten: re-import the FAQ and complete a new call after an update.

Audio diagnostics and source hashes remain available under Technical details. Notes detect Markdown file extensions or pasted Markdown structure automatically; personal coaching notes and approved advice remain distinct from factual policy.

## Browser support

Current desktop Chrome or Edge with microphone permission is the demo target. The live practice flow requires microphone access; if it is unavailable, enable permission and retry the call. If live voice is unavailable, use mock voice mode. Public FAQ links require an HTTPS URL and confirmation of the extracted source snapshot; private or authenticated links, PDF notes, and DOCX notes are outside the MVP.
