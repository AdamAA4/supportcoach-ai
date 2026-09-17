# Known bugs

Last updated: 2026-09-17

| Severity | Issue | Notes |
| --- | --- | --- |
| ⭐⭐ | Android Chrome speaker output requires final device verification | The provider has been verified to stream valid 24 kHz PCM and transcript events. The player now uses a native 24 kHz Chromium context and the UI renders transcript deltas immediately. Physical Android speaker output remains to be verified after deployment. |
| --- | Resolved customer audio fragmentation | PCM reply chunks now share one scheduled playback timeline, and microphone capture uses the browser default sample rate before resampling to 24 kHz for the provider. |
| --- | Resolved duplicate microphone start control | Voice practice begins with one `Join voice call` action; active calls show only Mute/Unmute and End call. |
| --- | Resolved unsupported live text turns | The live call UI is voice-only and no longer sends unsupported text-turn protocol events. |
| --- | Resolved live AssemblyAI browser startup failure | Firefox and Chromium rejected a detached browser `fetch` call before the token request left the page. The adapter now binds `fetch` to `globalThis`; regression coverage was added on 2026-09-17. |
| --- | No open Task 5 review issues | Console startup ownership was fixed on 2026-09-16. Earlier address validation, DNS rebinding, audio cancellation, live mute, adapter startup, typed fallback, and remote termination findings were fixed on 2026-09-15; regression evidence is in `.superpowers/sdd/task-5-report.md`. |
| --- | No open Task 6 evaluator issue | Relation-anchored matching now drives factual scoring. It passed the four diagnostic cases, 39 matcher tests, 24 evaluator tests, 12 evaluation-route tests, 190 full-suite tests, TypeScript checking, and a production build on 2026-09-17. The deterministic paraphrase limitation remains documented in the matcher report. |
