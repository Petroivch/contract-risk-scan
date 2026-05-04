# Privacy, Legal, and Release Readiness

Contract Risk Scanner produces an automated preliminary review. It is not legal advice, not an advocate or attorney opinion, and not confirmation that a contract is safe to sign. Any public or customer-facing distribution must keep this disclaimer visible in onboarding, upload consent, and reports.

## RF-Law Risk Framing

The repository and a local prototype do not by themselves establish compliance or non-compliance with Russian Federation law. Production use can create RF-law risk when uploaded contracts contain personal data, trade secrets, confidential terms, or legally privileged material. Release readiness must account for, at minimum, the potential applicability of FZ-152 on personal data, FZ-149 on information protection, FZ-98 on trade secrets, and FZ-63 risk around implying advocate legal services.

## Consent and Processing Policy

- Upload and analysis require explicit user consent before any document, extracted text, diagnostic payload, or report leaves the device.
- Consent copy must identify whether the build is backend-assisted, fully offline-local, or using an optional remote/LLM provider.
- Third-party cloud or LLM processing is opt-in only and must not be enabled by a generic backend flag.
- Payload, extracted text, and report logs are prohibited unless a separately reviewed diagnostic mode redacts content and is explicitly enabled.

## Zero-Retention Default

- Default backend behavior is zero-retention for source documents: raw files and `document_base64` payloads are held only for the active request/job and then cleared.
- Persisted storage of source files, extracted text, or full reports requires a named storage mode, TTL, deletion path, and policy owner.
- Audit logs must store metadata only and must not include raw contract text, base64 payloads, or excerpts that can reconstruct the contract.

## Transport and Backend Requirements

- Backend-assisted release builds must use TLS. Public or production `API_BASE_URL` values must be `https://` endpoints.
- A release built with `API_TRANSPORT=http` and an empty `API_BASE_URL` is an offline-local/internal build only. It must not be described as validating backend quality or backend-assisted analysis.
- Release smoke checks must inspect the APK `assets/app.config` and record `API_TRANSPORT`, `API_BASE_URL`, and whether the build is backend-assisted or offline-local.
- Backend configuration must document data lifecycle, redacted logging, request size limits, timeout behavior, and region/data-location assumptions before production use.

## Local and Offline Boundaries

Offline-local means no document payload, extracted text, or report leaves the device during analysis. It may still create temporary OS picker/runtime files while reading a document.

Backend-assisted means the app sends at least metadata and may send binary/base64 or extracted text to `core-api` and `analysis-engine`. That mode requires consent, TLS, no payload logs, and zero-retention defaults. Do not market an offline-local APK as representative of backend scoring quality.

## Non-Committable Artifacts

Generated corpora, raw document collections, base64 payload dumps, raw payload captures, ad hoc corpus runs, smoke runs, and exported report bundles are workspace diagnostics. They are not release artifacts and must not be committed. The only installable Android artifact allowed in the repo root is `contract-risk-scanner-android.apk`.
