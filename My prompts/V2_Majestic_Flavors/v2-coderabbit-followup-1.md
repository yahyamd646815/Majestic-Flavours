Read AGENTS.md first and follow it strictly.

**Suggested: Opus, high effort.** Two of these three are genuine security hardening on infrastructure that's already proven to work — the risk is in getting the fix precise, not in inventing new architecture.

Three unrelated CodeRabbit findings, bundled as a fix batch rather than a cohesive feature — matches how CodeRabbit fixes have been handled together elsewhere in this project.

## Part A — the notification trigger can roll back a real assignment

`net.http_post` synchronously inserts into `net.http_request_queue` before the actual HTTP call happens asynchronously — if that insert itself fails inside `notify_task_assignment()`, the `AFTER INSERT` trigger on `task_assignments` can roll back the assignment insert that triggered it. A notification-plumbing failure should never be able to block someone actually being assigned a task — that's the actual business operation, and the notification is a side effect of it, not the other way around.

Wrap the `net.http_post` call in exception handling, log the failure, and let the trigger return normally regardless — the assignment itself must always succeed independent of whether the notification pipeline is healthy. Verify the trigger function's current, complete definition before changing it rather than assuming its structure.

## Part B — the Edge Function has no way to verify its caller is actually the trigger

Right now `notify-task-assignment` is called with only the service-role key as authorization — which means, unless `verify_jwt` has been explicitly disabled (which would make the endpoint fully public instead), *any* signed-in app user with a valid JWT can call it directly with arbitrary `task_id`/`employee_clerk_id` values and trigger a push to anyone for anything. There's currently no check that the caller is specifically the database trigger rather than any authenticated client.

Add a shared secret: the trigger's `net.http_post` call includes it as a custom header, and the function validates it with a constant-time comparison before doing any service-role-backed lookup — a plain `===` comparison leaks timing information and isn't sufficient here. Verify what the right place to store this secret actually is for this specific Supabase project (Vault, a custom Postgres setting, an Edge Function environment variable compared against a value embedded at trigger-creation time) rather than assuming one mechanism — this is genuinely new territory in this project, worth confirming rather than guessing.

Also return one generic response for any lookup failure (unknown task, unknown employee, no registered token) rather than distinct messages for each — distinguishing them lets a caller probe for which task or employee IDs actually exist.

## Part C — the recurrence preview's truncation flag is wrong at the exact boundary

`generatePreviewOccurrences`' `isTruncated` flag currently fires whenever the occurrence count reaches `MAX_PREVIEW_OCCURRENCES` — but a count-ending rule (`endsAfterOccurrences` set to exactly 1000, the cap) stops there on its own, correctly, not because the preview cut it short. Right now that correctly-complete sequence gets flagged as truncated, and `RecurrenceOccurrencePreview` shows a misleading "1000+ … and on" for a rule that's actually finished.

Gate the flag on `endsAfterOccurrences === null` — only a date-ending rule (which has no natural stopping point below the cap) can actually be truncated by it; a count-ending rule reaching exactly its own limit is complete, not cut off.

## Constraints

- Don't touch local reminders (`v2-03-e1`/`e3`) or anything about recurrence generation logic itself beyond Part C's specific flag.
- Strict TypeScript, no `any`. Match this Supabase project's own existing Deno/Edge Function conventions for Part B rather than introducing new ones.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Part A: force the enqueue to fail somehow (or trace through the logic carefully if forcing a failure isn't practical) and confirm the assignment itself still succeeds regardless. Part B: confirm a direct call to the function without the shared secret is rejected, and a call with it (matching what the real trigger would send) still succeeds. Part C: a rule ending after exactly 1000 occurrences shows as complete, not truncated; a date-ending rule that hits the cap still correctly shows truncated.
