import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const handoffPath = resolve(root, "HANDOFF.md");
const start = "<!-- GENERATED SNAPSHOT: START -->";
const end = "<!-- GENERATED SNAPSHOT: END -->";

const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const branch = git(["branch", "--show-current"]);
const commit = git(["rev-parse", "--short", "HEAD"]);
const changes = git(["status", "--short"]).split("\n").filter(Boolean).filter((line) => !line.endsWith(" HANDOFF.md"));
const snapshot = `${start}
## Current Git snapshot

- Branch: \`${branch}\`
- Current commit: \`${commit}\`
- Generated: ${new Date().toISOString()}
- Uncommitted files excluding this handoff: ${changes.length ? "" : "none"}

${changes.length ? "```text\n" + changes.join("\n") + "\n```" : ""}
${end}`;

const existing = existsSync(handoffPath) ? readFileSync(handoffPath, "utf8") : "";
const before = existing.includes(start) ? existing.slice(0, existing.indexOf(start)) : existing;
const after = existing.includes(end) ? existing.slice(existing.indexOf(end) + end.length) : "";
writeFileSync(handoffPath, `${before.trimEnd()}\n\n${snapshot}\n${after.trimStart()}`.trimEnd() + "\n");
console.log(`Updated HANDOFF.md for ${branch} at ${commit}.`);
