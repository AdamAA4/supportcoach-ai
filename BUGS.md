# Known bugs

Last updated: 2026-09-17

| Severity | Issue | Notes |
| --- | --- | --- |
| ⭐⭐ | Live AssemblyAI browser connection closes before the microphone prompt in the Codex in-app browser | The token route and a fresh-token server-side WebSocket handshake both reached `session.ready` on 2026-09-17. Browser close diagnostics are being added before selecting a provider or browser-specific fix. |
| --- | No open Task 5 review issues | Console startup ownership was fixed on 2026-09-16. Earlier address validation, DNS rebinding, audio cancellation, live mute, adapter startup, typed fallback, and remote termination findings were fixed on 2026-09-15; regression evidence is in `.superpowers/sdd/task-5-report.md`. |
| --- | No open Task 6 evaluator issue | Relation-anchored matching now drives factual scoring. It passed the four diagnostic cases, 39 matcher tests, 24 evaluator tests, 12 evaluation-route tests, 190 full-suite tests, TypeScript checking, and a production build on 2026-09-17. The deterministic paraphrase limitation remains documented in the matcher report. |
