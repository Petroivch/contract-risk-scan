# Contract Analysis Findings

Corpus snapshot on April 28, 2026:

- `447` files across `договоры`, `договоры 2`, `договоры 3`, `договоры 4`
- dominant formats: `352 .doc`, `22 .docx`, `71 .html`
- corpus is mixed: contracts, annexes, acts, claims, notices, applications

## Main observations

1. Legacy `.doc` dominates the corpus. This is a bigger source of quality loss than the risk taxonomy itself.
2. Many files are not contracts. A generic legal-form pre-filter is needed to reduce false positives.
3. Numbered clauses are common, but many documents are not split by blank lines. Segmentation must use numbering as a backup.
4. Boilerplate, blank appendices, and HTML wrappers are frequent and create noise for keyword-only matching.

## Dominant contract families

1. Lease / rental / sublease
2. Services / maintenance / outsourcing
3. Supply / sale / delivery
4. Construction / repair / installation / contractor work
5. Agency / commission / mandate
6. Loan / pledge / surety / bank guarantee
7. Insurance
8. IP / patents / know-how / R&D
9. Partnership / joint activity
10. Labor and education-linked contracts

## Common recurring risks

- performance before payment
- long payment delay without collateral
- payment blocked by unsigned act
- unilateral price or scope change
- one-sided penalties
- uncapped daily penalties
- unlimited liability
- vague acceptance criteria
- no acceptance deadline
- no warranty period
- unlimited defect cure
- unilateral termination
- vague material breach
- discretionary retention of deposit
- early transfer of accidental loss
- unclear confidentiality carve-outs
- unclear IP transfer scope
- all-obligations security clauses
- one-sided dispute resolution clauses

## Implications for the engine

- `contract_types[]` must reflect the real top-level classes above.
- `risk_rules[]` must be role-aware, not fact-aware.
- asymmetry detection needs explicit `harmed_role` logic.
- output must keep full legal meaning; raw truncation is unacceptable.
