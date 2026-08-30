Read AGENTS.md first and follow it strictly.

**Suggested: Sonnet, medium effort.** One file, one style block.

CodeRabbit flagged several `StyleSheet` usages across the task feature files as candidates for NativeWind conversion. Most were checked against AGENTS.md's own documented Style Exceptions and existing precedent, and don't actually need changing — this prompt is scoped to the one genuine inconsistency, not a blanket conversion:

**`TaskCategoryFormModal.tsx`'s overlay** — convert to NativeWind classes, matching `BulkAssignModal`'s own overlay exactly (it was deliberately converted in an earlier NativeWind cleanup pass; this file was built afterward and didn't follow that established convention).

**Explicitly not in scope, checked and left as-is:**
- `tasks.tsx`'s FAB shadow — shadow properties are a documented AGENTS.md exception, and Inventory's own equivalent FAB shadow is still `StyleSheet` too.
- Input/sheet styles elsewhere in the task files that match `ItemFormModal`'s own current (still-`StyleSheet`) state — converting just the task-side copy would create a new inconsistency, not fix one; a broader cleanup covering both would be a separate, deliberate decision, not this prompt.

## Constraints

- Touch only `TaskCategoryFormModal.tsx`'s overlay styling.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Visually confirm the category creation modal's overlay looks and behaves identically to before — this is a styling-mechanism change, not a visual one.
