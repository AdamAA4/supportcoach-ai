# Known bugs

Last updated: 2026-09-17

| Severity | Issue | Notes |
| --- | --- | --- |
| --- | Resolved live AssemblyAI browser startup failure | Firefox and Chromium rejected a detached browser `fetch` call before the token request left the page. The adapter now binds `fetch` to `globalThis`; regression coverage was added on 2026-09-17. |
| --- | No open Task 5 review issues | Console startup ownership was fixed on 2026-09-16. Earlier address validation, DNS rebinding, audio cancellation, live mute, adapter startup, typed fallback, and remote termination findings were fixed on 2026-09-15; regression evidence is in `.superpowers/sdd/task-5-report.md`. |
| --- | No open Task 6 evaluator issue | Relation-anchored matching now drives factual scoring. It passed the four diagnostic cases, 39 matcher tests, 24 evaluator tests, 12 evaluation-route tests, 190 full-suite tests, TypeScript checking, and a production build on 2026-09-17. The deterministic paraphrase limitation remains documented in the matcher report. |
