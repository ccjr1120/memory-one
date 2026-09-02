## Minimal Implementation Policy

Implement only the smallest direct change required by the confirmed request. Do not proactively add validation, limits, compatibility layers, abstractions, fallback behavior, security hardening, or adjacent UX changes unless they are explicitly requested or required by an existing project rule.

When an out-of-scope concern is discovered, mention it briefly instead of expanding the implementation.

## Durable Corrections

When the user corrects agent behavior or states a durable repository-specific working preference, update this `AGENTS.md` in the same change so future work follows that correction.

## Git Worktree Directory Rule

Place additional worktrees in the parent directory of the primary checkout. Name each worktree as `../<repository-name>-<purpose>`.

## GitHub Research Rule

Use the authenticated `gh` CLI for GitHub repository searches, metadata inspection, and source browsing instead of direct web requests or browser search.
