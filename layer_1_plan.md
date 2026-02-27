# Layer 1 Plan: Explicit-Semantics Field Matching

## Goal
Implement Layer 1 as the first autofill pass after the user clicks `Fill Form`.

Layer 1 must be:
1. Fast.
2. Deterministic.
3. High-confidence only.

Layer 1 should fill fields when explicit HTML semantics are strong, and defer uncertain fields to later layers.

## Scope
Layer 1 includes:
1. Field discovery.
2. Explicit signal extraction (`label`, `aria`, `autocomplete`, `name`, `id`, `placeholder`).
3. Field-type candidate scoring.
4. Confidence calculation.
5. Decision output (`resolved`, `ambiguous`, `unresolved`).

Layer 1 excludes:
1. Visual geometry (`getBoundingClientRect`) logic.
2. NLP/inference models.
3. DOM-structure heuristic matching beyond explicit semantics.

## Trigger Flow
1. User opens extension popup and clicks `Fill Form`.
2. Popup sends message to active tab: `FILL_FORM`.
3. Content script receives message and runs Layer 1 orchestrator.
4. Layer 1 returns per-field decisions.
5. Resolved fields are filled immediately.
6. Ambiguous/unresolved fields are passed to Layer 2 later.

## Proposed File Structure
1. `src/content/autofill/orchestrator.ts`
2. `src/content/autofill/layer1.ts`
3. `src/content/autofill/scoring.ts`
4. `src/content/autofill/field-discovery.ts`
5. `src/content/autofill/types.ts`
6. `src/content/autofill/vocabulary.ts`
7. `src/content/autofill/fill.ts`

## Data Contracts
```ts
export type FieldElement =
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement
  | HTMLElement

export type ControlKind =
  | "textual"
  | "choice"
  | "boolean"
  | "file"
  | "custom"

export type FieldType =
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "phone"
  | "address_line1"
  | "address_line2"
  | "city"
  | "state"
  | "postal_code"
  | "country"
  | "company"
  | "job_title"
  | "linkedin"
  | "github"
  | "website"
  | "unknown"

export type LayerStatus = "resolved" | "ambiguous" | "unresolved"

export interface Evidence {
  signal:
    | "label_for"
    | "label_wrap"
    | "aria_labelledby"
    | "autocomplete"
    | "aria_label"
    | "name"
    | "id"
    | "placeholder"
  rawValue: string
  matchedType: FieldType
  weight: number
}

export interface Layer1Result {
  element: FieldElement
  controlKind: ControlKind
  fieldType: FieldType
  confidence: number
  status: LayerStatus
  evidence: Evidence[]
}
```

## Signal Priority and Weights
Use additive scoring per candidate type.

1. `label[for=id]`: `1.00`
2. Wrapped `<label>`: `0.95`
3. `aria-labelledby`: `0.90`
4. `autocomplete`: `0.85`
5. `aria-label`: `0.80`
6. `name`: `0.65`
7. `id`: `0.65`
8. `placeholder`: `0.45`

Penalties:
1. Strong conflict (top two semantic types disagree from high-priority sources): `-0.25`.
2. Generic text only (`"value"`, `"input"`, `"text"`): `-0.10`.

## Confidence Calculation
For each field:
1. Build a map of `FieldType -> score`.
2. `topScore = max(scores)`.
3. `secondScore = second max(scores)` or `0`.
4. `abs = clamp(topScore, 0, 1)`.
5. `margin = clamp((topScore - secondScore) / 0.35, 0, 1)`.
6. `confidence = 0.7 * abs + 0.3 * margin`.

Decision thresholds:
1. `confidence >= 0.90` -> `resolved` (fill now).
2. `0.50 <= confidence < 0.90` -> `ambiguous` (defer to Layer 2).
3. `confidence < 0.50` -> `unresolved` (defer to Layer 2).

## Field Discovery Rules
Include:
1. All native input controls: `input` (`text`, `email`, `tel`, `password`, `number`, `date`, `time`, `datetime-local`, `month`, `week`, `url`, `search`, `color`, `range`, `checkbox`, `radio`, `file`, and others) except `type=hidden`.
2. `textarea`.
3. `select` (single and multiple).
4. Common ARIA form widgets used in modern UI libraries:
   1. `[role="textbox"]`
   2. `[role="combobox"]`
   3. `[role="listbox"]`
   4. `[role="spinbutton"]`
   5. `[role="checkbox"]`
   6. `[role="radio"]`
   7. `[role="slider"]`
5. `contenteditable` elements that are intended for text input.

Skip:
1. `disabled`.
2. `readonly`.
3. Hidden by CSS (`display:none`, `visibility:hidden`) or not connected.
4. Pure action controls (`button`, `submit`, `reset`, `image`) for fill actions.
5. Do not auto-fill `file` inputs (browser restriction). Discover them, mark as non-fillable.
6. Do not auto-fill controls blocked by site policy or security constraints.

## Milestones
## Milestone 1: Contracts and Vocabulary
Deliverables:
1. `types.ts` with contracts.
2. `vocabulary.ts` with token maps per `FieldType`.

Acceptance:
1. Unit tests for token normalization and type mapping.
2. Vocabulary supports aliases (`e-mail`, `mail`, `tel`, `zip`, `postal`).

## Milestone 2: Field Discovery and Explicit Extractors
Deliverables:
1. `field-discovery.ts` for candidate input collection.
2. Extractors for each explicit signal.

Acceptance:
1. Unit tests for each extractor.
2. Edge coverage: missing IDs, multiple labels, absent attributes, checkbox/radio/select/file/custom-role controls.

## Milestone 3: Scoring and Confidence Engine
Deliverables:
1. `scoring.ts` with weight aggregation, penalties, and confidence formula.
2. Deterministic tie-handling.

Acceptance:
1. Tests for score calculation.
2. Tests for threshold boundaries (`0.49`, `0.50`, `0.89`, `0.90`).

## Milestone 4: Layer 1 Orchestrator Integration
Deliverables:
1. `layer1.ts` orchestrates discovery, extraction, scoring, and decision.
2. `orchestrator.ts` entrypoint invoked by `FILL_FORM`.
3. `fill.ts` fills resolved fields only.

Acceptance:
1. Integration tests on fixture HTML pages.
2. `ambiguous` and `unresolved` fields are not filled.

## Milestone 5: Diagnostics and Safe Rollout
Deliverables:
1. Debug logging flag that records evidence per field.
2. Structured output payload for downstream layers.

Acceptance:
1. Debug output includes winning signal and confidence.
2. No runtime errors on pages without forms.

## Implementation Notes
1. Normalize all text before matching: lowercase, trim, collapse whitespace, remove punctuation.
2. Prefer browser-native APIs when available:
   1. `HTMLInputElement.labels`
   2. `getAttribute("autocomplete")`
   3. `getAttribute("aria-label")`
3. `autocomplete` should map directly where possible (`email`, `tel`, `given-name`, `family-name`, `address-line1`, `postal-code`).
4. Keep Layer 1 pure and side-effect free until final `fill.ts` step.

## Example 1: Perfect Semantic Match
HTML:
```html
<label for="email">Email Address</label>
<input id="email" name="user_email" autocomplete="email" />
```

Expected Layer 1 outcome:
1. Evidence:
   1. `label_for -> email (1.00)`
   2. `autocomplete -> email (0.85)`
   3. `name -> email (0.65)`
2. Top type: `email`.
3. Confidence: `>= 0.95`.
4. Status: `resolved`.
5. Action: fill now.

## Example 2: Ambiguous Signals
HTML:
```html
<input id="contact" name="contact" placeholder="Your contact" />
```

Expected Layer 1 outcome:
1. Evidence mostly weak or generic.
2. Candidate scores close or low.
3. Confidence around `0.40-0.65` depending on vocabulary.
4. Status: `ambiguous` or `unresolved`.
5. Action: do not fill in Layer 1, defer to Layer 2.

## Example 3: Accessible Label via aria-labelledby
HTML:
```html
<span id="phoneLabel">Phone Number</span>
<input aria-labelledby="phoneLabel" name="mobile" autocomplete="tel" />
```

Expected Layer 1 outcome:
1. Evidence:
   1. `aria_labelledby -> phone (0.90)`
   2. `autocomplete -> phone (0.85)`
   3. `name -> phone (0.65)`
2. Top type: `phone`.
3. Confidence: `>= 0.90`.
4. Status: `resolved`.
5. Action: fill now.

## Done Criteria for Layer 1
Layer 1 is complete when:
1. It resolves high-confidence explicit forms without false positives.
2. It returns structured `ambiguous`/`unresolved` results for unclear cases.
3. It is fully covered by unit and integration tests.
4. It can be safely composed with Layer 2 in the orchestrator pipeline.
5. It discovers all supported form controls and safely skips non-fillable ones with explicit reasons.
