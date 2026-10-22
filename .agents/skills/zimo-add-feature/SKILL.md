---
name: zimo-add-feature
description: Plan, implement, verify, and document a requested Zimo feature while following the repository's architecture, coding, testing, security, and phase-gate rules. Invoke explicitly when adding or extending product behavior; do not use for bug-only work.
---

# Zimo Add Feature

Treat the text following `$zimo-add-feature` as the feature request.

## Source of truth

Before changing code, read:

1. `REQUIREMENTS.md`, `IMPLEMENTATION_PLAN.md`, and `PROGRESS.md`;
2. `docs/development/code-style.md` and `docs/development/testing.md`;
3. the relevant architecture, security, logging, error-handling, and ADR documents under `docs/`;
4. any applicable `AGENTS.md` files.

Reference these files instead of copying their rules into this skill. If documents conflict, follow the more specific applicable instruction and flag any unresolved product conflict.

## Workflow

1. Inspect the current implementation, tests, repository status, and nearby patterns. Preserve unrelated user changes.
2. Identify the current approved implementation phase and confirm that the request fits it. If it belongs to a later phase and the invocation does not explicitly authorize entering that phase, stop after explaining the phase conflict.
3. Before editing, present a concise implementation plan covering scope, main files or layers, validation, documentation, and notable risks. Continue with implementation unless a missing decision would materially change the result or repository rules require approval.
4. Implement the smallest complete vertical slice. Keep domain behavior out of UI, preserve layer direction, validate IPC and external inputs, and avoid unavailable or out-of-scope capabilities.
5. Add or update tests for new behavior, failure paths, boundary validation, cancellation, security, and regressions as applicable. Run the repository's relevant format, lint, typecheck, unit, integration, build, and E2E checks in proportion to the change.
6. Update documentation before completion:
   - create or update `docs/features/<feature-slug>.md` for user-visible behavior, scope, constraints, and verification;
   - update the exact architecture, IPC, stream, data, security, development, or ADR document when its contract or decision changes;
   - add newly created documents to `docs/README.md`;
   - update `PROGRESS.md` with completed work, validation results, and remaining limitations.
7. Review the final diff for accidental scope expansion, secrets, unsafe Electron access, undocumented behavior, and unrelated edits.

## Completion report

Lead with the delivered outcome. List the important files, checks run and results, documentation updated, and any remaining limitation or required approval. Do not claim success for checks that were not run or for mock capabilities that are not implemented.
