# Known bugs

Last updated: 2026-09-16

| Severity | Issue | Notes |
| --- | --- | --- |
| --- | No open Task 5 review issues | Console startup ownership was fixed on 2026-09-16. Earlier address validation, DNS rebinding, audio cancellation, live mute, adapter startup, typed fallback, and remote termination findings were fixed on 2026-09-15; regression evidence is in `.superpowers/sdd/task-5-report.md`. |
| ⭐⭐⭐ | Task 6 evaluator incorrectly rejects correct coordinated facts with the same leading topic | The third and final targeted attempt passed the direct shared-topic cases but failed a required-conjunction overlap case in self-review; all attempted code and test edits were removed. The existing evaluator also reports false conflicts for correct same-topic facts in separate sentences. Task 6 remains blocked pending the separately authorized structured matcher. Exact reproductions and results are in the third-attempt diagnostic handoff in `.superpowers/sdd/task-6-report.md`. |
