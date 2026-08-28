Read AGENTS.md first and follow it strictly.

## Task

`ReportCard.tsx` currently shows only the *latest* ping per item entry (`entry.statusPings[entry.statusPings.length - 1]`). Show the full history instead — every ping that happened, in order — the same idea as how quantity already shows its complete arrow-chain history rather than just the latest number.

Unlike quantity's plain-text join, pings benefit from staying visually distinct (the whole point of `StockStatusBadge` is the color-coded flag) — so render one small badge + timestamp pair per ping, in chronological order, rather than collapsing them into a single text string:

```tsx
{entry.statusPings.length > 0 ? (
  <View className="gap-1">
    {entry.statusPings.map((ping, index) => (
      <View key={index} className="flex-row items-center justify-between gap-2">
        <StockStatusBadge status={ping.status} isOverridden={true} />
        <Text className="font-inter text-xs text-text-secondary">
          Reported at {formatSnapshotTime(ping.recordedAt)}
        </Text>
      </View>
    ))}
  </View>
) : null}
```

Replaces the existing single-`latestPing` block. Verify against the current exact file before applying — this prompt assumes the shape already uploaded, but confirm nothing else changed it since.

## Constraints

- This is Reports-display only — don't touch Dashboard, Inventory, or `submitReport`'s write logic, all of which are already correct and unrelated to this.
- Strict TypeScript, no `any`.
- Run `npm run lint`, `npm run typecheck`, and `npm run test`.

## Reference

Test with the same two-pings-in-one-day case from before (out of stock, then later low stock) — confirm both now show, in order, each with its own correct timestamp.
