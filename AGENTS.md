## Engineering Principles (Generic, Strict)

These principles are mandatory for all web changes.

- **DRY** : Do not duplicate logic, constants, validation rules, or UI behavior.
- **Extract common code** : When logic or UI repeats across modules/flows, move it to shared modules/hooks/utils/types and reuse it.
- **SSOT (Single Source of Truth)** : Keep one source of truth for each business rule, display value, config, and type.
- **Modular code** : Split code by feature/responsibility. Keep components focused.
- **Decoupled components** : Build reusable components driven by explicit props/contracts.
- **Simple over clever** : Avoid unnecessary abstractions.
- **Minimal changes** : Implement the smallest safe diff that solves the requirement.
- **Intuitive code** : Keep control flow and state easy to follow.
- **Naming** : Use short, descriptive, and consistent names.
- **Type safety** : Avoid unsafe types in feature code.
- **Testability** : Keep logic testable and avoid hidden side effects.
