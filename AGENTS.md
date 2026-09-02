## Minimal Implementation Policy

Implement only the smallest direct change required by the confirmed request. Do not proactively add validation, limits, compatibility layers, abstractions, fallback behavior, security hardening, or adjacent UX changes unless they are explicitly requested or required by an existing project rule.

When an out-of-scope concern is discovered, mention it briefly instead of expanding the implementation.

## Runtime Preference

This repository uses Node.js/TypeScript. Do not introduce Python runtime code or Python package configuration.

## Frontend Preference

Use a frontend framework for the web UI rather than plain HTML/JavaScript. Visual quality and polish are first-class requirements for this project; choose a component and styling approach that supports a polished, coherent interface.

The current frontend release uses Chinese UI copy. User-authored memory content is displayed as entered.

## Development Command

`npm run dev` must start the backend and frontend together. Before starting, clear the development ports used by the project (currently `8765` and `5173`) so stale processes do not cause port conflicts.

## Memory Classification

`scope` is an optional classification field, not a required isolation boundary. A stable project directory or repository name (for this repository, `memory-one`) is one recommended scope value for project-specific preferences and knowledge, alongside values such as `work` or `personal`. MCP calls may omit `scope` for general-purpose searches or pass it as a category filter; do not require every memory or Agent call to include a scope.

## Durable Corrections

When the user corrects agent behavior or states a durable repository-specific working preference, update this `AGENTS.md` in the same change so future work follows that correction.

## Git Worktree Directory Rule

Place additional worktrees in the parent directory of the primary checkout. Name each worktree as `../<repository-name>-<purpose>`.

## GitHub Research Rule

Use the authenticated `gh` CLI for GitHub repository searches, metadata inspection, and source browsing instead of direct web requests or browser search.
