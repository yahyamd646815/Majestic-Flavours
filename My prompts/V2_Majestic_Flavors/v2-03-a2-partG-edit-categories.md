Read AGENTS.md first and follow it strictly.

**Suggested: Sonnet, high effort.** New UI screen, but mirroring an existing pattern if one exists rather than inventing one.

This is Part G of the to-do list foundation supplement. Parts A–D are already complete and merged. This file is fully self-contained — verify the current state of everything referenced below directly rather than assuming it matches an earlier description.

## Task

The "+" menu's category option currently opens a bare "create one category" form. Replace it with a management view: list every existing `task_category`, each with a delete button, plus a way to add a new one from the same screen.

**Check Settings for an existing inventory-category management pattern before building anything new.** If one already exists there, mirror it rather than diverging in behavior or visual style — don't invent a second, different approach to the same kind of screen.

**Deleting a category currently in use by any task must be blocked** — mirror `inventoryStore`'s `isCategoryInUse`/`deleteCategory` pattern exactly (check its current real implementation, don't assume the shape from this description) and add the equivalent guard for `task_categories`.

## Constraints

- Don't touch anything about assignment, completion, or deletion of tasks themselves — separate, unrelated prompts.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Test: create two categories, assign a task to one of them, confirm deleting that category is blocked while deleting the unused one works. Confirm the visual/interaction pattern genuinely matches whatever Settings already does for inventory categories, if that exists.
