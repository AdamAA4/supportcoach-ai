# Known bugs

Last updated: 2026-09-17

| Severity | Issue | Notes |
| --- | --- | --- |
| --- | No open Task 5 review issues | Console startup ownership was fixed on 2026-09-16. Earlier address validation, DNS rebinding, audio cancellation, live mute, adapter startup, typed fallback, and remote termination findings were fixed on 2026-09-15; regression evidence is in `.superpowers/sdd/task-5-report.md`. |
| ⭐⭐⭐ | Task 6 evaluator incorrectly rejects correct coordinated facts with the same leading topic | The relation-anchored matcher correction passes all four diagnostic cases and the existing 35 matcher cases, with lightweight focused, full-suite, and production-build verification. The matcher remains isolated from the evaluator, so Task 6 integration remains pending. Evidence: `.superpowers/sdd/relation-anchored-matcher-task-1-report.md`; original diagnosis: `docs/superpowers/diagnostics/2026-09-17-structured-fact-matcher-task-2-handoff.md`. |
