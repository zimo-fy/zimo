# FBS-BookWriter Global Research Scenarios

Version: v1.1  
Updated: 2026-03-24  
Purpose: Standard scenario playbook for global research across S0-S3.

---

## Navigation

- [Back to `SKILL.md`](../../SKILL.md)
- [Back to `global-region-language-matrix.md`](./global-region-language-matrix.md)
- [Back to `global.md`](./global.md)

---

## 1. Scope

This document defines reusable global research scenarios for:

1. Cross-region book/whitepaper projects.
2. Multi-language localization workflows.

It is designed to convert global strategy into auditable execution steps.

---

## 2. Stage Deliverables

### 2.1 S0 - Pre-research scans

Inputs: topic, target region, target audience.

Actions:

- market size and growth scan
- audience pain points and buying context scan
- competitor and alternative scan

Deliverables:

- `S0-Region-Brief.md`
- `S0-Reader-Brief.md`
- `S0-Competitor-Brief.md`

### 2.2 S1 - Positioning

Inputs: S0 briefs.

Actions:

- define region priority (P0/P1/P2)
- define language scope (primary + secondary)
- define value proposition and differentiation anchors

Deliverables:

- `S1-Positioning.md`
- `S1-Language-Scope.md`

### 2.3 S2 - Outline and localization map

Inputs: S1 outputs.

Actions:

- shape chapter outline by region/language impact
- mark evidence density per chapter
- map localization-sensitive sections

Deliverables:

- `S2-Outline.md`
- `S2-Localization-Map.md`

### 2.4 S3 - Writing and review

Inputs: S2 outline and mapping.

Actions:

- run chapter gate -> drafting -> review
- persist chapter evidence notes
- apply extra review for high-risk languages

Deliverables:

- chapter drafts
- `.fbs/writing-notes/{chapterId}.writing-notes.md`
- gate and quality ledger records

---

## 3. Reusable Scenario Templates

### 3.1 Template A: Single-region deep dive

Best for first landing market.

1. macro and industry scan
2. audience segmentation
3. competitor benchmark
4. localization constraints
5. chapter and case mapping

### 3.2 Template B: Multi-region comparison

Best for prioritization.

1. collect normalized KPIs for NA/EU/AP/LA/ME/AF
2. compute region score
3. define P0/P1/P2 rollout
4. output risk and resource plan

### 3.3 Template C: Single-language multi-region

Best for EN/ES cross-region release.

1. create a canonical language version
2. add region-specific chapters
3. localize terminology and cases
4. produce release variants

---

## 4. Quality Score

### 4.1 Research score dimensions

| Dimension | Weight | Rule |
|---|---:|---|
| Data reliability | 30% | authoritative and traceable sources |
| Regional relevance | 25% | high match with target region |
| Actionability | 20% | can be converted to chapter actions |
| Freshness | 15% | up-to-date policy and market inputs |
| Completeness | 10% | market/audience/competitor/risk coverage |

### 4.2 Score bands

- A (>=85): proceed to S2/S3
- B (70-84): proceed after gap fixes
- C (60-69): rework required
- D (<60): stop and redesign

---

## 5. Anti-stall Rules

1. Single page access timeout: 15 seconds.
2. Timed-out domain is blocked for current run.
3. Same domain timeout >=3/day -> blocked for 7 days.
4. On failure, return stage + retry guidance; no silent waiting.

---

## 6. Evidence Assets

### 6.1 Minimum evidence requirements

- store adopted URLs and summaries per chapter
- store gate results in ledgers
- every critical claim must be traceable

### 6.2 Writing note required fields

- `chapterId`
- `topic`
- `run_id`
- adopted sources (`url`, `summary`)
- gate excerpts (`query`, `summary`)

---

## 7. Risks and fallback

| Risk | Signal | Fallback |
|---|---|---|
| unstable sources | citations fail verification | replace sources and revalidate |
| over-generic localization | poor region acceptance | split region-specific chapters |
| language drift | rising terminology complaints | enforce term dictionary and native review |
| repeated timeouts | gate failure spikes | switch domains and retrieval paths |

---

## 8. Related Documents

- Region/language baseline: `global-region-language-matrix.md`
- Strategy and KPI: `global.md`
- Quality specs: `references/02-quality/*`
- Delivery and operations: `references/05-ops/*`

---

Status: Encoding fixed and normalized as UTF-8-safe ASCII content.
