---
name: zimo-fix-issue
description: Diagnose, fix, verify, and document a Zimo defect while following repository standards. Invoke explicitly for bug reports, regressions, broken behavior, or reliability issues; complex problems must receive a durable issue record and affected workflows must be updated.
---

# Zimo Fix Issue

Treat the text following `$zimo-fix-issue` as the issue report.

## Source of truth

Before changing code, read:

1. `REQUIREMENTS.md`, `IMPLEMENTATION_PLAN.md`, and `PROGRESS.md`;
2. `docs/development/code-style.md`, `docs/development/testing.md`, `docs/development/error-handling.md`, and `docs/development/logging.md`;
3. the architecture, security, flow, and ADR documents relevant to the failing path;
4. any applicable `AGENTS.md` files.

Reference these maintained documents rather than duplicating their rules in this skill.

## Diagnose and classify

1. Inspect the repository status and preserve unrelated user changes.
2. Reproduce the problem or gather the strongest available evidence before editing. Trace the failing path across boundaries and distinguish symptoms from root cause.
3. Classify the issue as complex when any of these apply:
   - the root cause is initially uncertain or spans multiple architectural layers;
   - it involves concurrency, streaming, cancellation, IPC, security, secrets, migrations, data integrity, or provider compatibility;
   - the fix changes a public contract, domain invariant, architecture decision, or development/runtime workflow;
   - failure can cause data loss, privilege expansion, repeated outages, or a broad regression.
4. State a concise fix plan before editing. For complex issues include the evidence, suspected root cause, affected boundaries, regression strategy, and documentation target. If safe reproduction is impossible, state the limitation and use the least risky evidence-backed fix.

## Fix and verify

1. Fix the root cause with the narrowest complete change; do not only suppress the symptom or weaken validation/security.
2. Add a regression test that fails for the original defect whenever practical. Cover adjacent failure and cancellation paths when risk warrants it.
3. Run the smallest sufficient validation first, then the applicable format, lint, typecheck, unit, integration, build, and E2E checks.
4. Re-check logs and serialized errors for sensitive data when the issue touches credentials, IPC, providers, or diagnostics.

## Documentation

- For every complex issue, create or update `docs/issues/<issue-slug>.md` with symptoms, impact, evidence/reproduction, root cause, fix, regression coverage, and remaining risks.
- If the fix changes a workflow or contract, update the specific source-of-truth document for that flow, such as `docs/architecture/ipc-contract.md`, `docs/architecture/stream-events.md`, `docs/architecture/data-model.md`, `docs/development/testing.md`, or an ADR. Do not leave the new process only in the issue record.
- Add new issue documents to `docs/README.md` and record material progress or remaining work in `PROGRESS.md`.
- A simple, localized defect does not require a standalone issue document unless it changes documented behavior or the user requests one.

## Completion report

Report the confirmed root cause, implemented fix, regression coverage, checks run and results, documentation changes, and any remaining uncertainty. Clearly distinguish verified facts from inference.
