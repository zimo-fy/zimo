---
name: zimo-code-review
description: Review Zimo code changes and report prioritized, evidence-backed findings without modifying the working tree. Invoke explicitly for local diffs, branches, commits, pull requests, or selected files that need code review.
---

# Zimo Code Review

Treat the text following `$zimo-code-review` as the review scope and any additional review criteria.

## Source of truth

Before reviewing, read:

1. the applicable `AGENTS.md` files;
2. `REQUIREMENTS.md`, `IMPLEMENTATION_PLAN.md`, and `PROGRESS.md` when the change affects product behavior or phase boundaries;
3. `docs/development/project-standards.md`, `code-style.md`, `typescript-standards.md`, and `testing.md`;
4. `react-standards.md` for Renderer changes, `electron-node-standards.md` for Main/Preload/Node changes, and `git-standards.md` for commit or PR concerns;
5. the architecture, security, error-handling, logging, ADR, feature, and issue documents relevant to the changed path.

Use these maintained documents as review criteria instead of duplicating their rules here.

## Select the review scope

Honor an explicit pull request, base branch, branch, commit, file list, or diff range. Otherwise:

1. review all uncommitted changes, including staged, unstaged, and untracked files;
2. if the working tree is clean and the current branch differs from its upstream, review the branch diff from the merge base;
3. if neither scope has changes, review `HEAD` and clearly state that fallback.

Inspect the repository status and state the selected scope before analysis. Do not include unrelated files merely because they are nearby.

## Review workflow

1. Read the complete selected diff before drawing conclusions. For large changes, group by subsystem and trace the highest-risk paths first.
2. Inspect enough surrounding implementation, callers, contracts, migrations, tests, and documentation to verify behavior beyond the changed lines.
3. Look primarily for defects introduced or exposed by the change: incorrect behavior, security or authorization gaps, data loss, broken migrations, race/cancellation errors, cross-platform failures, contract incompatibility, missing failure handling, and meaningful regression gaps.
4. Check repository-specific boundaries, including Renderer → Preload → Main → Application → Domain/Adapter direction, strict external/IPC Schema, secret and content logging rules, timeout/cancellation, migration ordering, and phase gates.
5. Validate each candidate finding against concrete code evidence. Run read-only targeted checks when they materially reduce uncertainty; do not run formatters in write mode or otherwise alter the working tree.
6. Suppress speculative, cosmetic, and preference-only comments. Report style or documentation findings only when they violate an applicable project rule, misstate behavior, or create a real maintenance or release risk.

## Severity and output

Report findings first, ordered by severity:

- `P0` — release-blocking security compromise, unrecoverable data loss, or broadly unusable build/runtime;
- `P1` — high-impact correctness, security, migration, or compatibility defect likely to affect users;
- `P2` — meaningful defect or regression risk with a narrower trigger or recoverable impact;
- `P3` — low-impact but actionable issue worth fixing before merge.

For every finding:

- identify the smallest relevant file and line range, preferably within the changed lines;
- explain the triggering scenario, observable consequence, and why the current code permits it;
- keep the comment self-contained and actionable without prescribing an unnecessarily broad rewrite;
- distinguish verified facts from remaining uncertainty.

Use inline review comments when the client supports them, and keep the final response concise. If no actionable findings remain, say so explicitly and list only material residual risks or validation gaps. A review is not an approval decision and must not claim checks passed unless they were actually run.

## Read-only boundary

Code review is read-only by default. Do not edit files, apply fixes, stage, commit, push, post PR comments, approve, or request changes unless the user separately authorizes that action. A later request to fix findings is a new implementation task and must follow the applicable Zimo feature or issue workflow.
