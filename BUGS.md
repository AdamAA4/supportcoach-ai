# Known bugs

Last updated: 2026-09-17

| Severity | Issue | Notes |
| --- | --- | --- |
| --- | No open Task 5 review issues | Console startup ownership was fixed on 2026-09-16. Earlier address validation, DNS rebinding, audio cancellation, live mute, adapter startup, typed fallback, and remote termination findings were fixed on 2026-09-15; regression evidence is in `.superpowers/sdd/task-5-report.md`. |
| ⭐⭐⭐ | Task 6 evaluator incorrectly rejects correct coordinated facts with the same leading topic | The structured matcher compiler is approved, but Task 2 matching is not approved after two corrective rounds. Remaining failures involve condition-specific universal phrases, pre-subject `not`, ordinary noun-subject clauses, and unrelated numeric evidence. The matcher remains isolated from the evaluator, and Task 6 remains blocked. See `docs/superpowers/diagnostics/2026-09-17-structured-fact-matcher-task-2-handoff.md`. |
