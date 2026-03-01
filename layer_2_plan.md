# Layer 2 Plan: Proximity + Group-Aware Label Matching (LCA)

## Goal

Implement Layer 2 as the second autofill pass for fields that Layer 1 cannot confidently resolve.

Layer 2 must be:

1. Deterministic.
2. Robust on custom form UIs without explicit `for`/`id` wiring.
3. Conservative enough to avoid wrong fills.

## Problem Layer 2 Solves

Layer 1 depends on explicit semantics (`label[for]`, `aria`, `autocomplete`, etc.).

Modern job forms often render questions like this:

1. Prompt text in a sibling `<div class="text">`.
2. Input inside a separate container.
3. No useful `id`, `name`, or `autocomplete`.

This causes Layer 1 to return `ambiguous` or `unresolved` even when the prompt text clearly indicates the field meaning.

Layer 2 solves this by:

1. Finding label-like text nodes near each unresolved/ambiguous field.
2. Computing structural proximity using Lowest Common Ancestor (LCA) distance.
3. Preferring candidates in the same nearest question/group container.
4. Converting the best nearby label text into a field-type decision.1

## Scope

Layer 2 includes:

1. Candidate text-node discovery from label-like elements.
2. Structural matching between a field and candidates using LCA distance.
3. Group-aware ranking (same question block gets priority).
4. Field-type inference from selected candidate text.
5. Layer 2 decision output merged into the existing orchestrator flow.

Layer 2 excludes:

1. Visual geometry matching (`getBoundingClientRect`) heuristics.
2. LLM/NLP generation and free-text answer synthesis.
3. Cross-page memory or profile learning.
4. Autofilling open-ended custom narrative questions with generated content.

## Trigger Flow

1. User clicks `Fill Form` from popup.
2. Layer 1 runs for all discovered fields.
3. Fields with `status = ambiguous | unresolved` are sent to Layer 2.
4. Layer 2 tries proximity-based label resolution.
5. If Layer 2 reaches threshold, field becomes `resolved` and is fillable.
6. Remaining uncertain fields stay unresolved for a later layer/manual handling.

## Proposed File Structure

1. `src/content/autofill/layer2.ts`
2. `src/content/autofill/layer2-candidates.ts`
3. `src/content/autofill/layer2-lca.ts`
4. `src/content/autofill/layer2-scoring.ts`
5. `src/content/autofill/orchestrator.ts` (integration point)
6. `src/content/autofill/types.ts` (Layer 2 contracts)

## Data Contracts (Proposed)

```ts
export interface LabelLikeCandidate {
  textNode: Text
  element: HTMLElement
  text: string
  normalizedText: string
  tagName: string
  textLength: number
}

export interface Layer2Match {
  fieldId: string
  candidateText: string
  lcaDistance: number
  sameGroup: boolean
  lexicalTopType: FieldType
  lexicalScore: number
  combinedScore: number
}

export interface Layer2Decision {
  fieldId: string
  fieldType: FieldType
  confidence: number
  status: LayerStatus
  match?: Layer2Match
}
```

## Layer 2 Algorithm

### Step 1: Build label-like candidate pool

- Collect from all possible text-bearing DOM nodes:

1. Traverse with `TreeWalker` (`NodeFilter.SHOW_TEXT`) to visit every text node.
2. For each non-empty text node, lift to nearest meaningful HTMLElement ancestor.
3. Build candidates from that ancestor + text node pair.

Filter rules:

1. Element is connected and visible.
2. Text length after normalization is within a safe range (for example, `2..180`).
3. No interactive descendants:
   1. `input`, `textarea`, `select`, `button`, `a[href]`
   2. Interactive roles (`button`, `checkbox`, `radio`, `combobox`, etc.)
4. Exclude non-label containers and technical tags (`script`, `style`, `noscript`, `svg`, `code`, `pre`, etc.).
5. Exclude obvious helper/error nodes (e.g., text containing `invalid`, `required field` if not part of prompt).
6. De-duplicate equal normalized text within the same container path.

Rationale:

1. This captures custom components where the label text may be in arbitrary tags.
2. Filtering keeps precision while avoiding hardcoded tag assumptions.

### Step 2: Detect nearest ancestor group for each field

For each target field, resolve a `groupRoot` using general structural heuristics:

1. Walk ancestors from field to root.
2. Prefer nearest ancestor that:
   1. contains the field and at least one non-empty text-node candidate sibling/descendant.
   2. has bounded subtree size (not too small like a direct input wrapper, not too large like full page container).
   3. contains at least one form control descendant and one non-interactive text candidate.
3. Boost semantic grouping tags when present (`fieldset`, `section`, `article`, `li`, `tr`) without requiring classes.
4. For repeated structures, prefer ancestor whose parent has multiple children with similar tag/class shape (repeated question row pattern).
5. Fallback: nearest ancestor satisfying mixed text + control criteria.

Explicit constraint:

1. Do not hardcode product/site-specific classes (for example `application-question`, `form-group`, etc.) in core logic.

Rationale:

1. Questions and fields are usually co-located in one repeated group item.
2. Group membership strongly reduces wrong cross-question matching.

### Step 3: Compute LCA distance between field and each candidate

For each field-candidate pair:

1. Build ancestor chains to `document.body`.
2. Find deepest shared ancestor = LCA.
3. Compute hop distance:
   1. `distance = hops(field -> LCA) + hops(candidate -> LCA)`

Lower distance means stronger structural relation.

### Step 4: Rank candidates

For each pair, compute ranking features:

1. `distanceWeight`: decreases as LCA distance grows.
2. `groupWeight`: bonus if candidate is inside the field's `groupRoot`.
3. `directionWeight`: small bonus if candidate appears before field in DOM order.
4. `noisePenalty`: penalty for very long/non-question-like text blocks.

Pick highest ranked candidate per field.

### Step 5: Infer field type from chosen candidate

1. Run `getMatchesFromText(candidateText)` from vocabulary.
2. Convert lexical result into Layer 2 type scores.
3. Blend with Layer 1 score map:
   1. `combined[type] = layer1[type] + layer2[type]`
4. Compute confidence using top-vs-second margin.
5. Apply Layer 2 thresholds.

### Step 6: Merge Layer 2 decision into pipeline

1. Keep Layer 1 `resolved` fields unchanged.
2. For Layer 1 `ambiguous/unresolved`, replace with Layer 2 decision if confidence crosses threshold.
3. Fill only final `resolved` fields.

## Confidence and Decision Policy (Proposed)

Layer 2 confidence components:

1. Lexical strength from token matches.
2. Structural strength from LCA distance.
3. Ambiguity penalty when top two types are close.

Suggested thresholds:

1. `confidence >= 0.80` -> `resolved`.
2. `0.50 <= confidence < 0.80` -> `ambiguous`.
3. `< 0.50` -> `unresolved`.

Safety rules:

1. If top type is `unknown`, never promote to `resolved`.
2. If selected label is outside group and distance is high, cap confidence.
3. For checkbox/radio option labels, do not treat answer options as question labels.

## Milestones

## Milestone 1: Contracts + Utilities

Deliverables:

1. Layer 2 interfaces in `types.ts`.
2. LCA utility functions (`ancestor chain`, `distance`, `findLCA`).

Acceptance:

1. Unit tests for LCA correctness.
2. Deterministic output for identical DOMs.

## Milestone 2: Candidate Discovery

Deliverables:

1. Text-node-first collector (`TreeWalker`) with filters.
2. Visibility and interactivity guards.

Acceptance:

1. Excludes error/help text and interactive wrappers.
2. Keeps question prompt nodes in custom components.
3. Works when question text is rendered in arbitrary tag structures.

## Milestone 3: Group-Aware Candidate Ranking

Deliverables:

1. Group root detection.
2. Distance + group scoring.
3. Candidate ranking with deterministic tie-breakers.

Acceptance:

1. Correct candidate selected within repeated question lists.
2. No cross-question leakage in list-based forms.
3. Group detection works without class-name dependencies.

## Milestone 4: Layer 2 Type Inference + Merge

Deliverables:

1. Layer 2 inference engine using candidate text.
2. Combined scoring with Layer 1 type scores.
3. Orchestrator integration for ambiguous/unresolved fields.

Acceptance:

1. Layer 1 resolved fields remain unchanged.
2. Ambiguous Layer 1 fields can become resolved via Layer 2.
3. Fill behavior remains unchanged for non-resolved fields.

## Milestone 5: Diagnostics + Rollout Safety

Deliverables:

1. Debug traces per field:
   1. chosen candidate text
   2. LCA distance
   3. same-group flag
   4. score breakdown
2. Feature flag for Layer 2 rollout.

Acceptance:

1. Debug logs explain why a field was promoted or not.
2. No runtime errors on pages without label-like candidates.

## Example 1: Custom Question List (Your HTML Pattern)

HTML shape:

1. Repeated `<li>` items each hold one question prompt and one field.
2. Field is in sibling `.application-field` textarea.
3. `name` is generic (`cards[...][fieldX]`).

Expected Layer 2 behavior:

1. For each textarea, nearest group root = current repeated `<li>` item based on structure (not class name).
2. Candidate prompt in same `li` gets minimum distance.
3. Prompt text maps:
   1. `Current CTC` -> `current_ctc`
   2. `Expected CTC` -> `expected_ctc`
   3. `Notice Period` -> `notice_period`
4. Textareas become `resolved` if confidence crosses threshold.

## Example 2: LinkedIn Question with Generic URL Token

Prompt text:
`Please share the URL to your LinkedIn profile`

Expected behavior:

1. Candidate text matches both `linkedin` and generic `website` tokens.
2. Weighted vocabulary + margin should keep `linkedin` on top.
3. Layer 2 can promote previously ambiguous field to `resolved`.

## Example 3: Checkbox Question with Option Labels

Question:
`Please check the areas you have hands-on experience in:`
Options include `Indexing`, `Concurrency Handling`, etc.

Expected behavior:

1. Question prompt is a valid label candidate.
2. Option labels (inside interactive checkbox wrappers) are excluded as prompt candidates.
3. Prevents misclassification from option text.

## Example 4: Long Open-Ended Narrative Prompt

Question:
`Can you share details about any projects...`

Expected behavior:

1. Prompt is still matched to its textarea by proximity.
2. If lexical mapping has no known field type, keep `unresolved`.
3. Layer 2 should not fabricate a business field type.

## Done Criteria for Layer 2

Layer 2 is complete when:

1. It reliably resolves custom component forms that lack explicit semantics.
2. It improves fill rate for Layer 1 ambiguous/unresolved fields without regressions.
3. It avoids cross-question mismatches in repeated list structures.
4. It provides explainable debug output per decision.
5. It can be safely composed with Layer 3/manual fallback.
