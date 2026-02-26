# tasks.md — V1 Chrome Extension: Form Scanner + Autofill "test"

## 1) Scope and Architecture

- [x] Confirm V1 scope is popup-first UI only (no in-page floating button for initial delivery).
- [x] Confirm no backend, no profile storage, no RAG features.
- [x] Finalize extension architecture:
  - [x] `content_script` for detection + fill logic
  - [x] `popup` for count display + fill trigger
  - [x] no service worker in first pass (optional only for badge)

## 2) Project Setup

- [x] Initialize TypeScript extension project with Vite.
- [x] Add build scripts to produce a loadable `dist/` unpacked extension.
- [x] Create initial folder structure:
  - [x] `src/content/index.ts`
  - [x] `src/popup/index.ts`
  - [x] `src/popup/popup.html`
  - [x] `src/popup/popup.css`
  - [x] `manifest.json`
  - [x] `vite.config.ts`
  - [x] `README.md`

## 3) Manifest and Permissions (MV3)

- [x] Configure `manifest.json` for Manifest V3.
- [x] Register popup action UI.
- [x] Register content script on `"<all_urls>"` at `document_idle`.
- [x] Keep permissions minimal:
  - [x] include `activeTab`
  - [x] add `tabs` only if needed for popup messaging flow
  - [x] avoid `scripting` unless dynamic injection is introduced

## 4) Field Detection Engine (FR-1)

- [x] Implement `getFillableFields()` in content script.
- [x] Detect supported controls:
  - [x] `input` (excluding `hidden`, `submit`, `button`, `image`, `reset`)
  - [x] `textarea`
  - [x] `select`
  - [x] `[contenteditable="true"]`
  - [x] optional `[role="textbox"]`
- [x] Enforce fillable checks:
  - [x] not disabled
  - [x] not readonly for input/textarea
  - [x] visible-enough heuristic (`offsetParent` or computed style fallback)
- [x] Return normalized metadata and total count.

## 5) Fill Engine Rules (FR-2)

- [x] Implement deterministic fill behavior per field type.
- [x] Input rules:
  - [x] text-like types -> `"test"`
  - [x] `number` -> `"1"`
  - [x] `date` -> `"2026-01-01"`
  - [x] `datetime-local` -> `"2026-01-01T10:00"`
  - [x] `month` -> `"2026-01"`
  - [x] `time` -> `"10:00"`
  - [x] `week` -> `"2026-W01"`
  - [x] `color` -> `"#000000"`
  - [x] `range` -> midpoint `(min+max)/2`, else `"50"`
  - [x] `checkbox` -> checked `true`
  - [x] `radio` -> first enabled visible option per `name` group
  - [x] skip `file` and `hidden`
- [x] `textarea` -> `"test"`
- [x] `select` -> first enabled non-empty non-placeholder-like option
- [x] contenteditable/role textbox -> `textContent = "test"`

## 6) Framework-Friendly Events (FR-3)

- [x] Use native value setters for `HTMLInputElement` and `HTMLTextAreaElement`.
- [x] Dispatch `input` and `change` (bubbling) after each fill.
- [x] Optionally dispatch `blur` for compatibility.
- [x] Add robust try/catch per element to prevent global failure.

## 7) Content Script Runtime + SPA Support (FR-5)

- [x] Run initial scan on script load.
- [x] Track and cache detected field count.
- [x] Add throttled `MutationObserver` (250ms) for DOM updates.
- [x] Recompute count on mutations to support SPAs.
- [x] Add message handlers:
  - [x] `GET_FIELD_COUNT`
  - [x] `FILL_WITH_TEST`

## 8) Popup UI (FR-4)

- [x] Build popup UI with:
  - [x] `Detected fields: X`
  - [x] `Fill with test` button
  - [x] status text (success/errors/no forms)
- [x] On popup open: query active tab + request `GET_FIELD_COUNT`.
- [x] On button click: send `FILL_WITH_TEST` and render response summary.
- [x] Handle missing content-script/no-response gracefully.

## 9) Logging and Debug (FR-6)

- [x] Add prefixed logs: `[autofill-v1]`.
- [x] Log field-count changes.
- [x] Log fill execution summary.
- [x] Log per-field failures with safe error details.

## 10) Validation and Manual QA

- [x] Validate no runtime errors on typical pages.
- [x] Test multiple forms on one page.
- [x] Test form-like layouts without `<form>` elements.
- [x] Test SPA route/content updates.
- [x] Test common frameworks (React/Vue/Angular pages).
- [x] Test no-form page behavior.
- [x] Confirm deterministic behavior for radio/select/range/date-like inputs.

## 11) Documentation and Delivery

- [x] Write `README.md` with:
  - [x] prerequisites
  - [x] install dependencies
  - [x] build command
  - [x] load unpacked extension steps (`dist/`)
  - [x] usage instructions for popup autofill
  - [x] known limitations for V1
- [x] Ensure final deliverable includes loadable `dist/` output.
