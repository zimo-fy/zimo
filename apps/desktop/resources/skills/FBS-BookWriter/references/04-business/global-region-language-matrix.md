# FBS-BookWriter Global Region-Language Matrix

Version: v1.1  
Updated: 2026-03-24  
Purpose: Canonical matrix for region and language planning.

---

## Navigation

- [Back to `SKILL.md`](../../SKILL.md)
- [Back to `global-research-scenario.md`](./global-research-scenario.md)
- [Back to `global.md`](./global.md)

---

## 1. Region Tiers

### 1.1 Region Snapshot

| Region | Code | Market Size | Monetization | English Coverage | Localization Complexity |
|---|---|---:|---:|---:|---:|
| North America | NA | 100 | High | 95% | Medium |
| Europe | EU | 65 | High | 60% | High |
| Asia-Pacific | AP | 90 | Medium-High | 40% | High |
| Latin America | LA | 35 | Medium | 25% | Medium |
| Middle East | ME | 25 | Medium-High | 30% | High |
| Africa | AF | 20 | Medium | 40% | Medium-High |

### 1.2 Region Priority

- P0: AP
- P1: NA, EU
- P2: LA, ME
- P3: AF

---

## 2. Language Tiers

### 2.1 Priority Languages

| Language | Code | Priority | Main Regions | Notes |
|---|---|---|---|---|
| English | EN | P0 | NA/EU/AP | Global default |
| Chinese Simplified | ZH-S | P0 | AP | Mainland and overseas Chinese |
| Chinese Traditional | ZH-T | P0/P1 | AP | TW/HK/MO and overseas Traditional |
| Spanish | ES | P1 | LA/EU | Core for LATAM |
| French | FR | P2 | EU/AF | EU + Francophone Africa |
| German | DE | P2 | EU | High quality expectations |
| Japanese | JA | P2 | AP | Strong style constraints |
| Arabic | AR | P2 | ME/AF | RTL + compliance sensitivity |
| Portuguese | PT | P3 | LA | Brazil-centric |

### 2.2 Region x Language Matrix

| Region \ Language | EN | ZH-S | ZH-T | ES | FR | DE | JA | AR | PT |
|---|---|---|---|---|---|---|---|---|---|
| NA | Strong | Medium | Low | Medium | Low | Low | Low | Low | Low |
| EU | Strong | Low | Low | Medium | Strong | Strong | Low | Low | Low |
| AP | Strong | Strong | Strong | Low | Low | Low | Strong | Low | Low |
| LA | Medium | Low | Low | Strong | Low | Low | Low | Low | Strong |
| ME | Medium | Low | Low | Low | Low | Low | Low | Strong | Low |
| AF | Medium | Low | Low | Low | Medium | Low | Low | Medium | Low |

---

## 3. Search and Data Sources

### 3.1 Search Engine Preference by Region

| Region | Primary | Secondary | Language Hint |
|---|---|---|---|
| NA | Google | Bing | EN |
| EU | Google | Bing | EN + local language |
| AP | Google/Baidu/Yahoo JP | Naver | ZH/JA/KO/EN |
| LA | Google | Bing | ES/PT/EN |
| ME | Google | regional directories | AR/EN |
| AF | Google | Bing | EN/FR/AR |

### 3.2 Data Source Priority

| Category | Priority Sources |
|---|---|
| Macro | World Bank, IMF, UN, OECD |
| Industry | Gartner, IDC, Forrester, Statista |
| Official | National bureau and official associations |
| Academic | Google Scholar and regional repositories |
| News | Reuters, Bloomberg, top local media |

---

## 4. Localization Notes

- Chinese: enforce simplified/traditional consistency and term mapping.
- English: keep one spelling convention (US or UK) per book.
- Arabic: validate RTL layout, punctuation, and number direction.
- Japanese: control honorific level and style consistency.

---

## 5. Delivery Phases

- Phase 1 (0-3 months): EN + ZH-S + ZH-T
- Phase 2 (3-6 months): ES + EU-EN + DE/JA
- Phase 3 (6-12 months): FR + AR + PT

---

## 6. Usage

1. Pick target region and language priority from this matrix.
2. Execute research flow in `global-research-scenario.md`.
3. Align KPIs and rollout phases with `global.md`.

---

Status: Encoding fixed and normalized as UTF-8-safe ASCII content.
