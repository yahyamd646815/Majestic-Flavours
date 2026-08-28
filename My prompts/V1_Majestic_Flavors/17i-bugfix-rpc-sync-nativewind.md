Read AGENTS.md first and follow it strictly.

Three unrelated small fixes from CodeRabbit's review. Stop after each lettered part and tell Yahya it's ready to commit — don't run git yourself.

---

### Part A — Fix wrong id comparison in `ManagerReportsView.tsx` (real bug, currently shipped)

In `todayRows`'s filter, the fallback branch for a reporter without a report yet compares `item.assignedEmployeeIds.includes(reporter.id)` — but `reporter.id` is the roster id (`sampleUsers.ts`'s own id, e.g. `"user-3"`), while `assignedEmployeeIds` stores real Clerk ids. These are different id namespaces and this comparison can essentially never be true, meaning any reporter without today's report is silently excluded whenever a category filter is active, even if they genuinely have assigned items in that category.

```ts
.filter(({ reporter, report }) => {
  if (categoryIds.size === 0) return true;
  if (report) return reportMatchesAnyCategory(report, items, categoryIds);
  if (reporter.clerkUserId === undefined) return false;
  return items.some(
    (item) =>
      categoryIds.has(item.categoryId) &&
      item.assignedEmployeeIds.includes(reporter.clerkUserId as string),
  );
});
```

The added guard matters: someone with no synced Clerk id can't be assigned to anything, so they should fail this check outright rather than comparing against `undefined`.

---

### Part B — Sync `addEmployeeToItem`/`removeEmployeeFromItem` to the new row-returning RPCs

**Prerequisite:** `supabase-rpc-employee-assignment-v2.sql` must already be applied — both RPCs now return the affected row (or nothing) instead of `void`.

Replace the "no error = success, then optimistically transform local state" pattern with syncing from what the RPC actually returned:

```ts
addEmployeeToItem: async (supabase, itemId, employeeId) => {
  const { data, error } = await supabase.rpc("add_employee_to_item", {
    p_item_id: itemId,
    p_employee_id: employeeId,
  });
  // A row-returning RPC comes back as an array. Empty means RLS or a
  // missing id silently matched nothing — treat that as failure too, not
  // just an explicit error, since the write genuinely didn't happen.
  if (error || !data || data.length === 0) return false;

  const updatedItem = mapDbItemToItem(data[0]);
  set((state) => ({
    items: state.items.map((item) => (item.id === itemId ? updatedItem : item)),
  }));
  return true;
},
```

`removeEmployeeFromItem` follows the same shape. `mapDbItemToItem` is already defined in this file — reuse it rather than hand-writing the row mapping again.

---

### Part C — NativeWind cleanup: ScrollView `style` in three filter components

`style={styles.scrollView}` (just `{ flexGrow: 0 }`) → `className="grow-0"`, in all three of `EmployeeFilter.tsx`, `CategoryFilter.tsx`, and `ReportFilters.tsx` — same identical pattern in each. Leave `contentContainerStyle={styles.content}` as `StyleSheet` in all three — that's the documented exception already correctly applied elsewhere (`ScrollView`'s content-container style isn't NativeWind-stylable in the installed version).

## Constraints

- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test` after every part.

## Reference

Part A: filter Reports to a category, switch to the Today tab, confirm someone without today's report but with an assigned item in that category now actually appears. Part B: temporarily point an RPC call at a nonexistent item id, confirm it now returns `false` instead of silently "succeeding." Part C: purely visual — confirm all three filter rows still scroll and lay out identically.
