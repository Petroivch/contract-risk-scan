# Contract Risk Scanner: Analysis Architecture v2

```mermaid
flowchart TD
    A["document_text / document_base64"] --> B["Ingestion + normalization"]
    B --> C["Contract type detection"]
    B --> D["Clause segmentation"]
    D --> E["Asymmetry detector"]
    D --> F["Risk scoring rule engine"]
    C --> F
    E --> F
    F --> G["Disputed clauses"]
    F --> H["Role-focused summary"]
    F --> I["Contract brief"]
    C --> J["Optional metadata: contract_type"]
    E --> K["Optional metadata: asymmetry_signals"]
```

## What changed

- added `ContractTypeDetector`
- added `AsymmetryDetector`
- replaced simple risk tags with a legal risk taxonomy
- moved severity decisions to role-aware escalation
- removed raw text truncation in favor of sentence-safe previews

## What did not change

- FastAPI surface remains compatible
- main output objects still include `risks`, `disputed_clauses`, `role_focused_summary`, `contract_brief`
- the engine is still config-first and does not depend on an external LLM
