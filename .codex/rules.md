# AI Coding Rules — `rag-job-copilot`

Use this file as the execution standard for every change in this repository.

## 1) Mission and Scope
- Build a reliable Chrome Extension (Manifest V3) for form detection and autofill.
- Keep the product frontend-only unless explicitly asked otherwise.
- Prioritize correctness, determinism, and compatibility over adding features.
- Do not add backend services, analytics SDKs, or remote data calls unless requested.

## 2) Architecture Boundaries (Mandatory)
- `src/content/*`: DOM scanning, fill logic, SPA observation, in-page widget behavior.
- `src/popup/*`: popup UI, active-tab query, message sending, status rendering.
- `src/shared/*`: message types, profile contracts, shared constants/utilities.
- `manifest.json`: permissions, content script registration, popup wiring.
- Keep business logic out of popup UI files when it can live in `content` or `shared`.

## 3) TypeScript Quality Bar
- TypeScript only for feature code.
- No `any` in application logic.
- Use explicit interfaces/types for message payloads and fill summaries.
- Prefer narrow unions over weak nullable contracts.
- Treat type errors as blockers.

## 4) Autofill Engine Rules
- Maintain deterministic behavior for every supported control type.
- Use native setters for `input` and `textarea` where applicable.
- Dispatch `input` and `change` events after writes.
- Never auto-submit forms.
- Handle per-field exceptions with try/catch and continue filling remaining fields.
- File inputs are user-controlled by browser policy; only prompt picker, never bypass security.

## 5) Detection Rules
- Detect: `input`, `textarea`, `select`, contenteditable, and supported role-based controls.
- Exclude non-fillable/restricted controls (`hidden`, `submit`, `button`, `reset`, `image`, disabled, etc.).
- Use pragmatic visibility checks (avoid aggressive filtering that misses real fields).
- Support SPA updates via throttled observers.

## 6) Mapping and Data Rules
- Keep profile field mapping centralized (single source of truth).
- Prefer semantic inference from label/name/id/placeholder/aria/autocomplete hints.
- Avoid hardcoded website-specific selectors unless there is no general alternative.
- If no safe mapping exists, fall back to deterministic default values.

## 7) Chrome Extension Rules
- Keep permissions minimal in `manifest.json`.
- Prefer content script access over dynamic script injection.
- Keep popup-content messaging strongly typed and backward compatible.
- Fail gracefully on restricted pages (`chrome://`, extension store, etc.).

## 8) UI and UX Rules
- Provide clear status states: detected count, fill action, success/error summary, upload prompts.
- Keep popup and in-page widget simple and functional.
- Preserve keyboard access and readable text contrast.
- Do not add visual complexity without a user request.

## 9) Security and Privacy
- Never send personal/profile/resume data to external services.
- Do not store sensitive data unless explicitly requested.
- Log operational diagnostics only; avoid leaking sensitive values in logs.

## 10) Change Strategy
- Apply minimal safe diffs.
- Refactor only when needed to remove duplication or fix structural issues.
- Keep modules focused and decoupled.
- Prefer simple, maintainable solutions over clever abstractions.

## 11) Testing and Verification Gate
Run all three before handoff:
- `npm run typecheck`
- `npm test`
- `npm run build`

Also verify:
- `dist/` contains a loadable unpacked extension (`manifest.json`, popup html, content bundle).
- No runtime crashes on typical pages with multiple forms and SPA updates.

## 12) Definition of Done (Per Task)
A task is complete only when:
- Behavior matches requested acceptance criteria.
- Types, tests, and build pass.
- Message contracts and docs are updated if changed.
- No unrelated churn is introduced.
