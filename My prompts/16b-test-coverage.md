Read AGENTS.md first and follow it strictly.

## Task

Set up automated testing for this project for the first time, and add coverage for the four functions in `src/lib/reportExport.ts` that CodeRabbit flagged as untested on PR #30 (`buildReportExportRows`, `buildReportExportHtml`, `exportReportsAsPdf`, `exportReportsAsXlsx`). No other files change — this is test infrastructure plus tests, nothing else.

### 1. Install `jest-expo`

`jest-expo` is Expo's own maintained Jest preset — it's the correct choice here specifically, not generic Jest or Vitest, because it already knows how to transform React Native/Expo code and auto-mocks most `expo-*` native modules, which this project needs given how many are now in play (`expo-print`, `expo-file-system`, `expo-sharing`, `expo-application`, `expo-device`).

```
npx expo install jest-expo jest @types/jest --dev
```

Add to `package.json`:
```json
"scripts": {
  "test": "jest"
},
"jest": {
  "preset": "jest-expo"
}
```

### 2. Test file location

Put tests in `src/lib/__tests__/reportExport.test.ts`. This isn't an arbitrary choice — `tsconfig.json` already excludes `**/__tests__/*` from the app's own TypeScript build (`"exclude": ["**/__mocks__/*", "**/__tests__/*"]`), which means this convention was anticipated in the project setup from the start, before any tests existed. Follow it rather than inventing a different layout.

### 3. What to actually cover, and why the four functions don't get equal depth

`buildReportExportRows` and `buildReportExportHtml` are pure functions — no native calls, nothing to mock, and they're where the actual data-integrity risk CodeRabbit was pointing at lives (a broken export silently dropping a snapshot or mis-grouping a report is a real problem once your dad's real reports exist). These get real coverage. `exportReportsAsPdf`/`exportReportsAsXlsx` are thin wrappers around native I/O (`expo-print`, `expo-file-system`, `expo-sharing`, `xlsx`) — Jest can't meaningfully verify real file writes or native share sheets, and that's not where a regression would actually hide anyway. For those two, mock the underlying libraries and verify they're called with correctly-shaped arguments — not deeper than that.

**`buildReportExportRows`** — construct fixture `Report`/`InventoryItem`/`Category`/`Unit`/`SyncedUser` arrays covering:
- An item with multiple snapshots (confirm the `→`-joined quantity history string is correct and in order)
- An item with a note but no snapshots (confirm it still produces a row)
- A report with zero item entries but real `content` (confirm it produces exactly one row with the item fields empty, not zero rows)
- An item whose `itemId` no longer matches any item in the `items` array (confirm it falls back to `"Deleted item"`, not a crash)
- A `reporterId` with no matching entry in `appUsers` (confirm it falls back to `"Unknown reporter"`)
- Multiple reports together (confirm row counts and ordering match what's expected across all of them, not just a single-report case)

**`buildReportExportHtml`** — using the same fixtures:
- Confirm the output contains the header text, the export date, and the filter summary string passed in
- Confirm one `<section class="report">` block appears per report, not per row
- Confirm HTML-escaping actually works — build a fixture with `<`, `&`, and `"` in an item note or reporter name, and assert the raw characters do **not** appear unescaped in the output (this is the one most worth getting right — a report with unescaped user text in it is a real markup-injection risk in the generated PDF, however unlikely a restaurant report is to trigger it deliberately)

**`exportReportsAsPdf`** — mock `expo-print`'s `printToFileAsync`, `expo-file-system`'s `File`/`Paths`/`EncodingType`, and `expo-sharing`'s `shareAsync`/`isAvailableAsync`. Assert `printToFileAsync` is called with HTML containing the expected content, and `shareAsync` is called with `mimeType: "application/pdf"`.

**`exportReportsAsXlsx`** — mock the same `expo-file-system` and `expo-sharing` pieces. Assert `shareAsync` is called with the correct spreadsheet mimeType. Real `xlsx` library calls (`XLSX.utils.json_to_sheet`, `XLSX.write`) don't need mocking — they're pure and safe to run for real inside a test.

## Constraints

- Don't modify `reportExport.ts` itself unless you find an actual bug while writing tests against it — if you do find one, stop and flag it rather than quietly fixing it inline.
- Strict TypeScript in test files too, no `any`.
- Run `npm run test`, `npm run lint`, and `npm run typecheck` before finishing. All three must pass clean.

## Reference

This is the project's first test suite — if `jest-expo`'s auto-mocking needs anything extra configured for `expo-print`/`expo-sharing` specifically (some Expo modules need an explicit manual mock even under the preset), that's expected setup work for this prompt, not a sign something's wrong.
