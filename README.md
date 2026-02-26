# Autofill V1 Chrome Extension

V1 Chrome Extension (Manifest V3) that detects fillable form controls and fills them with deterministic test values when you click **Fill with test** in the popup.

## Features
- Detects fillable controls on page load and SPA-style DOM updates.
- Popup shows detected field count.
- One-click fill with deterministic values:
  - Text-like fields -> `test`
  - `number` -> `1`
  - `date` -> `2026-01-01`
  - `datetime-local` -> `2026-01-01T10:00`
  - `month` -> `2026-01`
  - `time` -> `10:00`
  - `week` -> `2026-W01`
  - `color` -> `#000000`
  - `range` -> midpoint or `50`
  - `checkbox` -> checked
  - `radio` -> first enabled visible in group
  - `select` -> first enabled non-placeholder option
  - `contenteditable` / `role=textbox` -> `test`
- Dispatches `input` and `change` events to support React/Vue/Angular forms.
- Logs to console with `[autofill-v1]` prefix.

## Prerequisites
- Node.js 20+ (tested on Node 22)
- npm 10+

## Install Dependencies
```bash
npm install
```

## Build
```bash
npm run build
```

Build output is generated in `dist/`.

## Load as Unpacked Extension
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the repo `dist/` directory.

## Usage
1. Open a page that contains fillable form controls.
2. Click the extension icon.
3. Popup shows `Detected fields: X`.
4. Click **Fill with test**.
5. Popup displays fill summary and page fields are updated.

## Development / Verification
Run type checks:
```bash
npm run typecheck
```

Run tests:
```bash
npm test
```

Watch build (optional):
```bash
npm run dev
```

## V1 Limitations
- No backend and no storage.
- No profile management.
- No in-page floating button (popup-only UI in V1).
- No shadow-DOM traversal for deeply encapsulated custom components.
